"""Pydantic v2 schemas for the SORA Builder endpoint."""

from typing import Any

from pydantic import BaseModel, Field


# ── Request ───────────────────────────────────────────────────

class SoraCalculateRequest(BaseModel):
    # Core (required)
    mtom_grams: float = Field(..., gt=0, description="Max Take-Off Mass in grams")
    max_speed_ms: float = Field(..., gt=0, description="Max speed in m/s")
    characteristic_dimension_m: float = Field(..., gt=0, description="Max dimension in metres")
    population_density_band: str = Field(
        ..., pattern="^(sparsely_populated|populated|gathering|controlled_ground)$",
        description="One of: sparsely_populated, populated, gathering, controlled_ground",
    )
    arc: str = Field(
        ..., pattern="^ARC-[a-d]$",
        description="Air Risk Class: ARC-a through ARC-d",
    )
    altitude_m: float = Field(..., ge=0, description="Flight altitude AGL in metres")
    country_code: str | None = Field(None, max_length=3, description="ISO country code")

    # Extended (optional — informational + mitigation)
    drone_type: str | None = Field(
        None, max_length=100,
        description="Drone model/type name, e.g. 'DJI Mini 3', 'Custom Build'",
    )
    propulsion_type: str | None = Field(
        None, pattern="^(electric|combustion|hybrid)$",
        description="Propulsion type: electric, combustion, hybrid",
    )
    endurance_min: float | None = Field(None, ge=0, description="Flight endurance in minutes")
    flight_frequency: str | None = Field(
        None, pattern="^(rare|occasional|frequent)$",
        description="Flight frequency: rare, occasional, frequent",
    )
    operational_scenario: str | None = Field(
        None, pattern="^(VLOS|BVLOS|extended_VLOS)$",
        description="VLOS, BVLOS, or extended_VLOS",
    )
    mitigation_m1: str = Field(
        "none", pattern="^(none|low|medium|high)$",
        description="M1 strategic mitigation robustness",
    )
    mitigation_m2: str = Field(
        "none", pattern="^(none|low|medium|high)$",
        description="M2 effects reduction robustness",
    )
    mitigation_m3: str = Field(
        "none", pattern="^(none|low|medium|high)$",
        description="M3 ERP robustness",
    )


# ── Response sub-models ───────────────────────────────────────

class OsoRequirement(BaseModel):
    oso_number: int
    title: str
    category: str | None = None
    robustness: str = Field(..., description="O / L / M / H")


class CountryFlag(BaseModel):
    rule_key: str
    description: str


class TraceEntry(BaseModel):
    """Single step in the calculation audit trail."""
    step: str
    description: str
    rule_source: str | None = None
    value: str = ""


# ── Response ──────────────────────────────────────────────────

class SoraCalculateResponse(BaseModel):
    # ── backward-compatible fields ──
    bypass_applied: bool = Field(False, description="True if ≤250 g / <25 m/s bypass was used")
    kinetic_energy_j: float | None = Field(None, description="KE in joules (null if bypassed)")
    igrc: int = Field(..., description="Initial Ground Risk Class (kept for backward compat)")
    sail: int = Field(..., description="SAIL level 1–6")
    arc: str
    oso_requirements: list[OsoRequirement]
    country_flags: list[CountryFlag] = Field(default_factory=list)

    # ── enhanced fields ──
    input_parameters: dict[str, Any] = Field(default_factory=dict, description="Echo of all inputs")
    initial_grc: int = Field(0, description="iGRC before mitigations")
    final_grc: int = Field(0, description="GRC after M1/M2/M3 mitigations")
    m1_reduction: int = Field(0, description="M1 strategic GRC reduction applied")
    m2_reduction: int = Field(0, description="M2 effects GRC reduction applied")
    m3_reduction: int = Field(0, description="M3 ERP GRC reduction applied")
    traceability: list[TraceEntry] = Field(default_factory=list, description="Step-by-step audit trail")
    assumptions: list[str] = Field(default_factory=list, description="Assumptions and informational flags")
