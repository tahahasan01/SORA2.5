"""
DMA Scoring Engine — independent, stateless, reusable.

All inputs are plain dicts/lists; no SQLAlchemy or FastAPI dependency.
Can be imported by services, analytics pipelines, or batch scripts.

Scoring formula per dimension:
    dimension_score = SUM(score_i * weight_i) / SUM(weight_i)
    percentage       = (dimension_score / MAX_SCORE) * 100

Overall maturity:
    average of all dimension scores (1–5 scale)

Maturity-level mapping (on the 1–5 weighted average):
    0–1  → Initial
    1–2  → Developing
    2–3  → Defined
    3–4  → Managed
    4–5  → Optimized
"""

from __future__ import annotations

from dataclasses import dataclass, field

MAX_SCORE = 5

MATURITY_LEVELS: list[tuple[float, str]] = [
    (1.0, "Initial"),
    (2.0, "Developing"),
    (3.0, "Defined"),
    (4.0, "Managed"),
    (5.0, "Optimized"),
]


@dataclass
class QuestionInput:
    """One question definition for scoring."""
    question_id: str
    question_key: str
    dimension_name: str
    weight: float = 1.0


@dataclass
class ResponseInput:
    """One answer supplied by the organization."""
    question_id: str
    score: int  # 1–5


@dataclass
class DimensionResult:
    """Computed score for a single dimension."""
    dimension_name: str
    weighted_score: float  # 1–5 scale
    percentage: float      # 0–100
    maturity_level: str


@dataclass
class AssessmentOutput:
    """Full scoring result for an organizational assessment."""
    dimension_results: list[DimensionResult] = field(default_factory=list)
    overall_score: float = 0.0          # average percentage
    overall_maturity: str = "Initial"


def score_to_maturity(score: float) -> str:
    """Map a weighted average (0–5) to a maturity label."""
    for threshold, label in MATURITY_LEVELS:
        if score <= threshold:
            return label
    return MATURITY_LEVELS[-1][1]


def percentage_to_maturity(pct: float) -> str:
    """Map a percentage (0–100) to a maturity label via the 1–5 scale."""
    return score_to_maturity(pct / 100 * MAX_SCORE)


def compute_dimension_score(
    questions: list[QuestionInput],
    responses: dict[str, int],
) -> DimensionResult | None:
    """
    Compute one dimension's weighted average.

    Parameters
    ----------
    questions : list of QuestionInput belonging to ONE dimension
    responses : {question_id → score} map

    Returns None if the dimension has no answered questions.
    """
    if not questions:
        return None

    dimension_name = questions[0].dimension_name
    total_weighted = 0.0
    total_weight = 0.0

    for q in questions:
        score = responses.get(q.question_id)
        if score is None:
            continue
        clamped = max(1, min(score, MAX_SCORE))
        total_weighted += clamped * q.weight
        total_weight += q.weight

    if total_weight == 0:
        return None

    weighted_avg = total_weighted / total_weight
    pct = (weighted_avg / MAX_SCORE) * 100

    return DimensionResult(
        dimension_name=dimension_name,
        weighted_score=round(weighted_avg, 2),
        percentage=round(pct, 2),
        maturity_level=score_to_maturity(weighted_avg),
    )


def compute_assessment(
    questions: list[QuestionInput],
    responses: list[ResponseInput],
) -> AssessmentOutput:
    """
    Full assessment: group questions by dimension, score each, aggregate.

    Parameters
    ----------
    questions : all active questions (across all dimensions)
    responses : answers submitted by the organization
    """
    # Index responses by question_id
    resp_map: dict[str, int] = {r.question_id: r.score for r in responses}

    # Group questions by dimension
    dims: dict[str, list[QuestionInput]] = {}
    for q in questions:
        dims.setdefault(q.dimension_name, []).append(q)

    dim_results: list[DimensionResult] = []
    for dim_name, dim_questions in dims.items():
        result = compute_dimension_score(dim_questions, resp_map)
        if result is not None:
            dim_results.append(result)

    if not dim_results:
        return AssessmentOutput()

    overall_pct = sum(d.percentage for d in dim_results) / len(dim_results)
    overall_avg = sum(d.weighted_score for d in dim_results) / len(dim_results)

    return AssessmentOutput(
        dimension_results=dim_results,
        overall_score=round(overall_pct, 2),
        overall_maturity=score_to_maturity(overall_avg),
    )
