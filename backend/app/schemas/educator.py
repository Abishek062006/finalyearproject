from pydantic import BaseModel

from app.schemas.parent import ChildOut, DomainProgress


class ArmEvidence(BaseModel):
    arm_code: str
    label: str
    trials: int
    accuracy_percent: int
    is_current_winner: bool


class AxisEvidence(BaseModel):
    axis_code: str
    axis_label: str
    arms: list[ArmEvidence]
    winner_confidence: int | None  # percent, None until a winner is confirmed
    evidence_trials: int


class EducatorChildProfile(BaseModel):
    child_id: str
    nickname: str
    domains: list[DomainProgress]
    axes: list[AxisEvidence]


class TopicOut(BaseModel):
    id: str
    code: str
    label: str
    domain_id: str

    model_config = {"from_attributes": True}


class AssignTopicRequest(BaseModel):
    topic_code: str


class LockRequest(BaseModel):
    axis_code: str
    arm_code: str
    allow: bool


class LockOut(BaseModel):
    axis_code: str
    arm_code: str
    allow: bool


__all__ = ["ChildOut", "ArmEvidence", "AxisEvidence", "EducatorChildProfile", "TopicOut", "AssignTopicRequest", "LockRequest", "LockOut"]
