"""
ORM models for SORA 2.5 — all regulatory lookup tables.

Uses PostgreSQL range types (numrange, int4range) so GRC/SAIL lookups
are pure SQL containment queries, not Python if/else chains.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, NUMRANGE, INT4RANGE
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SoraVersion(Base):
    """Tracks which SORA version (e.g. 2.5, future 2.6) is active."""

    __tablename__ = "sora_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_label: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GrcMatrix(Base):
    """
    Ground Risk Class lookup using PostgreSQL numrange for kinetic-energy bands.

    Query: SELECT igrc FROM grc_matrix
           WHERE ke_range @> :kinetic_energy::numeric
             AND population_density = :band
             AND sora_version_id = :ver;
    """

    __tablename__ = "grc_matrix"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sora_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sora_versions.id"), nullable=False
    )
    # numrange for kinetic energy in joules — uses @> containment operator
    ke_range = Column(NUMRANGE(), nullable=False)
    population_density: Mapped[str] = mapped_column(String(30), nullable=False)
    igrc: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SailMatrix(Base):
    """
    SAIL lookup: final-GRC range × ARC → SAIL level.

    Uses int4range for GRC so a single row covers a GRC band.
    """

    __tablename__ = "sail_matrix"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sora_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sora_versions.id"), nullable=False
    )
    grc_range = Column(INT4RANGE(), nullable=False)
    arc: Mapped[str] = mapped_column(String(10), nullable=False)  # ARC-a … ARC-d
    sail: Mapped[int] = mapped_column(Integer, nullable=False)     # I–VI stored as 1–6

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OsoCatalogue(Base):
    """The 17 SORA 2.5 Operational Safety Objectives."""

    __tablename__ = "oso_catalogue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sora_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sora_versions.id"), nullable=False
    )
    oso_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–17
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OsoSailRequirement(Base):
    """Per-OSO robustness requirement for each SAIL level (1–6)."""

    __tablename__ = "oso_sail_requirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oso_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("oso_catalogue.id", ondelete="CASCADE"), nullable=False
    )
    sail_level: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–6
    # O = Optional, L = Low, M = Medium, H = High
    robustness: Mapped[str] = mapped_column(String(1), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CountryRule(Base):
    """Country-specific CAA overrides."""

    __tablename__ = "country_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sora_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sora_versions.id"), nullable=False
    )
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    rule_key: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GrcMitigation(Base):
    """
    GRC mitigation lookup (M1 / M2 / M3).

    M1 — Strategic mitigations (reduce population exposure)
    M2 — Effects reduction (parachute, frangibility)
    M3 — Emergency Response Plan (ERP)

    Each robustness level maps to a GRC reduction value.
    """

    __tablename__ = "grc_mitigations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sora_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sora_versions.id"), nullable=False
    )
    mitigation_type: Mapped[str] = mapped_column(String(5), nullable=False)   # M1, M2, M3
    robustness: Mapped[str] = mapped_column(String(10), nullable=False)       # low, medium, high
    grc_reduction: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
