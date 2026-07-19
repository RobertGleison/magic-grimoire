from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_optional_user
from app.chat.dtos import ChatRequestDTO, ChatResponseDTO
from app.chat.service import ChatProviderUnavailable, ChatValidationError, chat_with_grimoire

router = APIRouter()


@router.post("/chat", response_model=ChatResponseDTO)
async def chat(
    request: ChatRequestDTO,
    user_id: Annotated[str | None, Depends(get_optional_user)],
) -> ChatResponseDTO:
    try:
        reply = await chat_with_grimoire(request.messages, request.context)
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except ChatProviderUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return ChatResponseDTO(message=reply)
