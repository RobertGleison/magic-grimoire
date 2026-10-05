from pydantic import BaseModel

from app.core.enums import TaskProgress, TaskStatus


class TaskStatusResponseDTO(BaseModel):
    id: str
    status: TaskStatus
    progress: TaskProgress | None = None
    message: str | None = None
