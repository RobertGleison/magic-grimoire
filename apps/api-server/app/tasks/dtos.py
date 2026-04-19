from pydantic import BaseModel


class TaskStatusResponseDTO(BaseModel):
    id: str
    status: str
    message: str | None = None
