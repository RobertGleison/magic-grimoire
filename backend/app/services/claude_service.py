def parse_intent(prompt: str) -> dict:
    return {
        "colors": ["R"],
        "creature_types": ["Goblin"],
        "keywords": ["haste", "trample"],
        "themes": ["aggro", "token generation"],
        "format": "standard",
        "strategy": "Flood the board with cheap Goblins and win through sheer aggression.",
    }


def compose_deck(intent: dict, cards: list[dict], format: str) -> dict:
    return {
        "title": "Mock Goblin Blitz",
        "cards": [
            {"name": "Goblin Chainwhirler", "quantity": 4, "section": "creatures"},
            {"name": "Goblin Rabblemaster", "quantity": 4, "section": "creatures"},
            {"name": "Legion Loyalist", "quantity": 4, "section": "creatures"},
            {"name": "Goblin Guide", "quantity": 4, "section": "creatures"},
            {"name": "Goblin Warchief", "quantity": 4, "section": "creatures"},
            {"name": "Goblin King", "quantity": 2, "section": "creatures"},
            {"name": "Goblin Chieftain", "quantity": 4, "section": "creatures"},
            {"name": "Lightning Bolt", "quantity": 4, "section": "spells"},
            {"name": "Goblin Grenade", "quantity": 4, "section": "spells"},
            {"name": "Shock", "quantity": 4, "section": "spells"},
            {"name": "Flame Slash", "quantity": 2, "section": "spells"},
            {"name": "Mountain", "quantity": 20, "section": "lands"},
        ],
    }
