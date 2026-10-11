import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.cards.dtos import CardSearchResponseDTO, CardSearchResultDTO
from app.services import scryfall_service

_log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/cards/search", response_model=CardSearchResponseDTO)
async def search_cards(
    # Signed-in only: every miss costs a rate-limited Scryfall request.
    _user_id: Annotated[str, Depends(get_current_user)],
    q: str = Query(..., min_length=2, max_length=100, description="Card name, or part of one"),
) -> CardSearchResponseDTO:
    """Search real cards by name, for adding cards to a deck by hand."""
    try:
        cards = await scryfall_service.search_cards_by_name(q)
    except (httpx.HTTPError, ValueError):
        _log.exception("Scryfall name search failed (q=%r)", q)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Card search is unavailable right now. Please try again.",
        )
    return CardSearchResponseDTO(cards=[CardSearchResultDTO(**card) for card in cards])
