"""
Importing this package registers every model on app.db.Base, so
Base.metadata.create_all() (app/db.py:init_db) creates the whole schema.

See docs/SCHEMA.md for the table dictionary these mirror, group by group.
"""
from app.models.identity import Child, Consent, EducatorLink, Guardianship, User  # noqa: F401
from app.models.curriculum import (  # noqa: F401
    ActivityTemplate,
    Domain,
    Guide,
    Item,
    ItemSet,
    Theme,
    Topic,
)
from app.models.runtime import (  # noqa: F401
    ActivityInstance,
    ActivityInstanceAssignment,
    Interaction,
    InterventionEvent,
    ScheduledProbe,
    Session,
)
from app.models.profile_state import (  # noqa: F401
    EngagementState,
    InterestState,
    MasteryState,
    ModalityState,
    RetentionState,
)
from app.models.experiment import (  # noqa: F401
    Arm,
    ArmLock,
    Assignment,
    Axis,
    Outcome,
    PolicyVersion,
    Verdict,
)
from app.models.adults import Override, Recommendation  # noqa: F401
from app.models.telemetry import CrashReport  # noqa: F401
