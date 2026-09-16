"""
Parent-facing shapes. README §2A: understandable terms only — "Learning
Progress", "Topics to Review", never raw model internals or clinical framing.
"""
from datetime import datetime

from pydantic import BaseModel


class CreateChildRequest(BaseModel):
    nickname: str
    birth_year_month: str  # "2020-03" — age band only, no full birthdate
    initial_interests: list[str] = []  # theme codes, README §5: "approximately 4-5"


class ChildOut(BaseModel):
    id: str
    nickname: str
    birth_year_month: str

    model_config = {"from_attributes": True}


class DomainProgress(BaseModel):
    domain_code: str
    domain_label: str
    mastery_percent: int  # 0-100, rounded for display


class TopicToReview(BaseModel):
    topic_id: str
    topic_code: str
    topic_label: str
    retention_percent: int  # RetentionModel's forgetting-curve estimate, not raw mastery (docs/PLAN.md Phase 5)


class InterestOut(BaseModel):
    theme_code: str
    theme_label: str
    level: str  # "high_interest" | "steady" | "still_building" | "still_discovering"


class RecommendationOut(BaseModel):
    id: str
    kind: str
    payload: dict
    generated_at: datetime
    response: str | None

    model_config = {"from_attributes": True}


class SessionHistoryItem(BaseModel):
    id: str
    started_at: datetime
    ended_at: datetime | None
    actual_minutes: float | None
    end_reason: str | None

    model_config = {"from_attributes": True}


class ChildSummaryOut(BaseModel):
    learning_minutes_total: float
    activities_completed: int
    domains: list[DomainProgress]
    topics_to_review: list[TopicToReview]
    interests: list[InterestOut]
    todays_suggestions: list[RecommendationOut]
    recent_sessions: list[SessionHistoryItem]
    recommended_session_minutes: float | None  # README §19; None until a session has finished


class RecommendationResponseRequest(BaseModel):
    response: str  # "accepted" | "skipped"


class ConsentOut(BaseModel):
    scope: str
    granted: bool
    granted_at: datetime


class ConsentUpdateRequest(BaseModel):
    scope: str  # data_collection | camera | research_use
    granted: bool


class LinkEducatorRequest(BaseModel):
    educator_email: str


class EducatorLinkOut(BaseModel):
    id: str
    display_name: str
    email: str
    role: str
