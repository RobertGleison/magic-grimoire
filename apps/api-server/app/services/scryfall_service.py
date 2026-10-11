import asyncio
import json
import re
import urllib.parse
from typing import Any

import httpx

from app.services import card_cache
from app.services.card_cache import CACHE_TTL

SCRYFALL_BASE = "https://api.scryfall.com"
REQUEST_DELAY = 0.5  # 500ms between requests — Scryfall hard limit is 2 req/s

# Card supertypes/types the LLM sometimes echoes back inside "creature_types" instead of
# a bare tribal word (e.g. "Creature - Human", "Artifact Creature"). Scryfall's `type:` operator
# treats a bare "-" as a negation on the next term, so leaving these in breaks the query.
_TYPE_LINE_NOISE = {
    "creature", "artifact", "enchantment", "legendary", "snow", "basic", "land",
    "planeswalker", "battle", "instant", "sorcery", "tribal", "kindred",
}


def _sanitize_creature_type(raw: str) -> str | None:
    """Extract the bare tribal word from a possibly-noisy creature type string."""
    words = [w for w in raw.replace("-", " ").split() if w.lower() not in _TYPE_LINE_NOISE]
    return " ".join(words) if words else None


# Scryfall's image CDN serves every size of a printing under the same path,
# differing only in the size segment: /normal/... vs /art_crop/...
_SCRYFALL_CDN_PREFIX = "https://cards.scryfall.io/"


def art_crop_from_normal(image_uri: str | None) -> str | None:
    """The art-crop URL for a Scryfall `normal` image URL, or None if it is not one.

    Lets decks enriched before `art_crop_uri` was stored get a cover image
    without re-fetching anything.
    """
    if not image_uri or not image_uri.startswith(_SCRYFALL_CDN_PREFIX):
        return None
    rest = image_uri[len(_SCRYFALL_CDN_PREFIX):]
    if not rest.startswith("normal/"):
        return None
    return f"{_SCRYFALL_CDN_PREFIX}art_crop/{rest[len('normal/'):]}"


def _image_uri(card: dict, size: str) -> str | None:
    """`image_uris[size]`, falling back to the front face of a double-faced card."""
    return (
        card.get("image_uris", {}).get(size)
        or (card.get("card_faces", [{}])[0].get("image_uris", {}).get(size))
    )


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
    if colors == ["C"]:
        parts.append("c:colorless")
    elif colors:
        color_str = "".join(colors)
        parts.append(f"color<={color_str}")

    creature_types: list[str] = intent.get("creature_types", [])
    for ctype in creature_types[:3]:  # limit to top 3 to avoid overly narrow queries
        clean = _sanitize_creature_type(ctype)
        if not clean:
            continue
        parts.append(f'type:"{clean}"' if " " in clean else f"type:{clean}")

    keywords: list[str] = intent.get("keywords", [])
    for kw in keywords[:2]:
        parts.append(f"keyword:{kw}")

    if not parts:
        # fallback: search by themes as oracle text
        themes: list[str] = intent.get("themes", [])
        for theme in themes[:2]:
            parts.append(f"o:{theme}")

    return " ".join(parts) if parts else "type:creature"


def _image_uri(card: dict) -> str | None:
    return card.get("image_uris", {}).get("normal") or (
        card.get("card_faces", [{}])[0].get("image_uris", {}).get("normal")
    )


# Card names are letters, digits, spaces, apostrophes, commas, hyphens and the odd
# punctuation; everything else (`:`, `<`, `(`, quotes, `!`) is Scryfall query syntax.
_NAME_UNSAFE = re.compile(r"[^\w\s',.-]", re.UNICODE)

NAME_SEARCH_LIMIT = 24


def _build_name_query(name: str) -> str | None:
    """A Scryfall query that matches card names containing every word of `name`.

    Each word becomes a `name:` term so user input can never reach Scryfall as query
    syntax: an operator like `c:r` or a leading `-` (negation) is neutralized.
    """
    words = [w.strip("-.,'") for w in _NAME_UNSAFE.sub(" ", name).split()]
    terms = [f'name:"{w}"' for w in words if w]
    return " ".join(terms[:8]) or None


async def search_cards_by_name(name: str) -> list[dict]:
    """Cards whose name contains every word of `name`, most-played first.

    One Scryfall page, capped at NAME_SEARCH_LIMIT, cached in Postgres for 24 hours
    under the same `scryfall:search:{query}` key scheme as `search_cards`. The two
    can't collide: name queries are always `name:` terms, intent queries never are.
    """
    query = _build_name_query(name)
    if query is None:
        return []
    cache_key = f"scryfall:search:{urllib.parse.quote(query)}"

    cached = await card_cache.get(cache_key)
    if cached:
        return json.loads(cached)

    async with httpx.AsyncClient() as client:
        try:
            data = await _get(
                client,
                f"{SCRYFALL_BASE}/cards/search",
                params={"q": f"{query} game:paper", "order": "edhrec"},
            )
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code != 404:
                raise
            data = {"data": []}  # Scryfall answers "no matches" with a 404

    results = [
        {
            "name": card.get("name", ""),
            "scryfall_id": card.get("id"),
            "image_uri": _image_uri(card),
            "mana_cost": card.get("mana_cost") or (card.get("card_faces", [{}])[0].get("mana_cost") or ""),
            "type_line": card.get("type_line", ""),
        }
        for card in data.get("data", [])
        if card.get("name")
    ][:NAME_SEARCH_LIMIT]

    await card_cache.set(cache_key, json.dumps(results), ttl=CACHE_TTL)
    return results


async def search_cards(intent: dict) -> list[dict]:
    """Search Scryfall for candidate cards matching the intent.

    Results are cached in Postgres for 24 hours.
    """
    query = _build_scryfall_query(intent)
    cache_key = f"scryfall:search:{urllib.parse.quote(query)}"

    cached = await card_cache.get(cache_key)
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
                        "image_uri": _image_uri(card, "normal"),
                    })

            has_more = data.get("has_more", False)
            page += 1

    await card_cache.set(cache_key, json.dumps(results), ttl=CACHE_TTL)
    return results


async def enrich_cards(cards: list[dict]) -> list[dict]:
    """Enrich a list of {name, quantity, section} dicts with Scryfall data.

    Fetches scryfall_id, image_uri, art_crop_uri, mana_cost, type_line for each card.
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
            cached = await card_cache.get(cache_key)

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
                        "image_uri": _image_uri(card_data, "normal"),
                        "art_crop_uri": _image_uri(card_data, "art_crop"),
                        "mana_cost": card_data.get("mana_cost", ""),
                        "type_line": card_data.get("type_line", ""),
                    }
                    await card_cache.set(cache_key, json.dumps(card_data), ttl=CACHE_TTL)
                except httpx.HTTPStatusError:
                    card_data = {}

            # Entries cached before art_crop_uri was stored only carry the
            # normal image; derive the crop from it rather than refetching.
            if not card_data.get("art_crop_uri"):
                derived = art_crop_from_normal(card_data.get("image_uri"))
                if derived:
                    card_data["art_crop_uri"] = derived

            enriched_card = {**card, **card_data}
            enriched.append(enriched_card)

    return enriched
