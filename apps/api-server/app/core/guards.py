import re

_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(previous|all|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"\bsystem\s+prompt\b", re.IGNORECASE),
    re.compile(r"\bjailbreak\b", re.IGNORECASE),
    re.compile(r"\byou\s+are\s+now\b", re.IGNORECASE),
    re.compile(r"<\s*script", re.IGNORECASE),
    re.compile(r"\bjavascript\s*:", re.IGNORECASE),
]

_REJECTION_MESSAGE = "Invalid input detected."


def sanitize_prompt(text: str) -> tuple[bool, str]:
    """Return (is_valid, rejection_reason). Checks for prompt injection patterns only."""
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            return False, _REJECTION_MESSAGE
    return True, ""
