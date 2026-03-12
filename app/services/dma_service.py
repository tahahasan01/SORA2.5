"""
DMA service — orchestrates database operations and delegates scoring
to the independent engine module.

Endpoints served:
  GET  /dma/questions         → list all questions grouped by dimension
  POST /dma/assess            → submit assessment, persist, score
  GET  /dma/results/{id}      → retrieve persisted maturity report
  POST /dma/evaluate (legacy) → lightweight score without persisting
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.engine.dma_scoring_engine import (
    AssessmentOutput,
    QuestionInput,
    ResponseInput,
    compute_assessment,
    compute_dimension_score,
    score_to_maturity,
)
from app.models.dma import (
    DmaAssessment,
    DmaDimension,
    DmaDimensionScore,
    DmaQuestion,
    DmaResponseEntry,
)
from app.schemas.dma import (
    AssessmentRequest,
    AssessmentResultResponse,
    DimensionQuestionsOut,
    DimensionScoreOut,
    DmaEvaluateRequest,
    DmaEvaluateResponse,
    QuestionOut,
)

MAX_SCORE = 5

MATURITY_LABELS: dict[int, str] = {
    1: "Initial",
    2: "Developing",
    3: "Defined",
    4: "Managed",
    5: "Optimizing",
}


class DmaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── GET /dma/questions ────────────────────────────────────

    async def get_questions(self) -> list[DimensionQuestionsOut]:
        """Return all active questions grouped by dimension."""
        stmt = (
            select(DmaDimension)
            .options(selectinload(DmaDimension.questions))
            .order_by(DmaDimension.name)
        )
        result = await self.db.execute(stmt)
        dimensions = result.scalars().unique().all()

        out: list[DimensionQuestionsOut] = []
        for dim in dimensions:
            active_qs = [q for q in dim.questions if q.active]
            if not active_qs:
                continue
            out.append(DimensionQuestionsOut(
                dimension_id=dim.id,
                dimension_name=dim.name,
                description=dim.description,
                questions=[
                    QuestionOut(
                        id=q.id,
                        question_key=q.question_key,
                        question_text=q.question_text,
                        weight=q.weight,
                    )
                    for q in sorted(active_qs, key=lambda x: x.question_key)
                ],
            ))
        return out

    # ── POST /dma/assess ──────────────────────────────────────

    async def submit_assessment(self, req: AssessmentRequest) -> AssessmentResultResponse:
        """Persist responses, compute scores, store dimension scores, return report."""

        # 1. Load all active questions with dimension info
        stmt = (
            select(DmaQuestion)
            .options(selectinload(DmaQuestion.dimension_rel))
            .where(DmaQuestion.active.is_(True))
        )
        result = await self.db.execute(stmt)
        all_questions = result.scalars().all()
        q_map = {str(q.id): q for q in all_questions}

        # 2. Validate that all response question_ids exist
        for resp in req.responses:
            if str(resp.question_id) not in q_map:
                raise ValueError(f"Unknown question_id: {resp.question_id}")

        # 3. Create assessment record
        assessment = DmaAssessment(organization_name=req.organization)
        self.db.add(assessment)
        await self.db.flush()

        # 4. Persist response rows
        for resp in req.responses:
            self.db.add(DmaResponseEntry(
                assessment_id=assessment.id,
                question_id=resp.question_id,
                score=resp.score,
            ))
        await self.db.flush()

        # 5. Build engine inputs and compute
        engine_questions = [
            QuestionInput(
                question_id=str(q.id),
                question_key=q.question_key,
                dimension_name=q.dimension_rel.name,
                weight=q.weight,
            )
            for q in all_questions
        ]
        engine_responses = [
            ResponseInput(question_id=str(r.question_id), score=r.score)
            for r in req.responses
        ]
        output: AssessmentOutput = compute_assessment(engine_questions, engine_responses)

        # 6. Persist dimension scores
        dim_name_to_id: dict[str, UUID] = {}
        for q in all_questions:
            dim_name_to_id[q.dimension_rel.name] = q.dimension_rel.id

        for dr in output.dimension_results:
            did = dim_name_to_id.get(dr.dimension_name)
            if did is None:
                continue
            self.db.add(DmaDimensionScore(
                assessment_id=assessment.id,
                dimension_id=did,
                score=dr.weighted_score,
                percentage=dr.percentage,
            ))

        await self.db.flush()

        # 7. Build response
        return self._build_result(assessment, output)

    # ── GET /dma/results/{id} ─────────────────────────────────

    async def get_results(self, assessment_id: UUID) -> AssessmentResultResponse:
        """Load a previously computed assessment and re-score from stored responses."""
        stmt = (
            select(DmaAssessment)
            .options(
                selectinload(DmaAssessment.responses).selectinload(DmaResponseEntry.question).selectinload(DmaQuestion.dimension_rel),
                selectinload(DmaAssessment.dimension_scores).selectinload(DmaDimensionScore.dimension),
            )
            .where(DmaAssessment.id == assessment_id)
        )
        result = await self.db.execute(stmt)
        assessment = result.scalars().first()
        if assessment is None:
            raise ValueError(f"Assessment {assessment_id} not found")

        # Re-compute from the stored responses using the engine
        all_questions_stmt = (
            select(DmaQuestion)
            .options(selectinload(DmaQuestion.dimension_rel))
            .where(DmaQuestion.active.is_(True))
        )
        q_result = await self.db.execute(all_questions_stmt)
        all_questions = q_result.scalars().all()

        engine_questions = [
            QuestionInput(
                question_id=str(q.id),
                question_key=q.question_key,
                dimension_name=q.dimension_rel.name,
                weight=q.weight,
            )
            for q in all_questions
        ]
        engine_responses = [
            ResponseInput(question_id=str(r.question_id), score=r.score)
            for r in assessment.responses
        ]
        output = compute_assessment(engine_questions, engine_responses)
        return self._build_result(assessment, output)

    # ── Legacy POST /dma/evaluate ─────────────────────────────

    async def evaluate_legacy(self, req: DmaEvaluateRequest) -> DmaEvaluateResponse:
        """Lightweight evaluation: score a single dimension without persisting."""
        stmt = (
            select(DmaQuestion)
            .options(selectinload(DmaQuestion.dimension_rel))
            .join(DmaDimension, DmaQuestion.dimension_id == DmaDimension.id)
            .where(DmaDimension.name.ilike(req.dimension), DmaQuestion.active.is_(True))
        )
        result = await self.db.execute(stmt)
        questions = result.scalars().all()

        if not questions:
            raise ValueError(f"No questions found for dimension '{req.dimension}'")

        engine_qs = [
            QuestionInput(
                question_id=str(q.id),
                question_key=q.question_key,
                dimension_name=q.dimension_rel.name,
                weight=q.weight,
            )
            for q in questions
        ]
        resp_map = {str(q.id): int(req.scores[q.question_key])
                    for q in questions if q.question_key in req.scores}

        dim_result = compute_dimension_score(engine_qs, resp_map)
        if dim_result is None:
            raise ValueError("No valid scores provided for this dimension")

        raw = sum(
            min(max(int(req.scores.get(q.question_key, 0)), 0), MAX_SCORE) * q.weight
            for q in questions if q.question_key in req.scores
        )
        max_w = sum(MAX_SCORE * q.weight for q in questions)

        maturity_level = self._pct_to_level(dim_result.percentage)

        return DmaEvaluateResponse(
            dimension=req.dimension,
            raw_weighted_score=round(raw, 2),
            max_weighted_score=round(max_w, 2),
            normalised_pct=dim_result.percentage,
            maturity_level=maturity_level,
            maturity_label=MATURITY_LABELS[maturity_level],
        )

    # ── Helpers ───────────────────────────────────────────────

    @staticmethod
    def _pct_to_level(pct: float) -> int:
        if pct <= 20:
            return 1
        if pct <= 40:
            return 2
        if pct <= 60:
            return 3
        if pct <= 80:
            return 4
        return 5

    @staticmethod
    def _build_result(assessment: DmaAssessment, output: AssessmentOutput) -> AssessmentResultResponse:
        dim_pcts: dict[str, float] = {
            dr.dimension_name: dr.percentage for dr in output.dimension_results
        }
        breakdown = [
            DimensionScoreOut(
                dimension=dr.dimension_name,
                score=dr.weighted_score,
                percentage=dr.percentage,
                maturity_level=dr.maturity_level,
            )
            for dr in output.dimension_results
        ]
        return AssessmentResultResponse(
            assessment_id=assessment.id,
            organization=assessment.organization_name,
            dimension_scores=dim_pcts,
            overall_score=output.overall_score,
            maturity_level=output.overall_maturity,
            breakdown=breakdown,
        )
