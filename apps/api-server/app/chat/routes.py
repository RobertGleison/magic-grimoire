from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_optional_user
from app.chat.dtos import ChatRequestDTO, ChatResponseDTO
from app.chat.service import chat_with_grimoire
from app.core.guards import sanitize_prompt

router = APIRouter()


@router.post("/chat", response_model=ChatResponseDTO)
async def chat(
    request: ChatRequestDTO,
    user_id: Annotated[str | None, Depends(get_optional_user)],
) -> ChatResponseDTO:
    for m in request.messages:
        if m.role == "user":
            valid, rejection = sanitize_prompt(m.content)
            if not valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=rejection)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    reply = await chat_with_grimoire(messages, request.context)
    return ChatResponseDTO(message=reply)
