import json
import urllib.parse

import httpx
import pytest
import respx

from app.services import redis_cache, scryfall_service
from app.services.scryfall_service import SCRYFALL_BASE, _build_scryfall_query


@pytest.fixture(autouse=True)
def no_rate_limit_delay(monkeypatch):
    monkeypatch.setattr(scryfall_service, "REQUEST_DELAY", 0)


def _card(name: str, **extra) -> dict:
    return {
        "id": f"id-{name}",
        "name": name,
        "mana_cost": "{R}",
        "type_line": "Instant",
        "oracle_text": "Deal 3 damage.",
        "colors": ["R"],
        "image_uris": {"normal": f"https://img/{name}.jpg"},
        **extra,
    }


# --- _build_scryfall_query (pure) ---

def test_query_combines_colors_types_keywords():
    query = _build_scryfall_query(
        {"colors": ["R", "G"], "creature_types": ["Elf", "Goblin"], "keywords": ["haste"]}
    )
    assert query == "color<=RG type:Elf type:Goblin keyword:haste"


def test_query_caps_types_at_3_and_keywords_at_2():
    query = _build_scryfall_query(
        {"creature_types": ["A", "B", "C", "D"], "keywords": ["x", "y", "z"]}
    )
    assert query == "type:A type:B type:C keyword:x keyword:y"


def test_query_falls_back_to_themes_as_oracle_text():
    assert _build_scryfall_query({"themes": ["sacrifice", "tokens"]}) == "o:sacrifice o:tokens"


def test_query_defaults_to_creatures_when_intent_empty():
    assert _build_scryfall_query({}) == "type:creature"


# --- search_cards ---

@respx.mock
async def test_search_paginates_dedupes_and_caches(fake_redis):
    page1 = {"data": [_card("Shock"), _card("Shock")], "has_more": True}
    page2 = {"data": [_card("Lightning Bolt")], "has_more": False}
    route = respx.get(f"{SCRYFALL_BASE}/cards/search").mock(
        side_effect=[httpx.Response(200, json=page1), httpx.Response(200, json=page2)]
    )

    results = await scryfall_service.search_cards({"colors": ["R"]})

    assert [c["name"] for c in results] == ["Shock", "Lightning Bolt"]
    assert results[0]["image_uri"] == "https://img/Shock.jpg"
    assert route.call_count == 2

    cache_key = f"scryfall:search:{urllib.parse.quote('color<=R')}"
    assert json.loads(await redis_cache.get(cache_key)) == results


@respx.mock
async def test_search_cache_hit_skips_http(fake_redis):
    cache_key = f"scryfall:search:{urllib.parse.quote('color<=R')}"
    await redis_cache.set(cache_key, json.dumps([{"name": "Cached Card"}]))
    route = respx.get(f"{SCRYFALL_BASE}/cards/search")

    results = await scryfall_service.search_cards({"colors": ["R"]})

    assert results == [{"name": "Cached Card"}]
    assert route.call_count == 0


@respx.mock
async def test_search_404_returns_empty_list(fake_redis):
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(return_value=httpx.Response(404))
    assert await scryfall_service.search_cards({"colors": ["R"]}) == []


@respx.mock
async def test_search_uses_card_faces_image_fallback(fake_redis):
    faced = _card("Delver of Secrets")
    del faced["image_uris"]
    faced["card_faces"] = [{"image_uris": {"normal": "https://img/front.jpg"}}]
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(
        return_value=httpx.Response(200, json={"data": [faced], "has_more": False})
    )

    results = await scryfall_service.search_cards({"colors": ["U"]})
    assert results[0]["image_uri"] == "https://img/front.jpg"


# --- enrich_cards ---

@respx.mock
async def test_enrich_fetches_and_caches_card_data(fake_redis):
    respx.get(f"{SCRYFALL_BASE}/cards/named").mock(
        return_value=httpx.Response(200, json=_card("Shock"))
    )

    enriched = await scryfall_service.enrich_cards([{"name": "Shock", "quantity": 4, "section": "spells"}])

    assert enriched[0]["scryfall_id"] == "id-Shock"
    assert enriched[0]["image_uri"] == "https://img/Shock.jpg"
    assert enriched[0]["quantity"] == 4
    cached = await redis_cache.get(f"scryfall:card:{urllib.parse.quote('Shock')}")
    assert json.loads(cached)["scryfall_id"] == "id-Shock"


@respx.mock
async def test_enrich_cache_hit_skips_http(fake_redis):
    await redis_cache.set(
        f"scryfall:card:{urllib.parse.quote('Shock')}",
        json.dumps({"scryfall_id": "cached-id"}),
    )
    route = respx.get(f"{SCRYFALL_BASE}/cards/named")

    enriched = await scryfall_service.enrich_cards([{"name": "Shock", "quantity": 4}])

    assert enriched[0]["scryfall_id"] == "cached-id"
    assert route.call_count == 0


@respx.mock
async def test_enrich_keeps_card_on_http_error(fake_redis):
    respx.get(f"{SCRYFALL_BASE}/cards/named").mock(return_value=httpx.Response(404))

    enriched = await scryfall_service.enrich_cards([{"name": "Fake Card", "quantity": 1}])

    assert enriched == [{"name": "Fake Card", "quantity": 1}]


async def test_enrich_passes_through_nameless_cards(fake_redis):
    enriched = await scryfall_service.enrich_cards([{"quantity": 2}])
    assert enriched == [{"quantity": 2}]
