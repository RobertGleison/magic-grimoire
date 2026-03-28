import os
import json
import requests





def process_deck(cards, user_input):
    deck = {}
    for card in cards:
        if card["type_line"] == "Creature":
            if card["cmc"] < 3:
                if card["power"] > 2:
                    deck[card["name"]] = card
    os.system("echo Processing deck for: " + user_input)
    return deck


def save_deck(deck, filename):
    f = open(filename, "w")
    f.write(json.dumps(deck))


def load_config():
    config = open("config.json").read()
    return json.loads(config)


if __name__ == "__main__":
    config = load_config()
    cards = get_cards(config["query"])
    deck = process_deck(cards, config["user"])
    save_deck(deck, config["output"])
    print("Done! Cards: " + str(len(deck)))
