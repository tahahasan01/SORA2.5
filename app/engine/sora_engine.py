"""
SORA 2.5 Calculation Engine — pure Python, zero framework dependencies.

All regulatory data is injected via dataclass inputs; the engine itself
contains no DB queries, no hardcoded thresholds, and no framework imports.

Pipeline:
  validate → bypass check → KE → iGRC lookup → mitigations → final GRC →
  SAIL lookup → OSO mapping → traceability assembly.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Injected data-classes — populated from the database
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass(frozen=True)
class GrcEntry:
    """Single row from grc_matrix."""
    ke_lower: float | None  # None = unbounded
    ke_upper: float | None
    population_density: str
    igrc: int


@dataclass(frozen=True)
class MitigationEntry:
    """Single row from grc_mitigations."""
    mitigation_type: str   # M1, M2, M3
    robustness: str        # none, low, medium, high
    grc_reduction: int
    description: str


@dataclass(frozen=True)
class SailEntry:
    """Single row from sail_matrix."""
    grc_lower: int | None
    grc_upper: int | None
    arc: str
    sail: int


@dataclass(frozen=True)
class OsoEntry:
    """OSO with its robustness for a specific SAIL level."""
    oso_number: int
    title: str
    category: str | None
    robustness: str  # O, L, M, H


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Engine I/O
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class TraceStep:
    """Single audit-trail entry."""
    step: str
    description: str
    rule_source: str | None = None
    value: str = ""


@dataclass
class SoraInput:
    """All operational parameters for a SORA assessment."""
    mtom_grams: float
    max_speed_ms: float
    characteristic_dimension_m: float
    altitude_m: float
    population_density_band: str
    arc: str
    country_code: str | None = None
    propulsion_type: str | None = None
    endurance_min: float | None = None
    flight_frequency: str | None = None
    operational_scenario: str | None = None
    mitigation_m1: str = "none"
    mitigation_m2: str = "none"
    mitigation_m3: str = "none"


@dataclass
class SoraOutput:
    """Full SORA result with traceability."""
    bypass_applied: bool
    kinetic_energy_j: float | None
    initial_grc: int
    m1_reduction: int
    m2_reduction: int
    m3_reduction: int
    final_grc: int
    arc: str
    sail: int
    oso_requirements: list[OsoEntry]
    traceability: list[TraceStep] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Pure calculation functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_VALID_BANDS = {"controlled_ground", "sparsely_populated", "populated", "gathering"}
_VALID_ARCS = {"ARC-a", "ARC-b", "ARC-c", "ARC-d"}
_VALID_ROBUSTNESS = {"none", "low", "medium", "high"}


def validate_inputs(req: SoraInput) -> list[str]:
    """Return a list of validation errors (empty = valid)."""
    errors: list[str] = []
    if req.altitude_m > 120:
        errors.append("Altitude exceeds 120 m AGL — requires special authorisation")
    if req.mtom_grams <= 0:
        errors.append("MTOM must be positive")
    if req.max_speed_ms <= 0:
        errors.append("Max speed must be positive")
    if req.characteristic_dimension_m <= 0:
        errors.append("Characteristic dimension must be positive")
    if req.population_density_band not in _VALID_BANDS:
        errors.append(f"Invalid population density band: {req.population_density_band}")
    if req.arc not in _VALID_ARCS:
        errors.append(f"Invalid ARC: {req.arc}")
    for label, val in [("M1", req.mitigation_m1), ("M2", req.mitigation_m2), ("M3", req.mitigation_m3)]:
        if val not in _VALID_ROBUSTNESS:
            errors.append(f"Invalid {label} mitigation level: {val}")
    return errors


def compute_kinetic_energy(mass_kg: float, speed_ms: float) -> float:
    """KE = ½mv²"""
    return 0.5 * mass_kg * speed_ms ** 2


def is_bypass(mtom_grams: float, max_speed_ms: float) -> bool:
    """SORA 2.5 low-mass bypass: ≤250 g AND <25 m/s."""
    return mtom_grams <= 250 and max_speed_ms < 25


def lookup_grc(
    ke: float, band: str, table: list[GrcEntry],
) -> tuple[int, str]:
    """Find iGRC via range containment. Returns (igrc, rule_source)."""
    for e in table:
        lo = e.ke_lower if e.ke_lower is not None else float("-inf")
        hi = e.ke_upper if e.ke_upper is not None else float("inf")
        if e.population_density == band and lo <= ke < hi:
            return e.igrc, f"grc_matrix: KE∈[{e.ke_lower},{e.ke_upper}) × {band}"
    raise ValueError(f"No GRC matrix entry for KE={ke:.1f} J, band={band}")


def apply_mitigation(
    level: str, table: list[MitigationEntry], mit_type: str,
) -> tuple[int, str]:
    """Look up GRC reduction for a mitigation type+level. Returns (reduction, description)."""
    if level == "none":
        return 0, f"{mit_type}: No mitigation applied"
    for e in table:
        if e.mitigation_type == mit_type and e.robustness == level:
            return e.grc_reduction, f"{mit_type} ({level}): −{e.grc_reduction} GRC — {e.description}"
    return 0, f"{mit_type}: No matching entry for level '{level}'"


def lookup_sail(
    grc: int, arc: str, table: list[SailEntry],
) -> tuple[int, str]:
    """Find SAIL via range containment. Returns (sail, rule_source)."""
    for e in table:
        lo = e.grc_lower if e.grc_lower is not None else -999
        hi = e.grc_upper if e.grc_upper is not None else 999
        if e.arc == arc and lo <= grc < hi:
            return e.sail, f"sail_matrix: GRC∈[{e.grc_lower},{e.grc_upper}) × {arc}"
    raise ValueError(f"No SAIL entry for GRC={grc}, ARC={arc}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main orchestration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_sora(
    req: SoraInput,
    grc_table: list[GrcEntry],
    sail_table: list[SailEntry],
    mitigation_table: list[MitigationEntry],
    oso_list: list[OsoEntry],
) -> SoraOutput:
    """
    Full SORA 2.5 pipeline. All regulatory data is *injected* — the engine
    is pure, stateless, and DB-free.
    """
    trace: list[TraceStep] = []
    assumptions: list[str] = []

    # ── Step 0: validation ──
    errors = validate_inputs(req)
    if errors:
        raise ValueError("; ".join(errors))
    trace.append(TraceStep(
        step="input_validation",
        description="All input parameters validated successfully",
        value="PASS",
    ))

    mass_kg = req.mtom_grams / 1000.0

    # ── Step 1: 250 g bypass ──
    bypass = is_bypass(req.mtom_grams, req.max_speed_ms)

    if bypass:
        ke: float | None = None
        igrc = 1
        trace.append(TraceStep(
            step="bypass_check",
            description=f"MTOM={req.mtom_grams}g ≤ 250g AND speed={req.max_speed_ms} m/s < 25 m/s → bypass applied",
            rule_source="SORA 2.5 §2.3.1 — low-mass/low-speed bypass",
            value="GRC 1 (bypass)",
        ))
        assumptions.append("250g bypass applied — kinetic energy computation skipped")
    else:
        # ── Step 2: kinetic energy ──
        ke = compute_kinetic_energy(mass_kg, req.max_speed_ms)
        trace.append(TraceStep(
            step="kinetic_energy",
            description=f"KE = 0.5 × {mass_kg:.3f} kg × ({req.max_speed_ms} m/s)² = {ke:.2f} J",
            rule_source="SORA 2.5 §2.3.2",
            value=f"{ke:.2f} J",
        ))

        # ── Step 3: iGRC lookup ──
        igrc, grc_src = lookup_grc(ke, req.population_density_band, grc_table)
        trace.append(TraceStep(
            step="initial_grc",
            description=f"KE={ke:.1f} J in '{req.population_density_band}' → iGRC {igrc}",
            rule_source=grc_src,
            value=str(igrc),
        ))

    # ── Step 4: GRC mitigations ──
    m1_red, m1_desc = apply_mitigation(req.mitigation_m1, mitigation_table, "M1")
    m2_red, m2_desc = apply_mitigation(req.mitigation_m2, mitigation_table, "M2")
    m3_red, m3_desc = apply_mitigation(req.mitigation_m3, mitigation_table, "M3")

    for desc in (m1_desc, m2_desc, m3_desc):
        trace.append(TraceStep(step="grc_mitigation", description=desc, rule_source="grc_mitigations"))

    final_grc = max(1, igrc - m1_red - m2_red - m3_red)
    trace.append(TraceStep(
        step="final_grc",
        description=f"Final GRC = max(1, {igrc} − {m1_red} − {m2_red} − {m3_red}) = {final_grc}",
        value=str(final_grc),
    ))

    if m1_red + m2_red + m3_red > 0:
        assumptions.append(
            f"GRC reduced from {igrc} to {final_grc} via mitigations "
            f"(M1=−{m1_red}, M2=−{m2_red}, M3=−{m3_red})"
        )

    # ── Step 5: SAIL determination ──
    sail, sail_src = lookup_sail(final_grc, req.arc, sail_table)
    trace.append(TraceStep(
        step="sail_determination",
        description=f"Final GRC {final_grc} × {req.arc} → SAIL {sail}",
        rule_source=sail_src,
        value=f"SAIL {sail}",
    ))

    # ── Step 6: OSO mapping (already filtered for this SAIL by the caller) ──
    trace.append(TraceStep(
        step="oso_mapping",
        description=f"{len(oso_list)} OSOs mapped for SAIL {sail}",
        value=str(len(oso_list)),
    ))

    # ── informational assumptions ──
    if req.propulsion_type:
        assumptions.append(f"Propulsion: {req.propulsion_type}")
    if req.endurance_min is not None:
        assumptions.append(f"Endurance: {req.endurance_min} min")
    if req.flight_frequency:
        assumptions.append(f"Flight frequency: {req.flight_frequency}")
    if req.operational_scenario:
        assumptions.append(f"Operational scenario: {req.operational_scenario}")

    return SoraOutput(
        bypass_applied=bypass,
        kinetic_energy_j=round(ke, 2) if ke is not None else None,
        initial_grc=igrc,
        m1_reduction=m1_red,
        m2_reduction=m2_red,
        m3_reduction=m3_red,
        final_grc=final_grc,
        arc=req.arc,
        sail=sail,
        oso_requirements=oso_list,
        traceability=trace,
        assumptions=assumptions,
    )
