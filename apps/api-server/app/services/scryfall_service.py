import asyncio
import json
import urllib.parse
from typing import Any

import httpx

from app.services import redis_cache

SCRYFALL_BASE = "https://api.scryfall.com"
REQUEST_DELAY = 0.1  # 100ms between requests per Scryfall rate-limit policy
CACHE_TTL = 86400  # 24 hours


async def _get(client: httpx.AsyncClient, url: str, params: dict | None = None) -> dict:
    """Perform a GET request with rate limiting."""
    await asyncio.sleep(REQUEST_DELAY)
    response = await client.get(url, params=params, timeout=10.0)
    response.raise_for_status()
    return response.json()


def _build_scryfall_query(intent: dict) -> str:
    """Build a Scryfall search query string from a parsed intent."""
    parts: list[str] = []

    colors: list[str] = intent.get("colors", [])
    if colors:
        color_str = "".join(colors)
        parts.append(f"color<={color_str}")

    creature_types: list[str] = intent.get("creature_types", [])
    for ctype in creature_types[:3]:  # limit to top 3 to avoid overly narrow queries
        parts.append(f"type:{ctype}")

    keywords: list[str] = intent.get("keywords", [])
    for kw in keywords[:2]:
        parts.append(f"keyword:{kw}")

    if not parts:
        # fallback: search by themes as oracle text
        themes: list[str] = intent.get("themes", [])
        for theme in themes[:2]:
            parts.append(f"o:{theme}")

    return " ".join(parts) if parts else "type:creature"


async def search_cards(intent: dict) -> list[dict]:
    """Search Scryfall for candidate cards matching the intent.

    Results are cached in Redis for 24 hours.
    """
    query = _build_scryfall_query(intent)
    cache_key = f"scryfall:search:{urllib.parse.quote(query)}"

    cached = await redis_cache.get(cache_key)
    if cached:
        return json.loads(cached)

    results: list[dict] = []
    url = f"{SCRYFALL_BASE}/cards/search"
    seen_names: set[str] = set()

    async with httpx.AsyncClient() as client:
        page = 1
        has_more = True
        while has_more and page <= 5:  # cap at 5 pages (~350 cards)
            try:
                data = await _get(client, url, params={"q": query, "page": page, "order": "edhrec"})
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404:
                    # No results found
                    break
                raise

            for card in data.get("data", []):
                name = card.get("name", "")
                if name and name not in seen_names:
                    seen_names.add(name)
                    results.append({
                        "name": name,
                        "scryfall_id": card.get("id"),
                        "mana_cost": card.get("mana_cost", ""),
                        "type_line": card.get("type_line", ""),
                        "oracle_text": card.get("oracle_text", ""),
                        "colors": card.get("colors", []),
                        "image_uri": (
                            card.get("image_uris", {}).get("normal")
                            or (card.get("card_faces", [{}])[0].get("image_uris", {}).get("normal"))
                        ),
                    })

            has_more = data.get("has_more", False)
            page += 1

    await redis_cache.set(cache_key, json.dumps(results), ttl=CACHE_TTL)
    return results


async def enrich_cards(cards: list[dict]) -> list[dict]:
    """Enrich a list of {name, quantity, section} dicts with Scryfall data.

    Fetches scryfall_id, image_uri, mana_cost, type_line for each card.
    Results are cached per card name for 24 hours.
    """
    enriched: list[dict] = []

    async with httpx.AsyncClient() as client:
        for card in cards:
            name = card.get("name", "")
            if not name:
                enriched.append(card)
                continue

            cache_key = f"scryfall:card:{urllib.parse.quote(name)}"
            cached = await redis_cache.get(cache_key)

            if cached:
                card_data: dict[str, Any] = json.loads(cached)
            else:
                try:
                    card_data = await _get(
                        client,
                        f"{SCRYFALL_BASE}/cards/named",
                        params={"exact": name},
                    )
                    # Cache only the fields we need
                    card_data = {
                        "scryfall_id": card_data.get("id"),
                        "image_uri": (
                            card_data.get("image_uris", {}).get("normal")
                            or (card_data.get("card_faces", [{}])[0].get("image_uris", {}).get("normal"))
                        ),
                        "mana_cost": card_data.get("mana_cost", ""),
                        "type_line": card_data.get("type_line", ""),
                    }
                    await redis_cache.set(cache_key, json.dumps(card_data), ttl=CACHE_TTL)
                except httpx.HTTPStatusError:
                    card_data = {}

            enriched_card = {**card, **card_data}
            enriched.append(enriched_card)

    return enriched
