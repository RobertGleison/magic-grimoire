import pytest

from app.decks.pipeline import DESCRIPTION_MAX, clean_description
from app.llm.prompts import COMPOSE_DECK_TEMPLATE


def test_keeps_a_short_description_verbatim():
    text = "Goblins swarm the board early and Krenko turns the swarm into lethal."
    assert clean_description(text) == text


@pytest.mark.parametrize("raw", [None, 42, ["a"], {"a": 1}, "", "   \n\t "])
def test_missing_or_non_string_is_none(raw):
    assert clean_description(raw) is None


def test_collapses_whitespace_and_strips_control_characters():
    assert clean_description("  Burn\n\nface\x00 fast.\x1b\t ") == "Burn face fast."


def test_caps_length_at_a_word_boundary_with_an_ellipsis():
    result = clean_description("word " * 200)
    assert result is not None
    assert len(result) <= DESCRIPTION_MAX
    assert result.endswith("…")
    assert not result[:-1].endswith(" ")
    assert set(result[:-1].split()) == {"word"}


def test_caps_a_single_unbroken_token():
    result = clean_description("x" * 1000)
    assert result is not None and len(result) == DESCRIPTION_MAX


def test_leaves_markup_as_text():
    # Rendering is text-only on the frontend; nothing here should be interpreted.
    assert clean_description("<b>Elves</b> go wide") == "<b>Elves</b> go wide"


def test_compose_prompt_asks_for_a_description():
    prompt = COMPOSE_DECK_TEMPLATE.format(format="modern", intent="{}", cards="", deck_size=60)
    assert '"description":' in prompt
