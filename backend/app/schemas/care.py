"""Request/response shapes for the grown-ups' care features (plan Phase 6)."""
from pydantic import BaseModel, Field


class JournalIn(BaseModel):
    day: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    sleep_hours: float | None = None
    mood: int | None = None
    tags: list[str] = []
    note: str = ""


class JournalOut(BaseModel):
    id: str
    day: str
    sleep_hours: float | None
    mood: int | None
    tags: list[str]
    note: str

    model_config = {"from_attributes": True}


class GoalIn(BaseModel):
    topic_code: str
    target_accuracy: int = 80
    target_sessions: int = 3
    statement: str | None = Field(default=None, max_length=240)


class GoalStatusIn(BaseModel):
    status: str


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class NoteOut(BaseModel):
    id: str
    author_name: str
    author_role: str
    text: str
    created_at: str

    @classmethod
    def of(cls, note) -> "NoteOut":
        return cls(id=note.id, author_name=note.author_name, author_role=note.author_role, text=note.text, created_at=note.created_at.isoformat())
