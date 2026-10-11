import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.chat.dtos import ChatRequestDTO, ChatResponseDTO
from app.chat.service import (
    ChatDeckNotFound,
    ChatProviderUnavailable,
    ChatValidationError,
    chat_with_grimoire,
    load_deck_context,
)
from app.core.database import get_db
from app.core.disconnect import ClientDisconnected, run_until_disconnect

_log = logging.getLogger(__name__)

router = APIRouter()

# nginx's "client closed request": never seen by the client, only by logs and metrics.
_CLIENT_CLOSED_REQUEST = 499


@router.post("/chat", response_model=ChatResponseDTO)
async def chat(
    request: ChatRequestDTO,
    http_request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    # Every turn is an LLM call, so chat needs an account.
    user_id: Annotated[str, Depends(get_current_user)],
) -> ChatResponseDTO | Response:
    deck_context: str | None = None
    if request.deck_id is not None:
        try:
            loaded = await load_deck_context(db, request.deck_id, user_id, request.selected_cards)
            deck_context = loaded.prompt_text()
        except ChatDeckNotFound as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except SQLAlchemyError:
            _log.exception("Database error loading chat deck %s", request.deck_id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Deck storage is temporarily unavailable. Please try again shortly.",
            )
        # End the read transaction now: the LLM call can take many seconds, and
        # holding a pooled connection across it starves everyone else.
        await db.rollback()

    try:
        # A stopped message aborts the fetch; that closes the connection, and the
        # LLM call is cancelled rather than finishing a reply nobody will read.
        reply = await run_until_disconnect(
            http_request, chat_with_grimoire(request.messages, request.context, deck_context)
        )
    except ClientDisconnected:
        _log.info("Chat cancelled by the client (user_id=%s)", user_id)
        return Response(status_code=_CLIENT_CLOSED_REQUEST)
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except ChatProviderUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return ChatResponseDTO(message=reply)
