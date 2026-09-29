"""
Parent-facing shapes. README §2A: understandable terms only — "Learning
Progress", "Topics to Review", never raw model internals or clinical framing.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class CreateChildRequest(BaseModel):
    nickname: str
    birth_year_month: str  # "2020-03" — age band only, no full birthdate
    initial_interests: list[str] = []  # theme codes, README §5: "approximately 4-5"


class ChildInterestOut(BaseModel):
    id: str
    label: str
    image_url: str
    is_favourite: bool

    model_config = {"from_attributes": True}


class ChildOut(BaseModel):
    id: str
    nickname: str
    birth_year_month: str
    companion_name: str | None = None
    companion_image_url: str | None = None
    communication_level: str | None = None
    sensory: list[str] = []
    goals: list[str] = []
    interests: list[ChildInterestOut] = []
    buddy: str = "Pip"  # the on-screen friend's name (Child.buddy)

    model_config = {"from_attributes": True}


class OnboardInterest(BaseModel):
    label: str
    image_url: str  # must be a URL the /interests/search endpoint just returned
    source_title: str
    favourite: bool = False


class OnboardChildRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=40)
    birth_year_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    communication_level: str | None = None
    sensory: list[str] = []
    goals: list[str] = []
    interests: list[OnboardInterest] = []


class ChildProfilePatch(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=40)
    birth_year_month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    communication_level: str | None = None
    sensory: list[str] | None = None
    goals: list[str] | None = None
    buddy_name: str | None = Field(default=None, max_length=20)  # "" resets to the default "Pip"


class AddInterestRequest(BaseModel):
    label: str
    image_url: str
    source_title: str
    favourite: bool = False


class CompanionCandidate(BaseModel):
    image_url: str  # a real, live URL (Wikimedia) — not yet downloaded/stored
    thumb_url: str | None = None  # small version for display in the app
    source_title: str
    license: str


class CompanionSearchRequest(BaseModel):
    query: str  # free text the parent typed, e.g. "trains", "unicorns"


class CompanionConfirmRequest(BaseModel):
    query: str
    image_url: str  # must be one of the candidate URLs just returned by /search
    source_title: str


class CompanionOut(BaseModel):
    companion_name: str
    companion_image_url: str


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
