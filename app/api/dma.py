"""
DMA API routes.

GET  /dma/questions              → all questions grouped by dimension
POST /dma/assess                 → submit full assessment, persist, score
GET  /dma/results/{assessment_id} → retrieve persisted maturity report
POST /dma/evaluate               → lightweight single-dimension score (legacy)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.dma import (
    AssessmentRequest,
    AssessmentResultResponse,
    DimensionQuestionsOut,
    DmaEvaluateRequest,
    DmaEvaluateResponse,
)
from app.services.dma_service import DmaService

router = APIRouter()


@router.get("/questions", response_model=list[DimensionQuestionsOut])
async def list_questions(db: AsyncSession = Depends(get_db)):
    """Return all active questions grouped by dimension."""
    svc = DmaService(db)
    return await svc.get_questions()


@router.post("/assess", response_model=AssessmentResultResponse)
async def submit_assessment(
    body: AssessmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Accept questionnaire responses, persist, compute maturity report."""
    svc = DmaService(db)
    try:
        return await svc.submit_assessment(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/results/{assessment_id}", response_model=AssessmentResultResponse)
async def get_results(
    assessment_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a previously computed maturity report."""
    svc = DmaService(db)
    try:
        return await svc.get_results(assessment_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/evaluate", response_model=DmaEvaluateResponse)
async def evaluate_dma(
    body: DmaEvaluateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Lightweight single-dimension evaluation (backward compatible)."""
    svc = DmaService(db)
    try:
        return await svc.evaluate_legacy(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
