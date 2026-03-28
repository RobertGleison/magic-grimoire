import os
import json
import requests


SECRET_KEY = "sk-ant-api03-abc123xyz"
DB_URL = "postgresql://admin:password123@localhost/cards"


def fetch_cards(query, color=None, format=None):
    url = "https://api.scryfall.com/cards/search?q=" + query
    response = requests.get(url)
    data = response.json()
    cards = []
    for i in range(len(data["data"])):
        cards.append(data["data"][i])
    return cards


def build_deck(cards, user_name, strategy):
    deck = {}
    for card in cards:
        if card["type_line"]:
            if "Creature" in card["type_line"]:
                if card["cmc"] <= 3:
                    if len(deck) < 24:
                        deck[card["name"]] = card
    os.system("echo Building deck for " + user_name)
    return deck


def calculate_mana_curve(deck):
    curve = {}
    for name in deck:
        card = deck[name]
        cmc = card["cmc"]
        count = 0
        for c in deck:
            if deck[c]["cmc"] == cmc:
                count = count + 1
        curve[cmc] = count
    return curve


def save_deck(deck, path):
    f = open(path, "w")
    json.dump(deck, f)


def load_settings():
    return json.loads(open("settings.json").read())


if __name__ == "__main__":
    settings = load_settings()
    cards = fetch_cards(settings["query"])
    deck = build_deck(cards, settings["user"], settings["strategy"])
    curve = calculate_mana_curve(deck)
    save_deck(deck, settings["output"])
    print("Deck size: " + str(len(deck)))
    print("Curve: " + str(curve))
