"""
ORM models for the DMA (Drone Maturity Assessment) module.

Tables:
  - dma_dimensions    maturity categories (Governance, Operations, …)
  - dma_questions     scored items belonging to a dimension
  - dma_assessments   one per organizational evaluation
  - dma_responses     individual answer rows
  - dma_dimension_scores  computed per-dimension results
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class DmaDimension(Base):
    """A maturity assessment category (e.g. Governance, Operations)."""

    __tablename__ = "dma_dimensions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")

    questions: Mapped[list["DmaQuestion"]] = relationship(back_populates="dimension_rel", lazy="selectin")


class DmaQuestion(Base):
    """One scored question belonging to a dimension."""

    __tablename__ = "dma_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dma_dimensions.id"), nullable=False
    )
    question_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    dimension_rel: Mapped["DmaDimension"] = relationship(back_populates="questions")


class DmaAssessment(Base):
    """One organizational evaluation run."""

    __tablename__ = "dma_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_name: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    responses: Mapped[list["DmaResponseEntry"]] = relationship(
        back_populates="assessment", lazy="selectin", cascade="all, delete-orphan"
    )
    dimension_scores: Mapped[list["DmaDimensionScore"]] = relationship(
        back_populates="assessment", lazy="selectin", cascade="all, delete-orphan"
    )


class DmaResponseEntry(Base):
    """One answer to one question within an assessment."""

    __tablename__ = "dma_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dma_assessments.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dma_questions.id"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)

    assessment: Mapped["DmaAssessment"] = relationship(back_populates="responses")
    question: Mapped["DmaQuestion"] = relationship(lazy="selectin")


class DmaDimensionScore(Base):
    """Computed per-dimension result for an assessment."""

    __tablename__ = "dma_dimension_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dma_assessments.id", ondelete="CASCADE"), nullable=False
    )
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dma_dimensions.id"), nullable=False
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False)

    assessment: Mapped["DmaAssessment"] = relationship(back_populates="dimension_scores")
    dimension: Mapped["DmaDimension"] = relationship(lazy="selectin")
