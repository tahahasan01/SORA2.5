"""Thin router for the SORA Builder endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.sora import SoraCalculateRequest, SoraCalculateResponse
from app.services.sora_service import SoraService

router = APIRouter()


@router.post("/calculate", response_model=SoraCalculateResponse)
async def calculate_sora(
    body: SoraCalculateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run a full SORA 2.5 risk assessment and return structured results."""
    svc = SoraService(db)
    try:
        return await svc.calculate(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
