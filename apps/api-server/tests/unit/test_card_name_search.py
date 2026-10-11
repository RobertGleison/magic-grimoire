import json
import urllib.parse

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.main import app
from app.services import scryfall_service
from app.services.scryfall_service import NAME_SEARCH_LIMIT, SCRYFALL_BASE, _build_name_query
from tests.conftest import make_token


@pytest.fixture(autouse=True)
def no_rate_limit_delay(monkeypatch):
    monkeypatch.setattr(scryfall_service, "REQUEST_DELAY", 0)


def _card(name: str, **extra) -> dict:
    return {
        "id": f"id-{name}",
        "name": name,
        "mana_cost": "{R}",
        "type_line": "Instant",
        "image_uris": {"normal": f"https://cards.scryfall.io/normal/{name}.jpg"},
        **extra,
    }


# --- _build_name_query (pure) ---

def test_name_query_makes_every_word_a_name_term():
    assert _build_name_query("lightning bolt") == 'name:"lightning" name:"bolt"'


@pytest.mark.parametrize(
    "raw",
    ["c:r t:goblin", "-bolt", '"bolt" or (x)', "bolt!", "name<=x"],
)
def test_name_query_never_passes_query_syntax_through(raw):
    query = _build_name_query(raw)
    assert query is not None
    for term in query.split(" "):
        assert term.startswith('name:"') and term.endswith('"')
        inner = term[len('name:"'):-1]
        assert not any(ch in inner for ch in ':<>()!"') and not inner.startswith("-")


def test_name_query_keeps_apostrophes_and_inner_hyphens():
    assert _build_name_query("Will-o'-the-Wisp") == "name:\"Will-o'-the-Wisp\""


@pytest.mark.parametrize("raw", ["", "   ", "!!!", "::"])
def test_name_query_with_nothing_searchable_is_none(raw):
    assert _build_name_query(raw) is None


# --- search_cards_by_name ---

@respx.mock
async def test_search_by_name_returns_summaries_and_caches(fake_card_cache):
    route = respx.get(f"{SCRYFALL_BASE}/cards/search").mock(
        return_value=httpx.Response(200, json={"data": [_card("Lightning Bolt"), _card("Lightning Helix")]})
    )

    first = await scryfall_service.search_cards_by_name("lightning")
    second = await scryfall_service.search_cards_by_name("lightning")

    assert [c["name"] for c in first] == ["Lightning Bolt", "Lightning Helix"]
    assert first[0] == {
        "name": "Lightning Bolt",
        "scryfall_id": "id-Lightning Bolt",
        "image_uri": "https://cards.scryfall.io/normal/Lightning Bolt.jpg",
        "mana_cost": "{R}",
        "type_line": "Instant",
    }
    assert second == first
    assert route.call_count == 1  # second read came from the cache
    key = f"scryfall:search:{urllib.parse.quote(_build_name_query('lightning'))}"
    assert json.loads(fake_card_cache[key]) == first


@respx.mock
async def test_search_by_name_reads_double_faced_cards(fake_card_cache):
    dfc = {
        "id": "id-dfc", "name": "Delver of Secrets // Insectile Aberration", "type_line": "Creature",
        "card_faces": [{"mana_cost": "{U}", "image_uris": {"normal": "https://cards.scryfall.io/normal/d.jpg"}}],
    }
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(return_value=httpx.Response(200, json={"data": [dfc]}))

    [card] = await scryfall_service.search_cards_by_name("delver")

    assert card["mana_cost"] == "{U}"
    assert card["image_uri"] == "https://cards.scryfall.io/normal/d.jpg"


@respx.mock
async def test_search_by_name_caps_results(fake_card_cache):
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(
        return_value=httpx.Response(200, json={"data": [_card(f"Goblin {i}") for i in range(60)]})
    )
    assert len(await scryfall_service.search_cards_by_name("goblin")) == NAME_SEARCH_LIMIT


@respx.mock
async def test_search_by_name_treats_404_as_no_matches(fake_card_cache):
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(return_value=httpx.Response(404, json={}))
    assert await scryfall_service.search_cards_by_name("zzzzqx") == []


@respx.mock
async def test_search_by_name_raises_on_other_errors(fake_card_cache):
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(return_value=httpx.Response(503, json={}))
    with pytest.raises(httpx.HTTPStatusError):
        await scryfall_service.search_cards_by_name("bolt")


# --- GET /cards/search ---

@pytest.fixture
def client():
    return TestClient(app, headers={"Authorization": f"Bearer {make_token()}"})


def test_route_returns_matching_cards(client, monkeypatch):
    async def _search(name):
        assert name == "bolt"
        return [{"name": "Lightning Bolt", "scryfall_id": "x", "image_uri": None, "mana_cost": "{R}",
                 "type_line": "Instant"}]

    monkeypatch.setattr(scryfall_service, "search_cards_by_name", _search)

    res = client.get("/api/v1/cards/search", params={"q": "bolt"})

    assert res.status_code == 200
    assert res.json() == {"cards": [{"name": "Lightning Bolt", "scryfall_id": "x", "image_uri": None,
                                     "mana_cost": "{R}", "type_line": "Instant"}]}


@pytest.mark.parametrize("q", ["", "b", "x" * 101])
def test_route_validates_query_length(client, q):
    assert client.get("/api/v1/cards/search", params={"q": q}).status_code == 422


def test_route_requires_auth(client):
    assert client.get("/api/v1/cards/search", params={"q": "bolt"}, headers={"Authorization": ""}).status_code == 401


def test_route_reports_scryfall_outage_as_502(client, monkeypatch):
    async def _down(name):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(scryfall_service, "search_cards_by_name", _down)
    res = client.get("/api/v1/cards/search", params={"q": "bolt"})
    assert res.status_code == 502
    assert "unavailable" in res.json()["detail"]
