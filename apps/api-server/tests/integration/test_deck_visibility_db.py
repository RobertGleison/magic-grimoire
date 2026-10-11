"""Public/private deck visibility: defaults, the owner-only toggle, and who may read what."""
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.enums import DeckStatus
from app.decks.model import Deck
from tests.conftest import TEST_USER_ID, make_token

AUTH = {"Authorization": f"Bearer {make_token()}"}
OTHER_USER_AUTH = {"Authorization": f"Bearer {make_token('99999999-aaaa-bbbb-cccc-000000000000')}"}
CARDS = [{"name": "Shock", "quantity": 4, "section": "spells"}]


async def _insert_deck(session_factory, user_id=TEST_USER_ID, **overrides) -> Deck:
    async with session_factory() as db:
        deck = Deck(prompt="test deck", user_id=user_id, status=DeckStatus.COMPLETED, **overrides)
        db.add(deck)
        await db.commit()
        await db.refresh(deck)
        return deck


async def _insert_saved(session_factory, **overrides) -> Deck:
    return await _insert_deck(
        session_factory, saved_at=datetime.now(UTC), version_no=1, cards=CARDS, card_count=4, **overrides
    )


# --- defaults ---

async def test_new_decks_are_public_by_default(client, session_factory):
    deck = await _insert_deck(session_factory)
    assert deck.is_public is True


async def test_saved_snapshot_keeps_the_source_visibility(client, session_factory):
    draft = await _insert_deck(session_factory, cards=CARDS, card_count=4, is_public=False)

    res = await client.post(f"/api/v1/decks/{draft.id}/save", headers=AUTH)

    assert res.status_code == 200
    assert res.json()["is_public"] is False


async def test_save_of_a_default_draft_is_public(client, session_factory):
    draft = await _insert_deck(session_factory, cards=CARDS, card_count=4)
    res = await client.post(f"/api/v1/decks/{draft.id}/save", headers=AUTH)
    assert res.json()["is_public"] is True


# --- reading ---

async def test_public_saved_deck_is_readable_by_anyone(client, session_factory):
    deck = await _insert_saved(session_factory)

    anonymous = await client.get(f"/api/v1/decks/{deck.id}")
    other = await client.get(f"/api/v1/decks/{deck.id}", headers=OTHER_USER_AUTH)

    assert anonymous.status_code == 200
    assert anonymous.json()["is_owner"] is False
    assert other.status_code == 200
    assert other.json()["is_owner"] is False


async def test_owner_reads_own_deck_as_owner(client, session_factory):
    deck = await _insert_saved(session_factory, is_public=False)
    res = await client.get(f"/api/v1/decks/{deck.id}", headers=AUTH)
    assert res.status_code == 200
    assert res.json()["is_owner"] is True
    assert res.json()["is_public"] is False


async def test_private_deck_is_hidden_from_non_owners(client, session_factory):
    deck = await _insert_saved(session_factory, is_public=False)

    assert (await client.get(f"/api/v1/decks/{deck.id}")).status_code == 403
    assert (await client.get(f"/api/v1/decks/{deck.id}", headers=OTHER_USER_AUTH)).status_code == 403


async def test_public_draft_stays_owner_only(client, session_factory):
    """A draft is a working copy; public applies to saved decks only."""
    draft = await _insert_deck(session_factory)
    assert (await client.get(f"/api/v1/decks/{draft.id}", headers=OTHER_USER_AUTH)).status_code == 403


async def test_reading_a_public_deck_does_not_grant_save(client, session_factory):
    deck = await _insert_saved(session_factory)
    res = await client.post(f"/api/v1/decks/{deck.id}/save", headers=OTHER_USER_AUTH)
    assert res.status_code == 403


async def test_list_marks_decks_as_owned(client, session_factory):
    await _insert_saved(session_factory)
    res = await client.get("/api/v1/decks", headers=AUTH)
    assert [d["is_owner"] for d in res.json()["decks"]] == [True]
    assert [d["is_public"] for d in res.json()["decks"]] == [True]


# --- PATCH /decks/{id}/visibility ---

async def test_owner_can_make_a_deck_private_and_public_again(client, session_factory):
    deck = await _insert_saved(session_factory)

    res = await client.patch(f"/api/v1/decks/{deck.id}/visibility", json={"is_public": False}, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["is_public"] is False
    assert res.json()["is_owner"] is True

    async with session_factory() as db:
        stored = (await db.execute(select(Deck).where(Deck.id == deck.id))).scalar_one()
    assert stored.is_public is False
    assert (await client.get(f"/api/v1/decks/{deck.id}", headers=OTHER_USER_AUTH)).status_code == 403

    res = await client.patch(f"/api/v1/decks/{deck.id}/visibility", json={"is_public": True}, headers=AUTH)
    assert res.json()["is_public"] is True
    assert (await client.get(f"/api/v1/decks/{deck.id}", headers=OTHER_USER_AUTH)).status_code == 200


async def test_only_the_owner_can_change_visibility(client, session_factory):
    deck = await _insert_saved(session_factory)

    res = await client.patch(
        f"/api/v1/decks/{deck.id}/visibility", json={"is_public": False}, headers=OTHER_USER_AUTH
    )

    assert res.status_code == 403
    async with session_factory() as db:
        stored = (await db.execute(select(Deck).where(Deck.id == deck.id))).scalar_one()
    assert stored.is_public is True


async def test_anonymous_deck_visibility_cannot_be_changed(client, session_factory):
    deck = await _insert_deck(session_factory, user_id=None)
    res = await client.patch(f"/api/v1/decks/{deck.id}/visibility", json={"is_public": False}, headers=AUTH)
    assert res.status_code == 403


async def test_visibility_requires_auth(client, session_factory):
    deck = await _insert_saved(session_factory)
    res = await client.patch(f"/api/v1/decks/{deck.id}/visibility", json={"is_public": False})
    assert res.status_code == 401


async def test_visibility_of_missing_deck_404(client, db_engine):
    res = await client.patch(f"/api/v1/decks/{uuid.uuid4()}/visibility", json={"is_public": False}, headers=AUTH)
    assert res.status_code == 404


async def test_visibility_body_is_validated(client, session_factory):
    deck = await _insert_saved(session_factory)
    res = await client.patch(f"/api/v1/decks/{deck.id}/visibility", json={}, headers=AUTH)
    assert res.status_code == 422
