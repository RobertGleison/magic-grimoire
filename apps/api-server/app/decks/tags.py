"""Deck tag rules: what a tag may look like and how many a deck may carry."""
import re

MAX_TAGS = 10
MAX_TAG_LENGTH = 24

_WHITESPACE = re.compile(r"\s+")


def normalize_tag(raw: str) -> str:
    """Lowercase, trimmed, inner whitespace collapsed to one space."""
    return _WHITESPACE.sub(" ", raw.strip()).lower()


def normalize_tags(raw: list[str]) -> list[str]:
    """Normalise, drop empties and de-duplicate, keeping first-seen order.

    Raises ValueError when a tag is too long or there are too many tags, so the
    caller hears about it rather than having tags silently truncated.
    """
    tags: list[str] = []
    for value in raw:
        tag = normalize_tag(value)
        if not tag or tag in tags:
            continue
        if len(tag) > MAX_TAG_LENGTH:
            raise ValueError(f"Tags can be at most {MAX_TAG_LENGTH} characters.")
        tags.append(tag)
    if len(tags) > MAX_TAGS:
        raise ValueError(f"A deck can have at most {MAX_TAGS} tags.")
    return tags
