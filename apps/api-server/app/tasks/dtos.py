from pydantic import BaseModel

from app.core.enums import TaskStatus


class TaskStatusResponseDTO(BaseModel):
    id: str
    status: TaskStatus
    message: str | None = None
