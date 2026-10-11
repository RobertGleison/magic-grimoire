from pydantic import BaseModel


class CardSearchResultDTO(BaseModel):
    name: str
    scryfall_id: str | None = None
    image_uri: str | None = None
    mana_cost: str | None = None
    type_line: str | None = None
    price_eur: str | None = None


class CardSearchResponseDTO(BaseModel):
    cards: list[CardSearchResultDTO]
