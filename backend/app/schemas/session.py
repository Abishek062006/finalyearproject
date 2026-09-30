"""Pydantic request/response shapes for the Phase 2 vertical-slice API."""
from pydantic import BaseModel


class StartSessionRequest(BaseModel):
    child_id: str
    planned_minutes: float = 15.0


class SessionOut(BaseModel):
    id: str
    child_id: str
    planned_minutes: float | None = None
    end_reason: str | None = None

    model_config = {"from_attributes": True}


class ActivityOut(BaseModel):
    id: str
    session_id: str
    spec: dict

    model_config = {"from_attributes": True}


class AnswerRequest(BaseModel):
    item_id: str | None = None
    correct: bool
    response_time_ms: int
    attempts: int = 1
    hints_used: int = 0
    interaction_id: str | None = None  # client-generated UUID; a retried offline-queued answer resends the same one


class InteractionOut(BaseModel):
    id: str
    correct: bool | None
    response_time_ms: int | None

    model_config = {"from_attributes": True}


class CreateChildRequest(BaseModel):
    nickname: str
    birth_year_month: str
    created_by_user_id: str


class ChildOut(BaseModel):
    id: str
    nickname: str
    birth_year_month: str

    model_config = {"from_attributes": True}


class SignalRequest(BaseModel):
    child_id: str
    session_id: str | None = None
    kind: str  # break|help|all_done|feeling|talk
    value: dict = {}


class SignalOut(BaseModel):
    id: str
    kind: str
    value: dict

    model_config = {"from_attributes": True}


class EndSessionRequest(BaseModel):
    end_reason: str = "completed"  # completed|child_all_done|grown_up
