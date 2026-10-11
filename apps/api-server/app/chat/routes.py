import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.auth.dependencies import get_current_user
from app.chat.dtos import ChatRequestDTO, ChatResponseDTO
from app.chat.service import ChatProviderUnavailable, ChatValidationError, chat_with_grimoire
from app.core.disconnect import ClientDisconnected, run_until_disconnect

_log = logging.getLogger(__name__)

router = APIRouter()

# nginx's "client closed request": never seen by the client, only by logs and metrics.
_CLIENT_CLOSED_REQUEST = 499


@router.post("/chat", response_model=ChatResponseDTO)
async def chat(
    request: ChatRequestDTO,
    http_request: Request,
    # Every turn is an LLM call, so chat needs an account.
    user_id: Annotated[str, Depends(get_current_user)],
) -> ChatResponseDTO | Response:
    try:
        # A stopped message aborts the fetch; that closes the connection, and the
        # LLM call is cancelled rather than finishing a reply nobody will read.
        reply = await run_until_disconnect(http_request, chat_with_grimoire(request.messages, request.context))
    except ClientDisconnected:
        _log.info("Chat cancelled by the client (user_id=%s)", user_id)
        return Response(status_code=_CLIENT_CLOSED_REQUEST)
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except ChatProviderUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return ChatResponseDTO(message=reply)
