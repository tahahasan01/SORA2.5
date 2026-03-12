"""Pydantic v2 schemas for the DMA (Drone Maturity Assessment) module."""

from uuid import UUID

from pydantic import BaseModel, Field


# ── GET /dma/questions ────────────────────────────────────────

class QuestionOut(BaseModel):
    id: UUID
    question_key: str
    question_text: str
    weight: float

    model_config = {"from_attributes": True}


class DimensionQuestionsOut(BaseModel):
    dimension_id: UUID
    dimension_name: str
    description: str
    questions: list[QuestionOut]


# ── POST /dma/assess ─────────────────────────────────────────

class ResponseIn(BaseModel):
    question_id: UUID
    score: int = Field(..., ge=1, le=5, description="Maturity score 1–5")


class AssessmentRequest(BaseModel):
    organization: str = Field(..., min_length=1, description="Organization name")
    responses: list[ResponseIn] = Field(..., min_length=1)


# ── GET /dma/results/{id} ────────────────────────────────────

class DimensionScoreOut(BaseModel):
    dimension: str
    score: float = Field(..., description="Weighted average 1–5")
    percentage: float = Field(..., description="(score/5) * 100")
    maturity_level: str


class AssessmentResultResponse(BaseModel):
    assessment_id: UUID
    organization: str
    dimension_scores: dict[str, float] = Field(
        ..., description="dimension_name → percentage"
    )
    overall_score: float = Field(..., description="Average percentage across dimensions")
    maturity_level: str
    breakdown: list[DimensionScoreOut]


# ── Legacy POST /dma/evaluate (backward compat) ──────────────

class DmaEvaluateRequest(BaseModel):
    dimension: str = Field(..., min_length=1, description="Dimension name, e.g. 'Operations'")
    scores: dict[str, float] = Field(
        ..., min_length=1,
        description="Map of question_key → score (1–5)",
    )


class DmaEvaluateResponse(BaseModel):
    dimension: str
    raw_weighted_score: float
    max_weighted_score: float
    normalised_pct: float = Field(..., description="Percentage 0–100")
    maturity_level: int = Field(..., ge=1, le=5)
    maturity_label: str
