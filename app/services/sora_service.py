"""
SORA 2.5 calculation service — orchestrates DB fetches and delegates
all computation to the pure engine in app.engine.sora_engine.

Zero hardcoded GRC/SAIL/OSO/mitigation values.
"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.sora_engine import (
    GrcEntry,
    MitigationEntry,
    OsoEntry,
    SailEntry,
    SoraInput,
    TraceStep,
    compute_sora,
)
from app.models.sora import (
    CountryRule,
    GrcMitigation,
    OsoCatalogue,
    OsoSailRequirement,
    SoraVersion,
)
from app.schemas.sora import (
    CountryFlag,
    OsoRequirement,
    SoraCalculateRequest,
    SoraCalculateResponse,
    TraceEntry,
)


class SoraService:
    """Stateless — all state lives in PostgreSQL."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate(self, req: SoraCalculateRequest) -> SoraCalculateResponse:
        # ── 1. Resolve active SORA version ────────────────────
        version_id = await self._active_version_id()

        # ── 2. Load all lookup tables from DB ─────────────────
        grc_table = await self._load_grc_table(version_id)
        sail_table = await self._load_sail_table(version_id)
        mitigation_table = await self._load_mitigations(version_id)

        # ── 3. Build engine input ─────────────────────────────
        engine_input = SoraInput(
            mtom_grams=req.mtom_grams,
            max_speed_ms=req.max_speed_ms,
            characteristic_dimension_m=req.characteristic_dimension_m,
            altitude_m=req.altitude_m,
            population_density_band=req.population_density_band,
            arc=req.arc,
            country_code=req.country_code,
            propulsion_type=req.propulsion_type,
            endurance_min=req.endurance_min,
            flight_frequency=req.flight_frequency,
            operational_scenario=req.operational_scenario,
            mitigation_m1=req.mitigation_m1,
            mitigation_m2=req.mitigation_m2,
            mitigation_m3=req.mitigation_m3,
        )

        # ── 4. Run pure engine (no DB inside) ─────────────────
        # Engine needs OSOs, but OSOs depend on SAIL which the engine calculates.
        # We do a two-pass: compute SAIL first, then fetch OSOs.
        # Actually, we pass an empty OSO list to get SAIL, then fetch OSOs.
        result = compute_sora(
            engine_input, grc_table, sail_table, mitigation_table, oso_list=[],
        )

        # ── 5. Fetch OSOs for the computed SAIL ───────────────
        oso_list = await self._get_osos(version_id, result.sail)

        # ── 6. Country flags ──────────────────────────────────
        country_flags: list[CountryFlag] = []
        if req.country_code:
            country_flags = await self._get_country_flags(
                version_id, req.country_code.upper(),
            )

        # ── 7. Assemble response ──────────────────────────────
        input_echo = req.model_dump(exclude_none=True)

        # Replace engine's empty OSO trace with real count
        trace_entries = [
            TraceEntry(
                step=t.step,
                description=t.description,
                rule_source=t.rule_source,
                value=t.value,
            )
            for t in result.traceability
            if t.step != "oso_mapping"
        ]
        trace_entries.append(TraceEntry(
            step="oso_mapping",
            description=f"{len(oso_list)} OSOs mapped for SAIL {result.sail}",
            rule_source="oso_catalogue + oso_sail_requirements",
            value=str(len(oso_list)),
        ))

        return SoraCalculateResponse(
            bypass_applied=result.bypass_applied,
            kinetic_energy_j=result.kinetic_energy_j,
            igrc=result.initial_grc,        # backward compat
            sail=result.sail,
            arc=result.arc,
            oso_requirements=oso_list,
            country_flags=country_flags,
            # enhanced
            input_parameters=input_echo,
            initial_grc=result.initial_grc,
            final_grc=result.final_grc,
            m1_reduction=result.m1_reduction,
            m2_reduction=result.m2_reduction,
            m3_reduction=result.m3_reduction,
            traceability=trace_entries,
            assumptions=result.assumptions,
        )

    # ── private helpers ───────────────────────────────────────

    async def _active_version_id(self):
        result = await self.db.execute(
            select(SoraVersion.id).where(SoraVersion.is_active.is_(True))
        )
        vid = result.scalar_one_or_none()
        if vid is None:
            raise ValueError("No active SORA version configured")
        return vid

    async def _load_grc_table(self, version_id) -> list[GrcEntry]:
        """Load all GRC matrix rows and convert range bounds to floats."""
        stmt = text("""
            SELECT lower(ke_range)::float, upper(ke_range)::float,
                   population_density, igrc
            FROM grc_matrix WHERE sora_version_id = :vid
        """)
        rows = await self.db.execute(stmt, {"vid": str(version_id)})
        return [
            GrcEntry(ke_lower=r[0], ke_upper=r[1], population_density=r[2], igrc=r[3])
            for r in rows.all()
        ]

    async def _load_sail_table(self, version_id) -> list[SailEntry]:
        """Load all SAIL matrix rows and convert range bounds to ints."""
        stmt = text("""
            SELECT lower(grc_range), upper(grc_range), arc, sail
            FROM sail_matrix WHERE sora_version_id = :vid
        """)
        rows = await self.db.execute(stmt, {"vid": str(version_id)})
        return [
            SailEntry(grc_lower=r[0], grc_upper=r[1], arc=r[2], sail=r[3])
            for r in rows.all()
        ]

    async def _load_mitigations(self, version_id) -> list[MitigationEntry]:
        """Load all GRC mitigation rows."""
        stmt = select(GrcMitigation).where(
            GrcMitigation.sora_version_id == version_id
        )
        result = await self.db.execute(stmt)
        return [
            MitigationEntry(
                mitigation_type=r.mitigation_type,
                robustness=r.robustness,
                grc_reduction=r.grc_reduction,
                description=r.description,
            )
            for r in result.scalars().all()
        ]

    async def _get_osos(self, version_id, sail: int) -> list[OsoRequirement]:
        stmt = (
            select(
                OsoCatalogue.oso_number,
                OsoCatalogue.title,
                OsoSailRequirement.robustness,
            )
            .join(OsoSailRequirement, OsoSailRequirement.oso_id == OsoCatalogue.id)
            .where(
                OsoCatalogue.sora_version_id == version_id,
                OsoSailRequirement.sail_level == sail,
            )
            .order_by(OsoCatalogue.oso_number)
        )
        result = await self.db.execute(stmt)
        return [
            OsoRequirement(oso_number=r[0], title=r[1], robustness=r[2])
            for r in result.all()
        ]

    async def _get_country_flags(
        self, version_id, country_code: str,
    ) -> list[CountryFlag]:
        stmt = select(CountryRule).where(
            CountryRule.sora_version_id == version_id,
            CountryRule.country_code == country_code,
            CountryRule.is_active.is_(True),
        )
        result = await self.db.execute(stmt)
        return [
            CountryFlag(rule_key=r.rule_key, description=r.description or r.rule_value)
            for r in result.scalars().all()
        ]
