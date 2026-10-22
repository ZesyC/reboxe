from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timestamp_seconds: float = Field(ge=0, le=90)
    description: str = Field(min_length=1, max_length=500)


class VisualAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assessment: Literal["VISIBLE_DAMAGE", "NO_CLEAR_DAMAGE", "INSUFFICIENT_EVIDENCE"]
    observations: list[Observation] = Field(default_factory=list, max_length=16)
    limitations: list[str] = Field(default_factory=list, max_length=10)


def review_result(assessment: VisualAssessment, *, checksum: str, model_id: str,
                  revision: str, duration: float, timestamps: list[float]) -> dict:
    for item in assessment.observations:
        if item.timestamp_seconds > duration or not any(abs(item.timestamp_seconds - time) < 0.05 for time in timestamps):
            raise ValueError("Observation does not cite a sampled frame")
    return {
        "schemaVersion": "triage-v1", "modelId": model_id, "modelRevision": revision,
        "promptVersion": "unboxing-v1", "evidenceChecksum": checksum,
        "durationSeconds": duration, "sampledTimestamps": timestamps,
        "visualAssessment": assessment.model_dump(),
        "recommendation": "ADMIN_REVIEW", "financialAction": "NONE", "calibrated": False,
    }
