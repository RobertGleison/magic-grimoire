import pytest
from pydantic import ValidationError

from app.decks.dtos import DeckTagsRequestDTO
from app.decks.tags import MAX_TAG_LENGTH, MAX_TAGS, normalize_tags


def test_normalises_case_whitespace_and_duplicates():
    assert normalize_tags(["  Aggro ", "aggro", "Token   Swarm", "", "   "]) == ["aggro", "token swarm"]


def test_keeps_first_seen_order():
    assert normalize_tags(["b", "a", "B"]) == ["b", "a"]


def test_rejects_overlong_tags():
    with pytest.raises(ValueError, match="at most"):
        normalize_tags(["x" * (MAX_TAG_LENGTH + 1)])


def test_rejects_too_many_tags_after_deduplication():
    normalize_tags([f"t{i}" for i in range(MAX_TAGS)] + ["T0"])  # duplicate does not count
    with pytest.raises(ValueError, match="at most"):
        normalize_tags([f"t{i}" for i in range(MAX_TAGS + 1)])


def test_dto_normalises_and_reports_422_worthy_errors():
    assert DeckTagsRequestDTO(tags=[" Combo "]).tags == ["combo"]
    with pytest.raises(ValidationError):
        DeckTagsRequestDTO(tags=["x" * (MAX_TAG_LENGTH + 1)])
