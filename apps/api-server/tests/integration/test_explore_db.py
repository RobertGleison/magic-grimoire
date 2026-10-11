"""GET /explore/decks (community feed) and PUT /decks/{id}/tags."""
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.enums import DeckStatus
from app.decks import routes as deck_routes
from app.decks.model import Deck
from tests.conftest import TEST_USER_ID, make_token

AUTH = {"Authorization": f"Bearer {make_token()}"}
OTHER_USER_AUTH = {"Authorization": f"Bearer {make_token('99999999-aaaa-bbbb-cccc-000000000000')}"}
BASE = datetime(2026, 10, 1, tzinfo=UTC)


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    deck_routes._explore_limiter._hits.clear()
    yield
    deck_routes._explore_limiter._hits.clear()


def _cards(name: str = "Shock") -> list[dict]:
    return [
        {"name": "Mountain", "quantity": 20, "section": "lands"},
        {"name": name, "quantity": 4, "section": "spells", "image_uri": f"https://img/{name}.jpg",
         "art_crop_uri": f"https://img/art/{name}.jpg"},
        {"name": "Bolt", "quantity": 4, "section": "spells", "image_uri": "https://img/bolt.jpg"},
    ]


async def _deck(session_factory, *, minutes: int = 0, saved: bool = True, user_id=TEST_USER_ID, **overrides) -> Deck:
    fields = dict(
        prompt="a deck",
        title="Deck",
        user_id=user_id,
        status=DeckStatus.COMPLETED,
        cards=_cards(),
        card_count=28,
        created_at=BASE + timedelta(minutes=minutes),
        format="standard",
        colors=["R"],
    )
    if saved:
        fields.update(saved_at=BASE + timedelta(minutes=minutes), version_no=1)
    fields.update(overrides)
    async with session_factory() as db:
        deck = Deck(**fields)
        db.add(deck)
        await db.commit()
        await db.refresh(deck)
        return deck


async def _titles(client, query: str = "") -> list[str]:
    res = await client.get(f"/api/v1/explore/decks{query}")
    assert res.status_code == 200, res.text
    return [d["title"] for d in res.json()["decks"]]


# --- visibility: private decks never leak ---

async def test_only_public_saved_decks_appear_newest_first(client, session_factory):
    await _deck(session_factory, minutes=1, title="old public")
    await _deck(session_factory, minutes=2, title="private", is_public=False)
    await _deck(session_factory, minutes=3, title="public draft", saved=False)
    await _deck(session_factory, minutes=4, title="new public", user_id="someone-else")

    assert await _titles(client) == ["new public", "old public"]


async def test_making_a_deck_private_removes_it_immediately(client, session_factory):
    deck = await _deck(session_factory, title="soon private")
    assert await _titles(client) == ["soon private"]

    res = await client.patch(f"/api/v1/decks/{deck.id}/visibility", json={"is_public": False}, headers=AUTH)
    assert res.status_code == 200
    assert await _titles(client) == []


async def test_no_auth_required(client, session_factory):
    await _deck(session_factory, title="visible")
    res = await client.get("/api/v1/explore/decks")
    assert res.status_code == 200


# --- filters ---

async def test_search_by_name_is_case_insensitive_and_escapes_wildcards(client, session_factory):
    await _deck(session_factory, minutes=1, title="Goblin Rush")
    await _deck(session_factory, minutes=2, title="Elf Ball")
    await _deck(session_factory, minutes=3, title="100% Burn")
    await _deck(session_factory, minutes=4, title=None, prompt="goblin prompt only")

    assert await _titles(client, "?q=GOBLIN") == [None, "Goblin Rush"]
    assert await _titles(client, "?q=%25") == ["100% Burn"]


async def test_filter_by_colors_requires_every_selected_color(client, session_factory):
    await _deck(session_factory, minutes=1, title="Rakdos", colors=["B", "R"])
    await _deck(session_factory, minutes=2, title="Mono red", colors=["R"])
    await _deck(session_factory, minutes=3, title="Mono black", colors=["B"])

    assert await _titles(client, "?colors=R") == ["Mono red", "Rakdos"]
    assert await _titles(client, "?colors=B&colors=R") == ["Rakdos"]


async def test_filter_by_tag_and_format_combined(client, session_factory):
    await _deck(session_factory, minutes=1, title="aggro std", tags=["aggro"], format="standard")
    await _deck(session_factory, minutes=2, title="aggro modern", tags=["aggro", "budget"], format="modern")
    await _deck(session_factory, minutes=3, title="control modern", tags=["control"], format="modern")

    assert await _titles(client, "?tags=Aggro") == ["aggro modern", "aggro std"]
    assert await _titles(client, "?tags=aggro&format=modern") == ["aggro modern"]
    assert await _titles(client, "?tags=aggro&tags=budget") == ["aggro modern"]
    assert await _titles(client, "?q=modern&format=modern&colors=R") == ["control modern", "aggro modern"]


async def test_invalid_filters_are_rejected(client, db_engine):
    assert (await client.get("/api/v1/explore/decks?colors=X")).status_code == 422
    assert (await client.get("/api/v1/explore/decks?format=vintage")).status_code == 422
    assert (await client.get("/api/v1/explore/decks?limit=500")).status_code == 422
    assert (await client.get("/api/v1/explore/decks?cursor=not-a-cursor")).status_code == 400


# --- pagination ---

async def test_cursor_pagination_walks_every_deck_once(client, session_factory):
    for i in range(5):
        await _deck(session_factory, minutes=i, title=f"d{i}")
    # Same timestamp as d4: the id tie-breaker must still order them stably.
    await _deck(session_factory, minutes=4, title="d4-twin")

    seen: list[str] = []
    cursor = None
    pages = 0
    while True:
        query = "?limit=2" + (f"&cursor={cursor}" if cursor else "")
        body = (await client.get(f"/api/v1/explore/decks{query}")).json()
        seen += [d["title"] for d in body["decks"]]
        pages += 1
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert pages == 3
    assert sorted(seen) == sorted(["d0", "d1", "d2", "d3", "d4", "d4-twin"])
    assert len(seen) == len(set(seen))
    assert seen[-4:] == ["d3", "d2", "d1", "d0"]


async def test_feed_items_carry_only_the_cover_card(client, session_factory):
    await _deck(session_factory, tags=["aggro"])
    deck = (await client.get("/api/v1/explore/decks")).json()["decks"][0]

    assert deck["card_count"] == 28
    assert [c["name"] for c in deck["cards"]] == ["Shock"]
    assert deck["cards"][0]["art_crop_uri"] == "https://img/art/Shock.jpg"
    assert deck["tags"] == ["aggro"]
    assert deck["is_owner"] is False


async def test_feed_is_rate_limited(client, session_factory, monkeypatch):
    monkeypatch.setattr(deck_routes._explore_limiter, "limit", 2)
    headers = {"CF-Connecting-IP": "203.0.113.9"}
    assert (await client.get("/api/v1/explore/decks", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/explore/decks", headers=headers)).status_code == 200
    blocked = await client.get("/api/v1/explore/decks", headers=headers)
    assert blocked.status_code == 429
    assert "retry-after" in blocked.headers


# --- PUT /decks/{id}/tags ---

async def test_owner_sets_normalised_tags(client, session_factory):
    deck = await _deck(session_factory)
    res = await client.put(
        f"/api/v1/decks/{deck.id}/tags", json={"tags": [" Aggro", "aggro", "Token  Swarm"]}, headers=AUTH
    )
    assert res.status_code == 200
    assert res.json()["tags"] == ["aggro", "token swarm"]
    assert await _titles(client, "?tags=token%20swarm") == ["Deck"]

    res = await client.put(f"/api/v1/decks/{deck.id}/tags", json={"tags": []}, headers=AUTH)
    assert res.json()["tags"] == []


async def test_new_decks_have_no_tags(client, session_factory):
    deck = await _deck(session_factory)
    assert deck.tags == []


async def test_tags_are_owner_only(client, session_factory):
    deck = await _deck(session_factory)
    assert (await client.put(f"/api/v1/decks/{deck.id}/tags", json={"tags": ["x"]})).status_code == 401
    res = await client.put(f"/api/v1/decks/{deck.id}/tags", json={"tags": ["x"]}, headers=OTHER_USER_AUTH)
    assert res.status_code == 403
    res = await client.put(f"/api/v1/decks/{uuid.uuid4()}/tags", json={"tags": ["x"]}, headers=AUTH)
    assert res.status_code == 404


async def test_tag_limits_are_enforced(client, session_factory):
    deck = await _deck(session_factory)
    res = await client.put(f"/api/v1/decks/{deck.id}/tags", json={"tags": ["x" * 25]}, headers=AUTH)
    assert res.status_code == 422
    res = await client.put(
        f"/api/v1/decks/{deck.id}/tags", json={"tags": [f"t{i}" for i in range(11)]}, headers=AUTH
    )
    assert res.status_code == 422


async def test_saving_a_new_version_keeps_tags(client, session_factory):
    draft = await _deck(session_factory, saved=False, tags=["combo"])
    res = await client.post(f"/api/v1/decks/{draft.id}/save", headers=AUTH)
    assert res.json()["tags"] == ["combo"]
