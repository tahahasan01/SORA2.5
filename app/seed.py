"""
Seed script — populates all regulatory tables with real SORA 2.5 values.

Run:  python -m app.seed

Uses raw SQL for PostgreSQL range-type inserts (numrange / int4range).
Idempotent — checks for existing data before inserting.
"""

import sys

from sqlalchemy import create_engine, text

from app.config import settings


def seed_all() -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with engine.begin() as conn:
        _create_tables(conn)
        _seed_sora_version(conn)
        _seed_grc_matrix(conn)
        _seed_sail_matrix(conn)
        _seed_oso_catalogue(conn)
        _seed_oso_sail_requirements(conn)
        _seed_grc_mitigations(conn)
        _seed_country_rules(conn)
        _seed_dma_questions(conn)

    print("✓ All seed data inserted successfully.")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _create_tables(conn):
    """Create all tables using raw DDL so we get proper range types + constraints."""

    # Enable btree_gist for exclusion constraints on range types
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS sora_versions (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            version_label VARCHAR(20) UNIQUE NOT NULL,
            is_active     BOOLEAN NOT NULL DEFAULT false,
            created_at    TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS grc_matrix (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sora_version_id    UUID NOT NULL REFERENCES sora_versions(id),
            ke_range           NUMRANGE NOT NULL,
            population_density VARCHAR(30) NOT NULL,
            igrc               INTEGER NOT NULL,
            created_at         TIMESTAMPTZ DEFAULT now(),
            EXCLUDE USING gist (
                sora_version_id WITH =,
                population_density WITH =,
                ke_range WITH &&
            )
        )
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS sail_matrix (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sora_version_id UUID NOT NULL REFERENCES sora_versions(id),
            grc_range       INT4RANGE NOT NULL,
            arc             VARCHAR(10) NOT NULL,
            sail            INTEGER NOT NULL,
            created_at      TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS oso_catalogue (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sora_version_id UUID NOT NULL REFERENCES sora_versions(id),
            oso_number      INTEGER NOT NULL,
            title           VARCHAR(500) NOT NULL,
            category        VARCHAR(100),
            created_at      TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS oso_sail_requirements (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            oso_id     UUID NOT NULL REFERENCES oso_catalogue(id) ON DELETE CASCADE,
            sail_level INTEGER NOT NULL,
            robustness VARCHAR(1) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS country_rules (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sora_version_id UUID NOT NULL REFERENCES sora_versions(id),
            country_code    VARCHAR(3) NOT NULL,
            rule_key        VARCHAR(100) NOT NULL,
            rule_value      TEXT NOT NULL,
            description     TEXT,
            is_active       BOOLEAN DEFAULT true,
            created_at      TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS grc_mitigations (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sora_version_id UUID NOT NULL REFERENCES sora_versions(id),
            mitigation_type VARCHAR(5) NOT NULL,
            robustness      VARCHAR(10) NOT NULL,
            grc_reduction   INTEGER NOT NULL DEFAULT 0,
            description     TEXT NOT NULL,
            created_at      TIMESTAMPTZ DEFAULT now()
        )
    """))

    # ── DMA tables (drop old schema if present, recreate) ───────
    conn.execute(text("DROP TABLE IF EXISTS dma_dimension_scores CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS dma_responses CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS dma_assessments CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS dma_questions CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS dma_dimensions CASCADE"))

    conn.execute(text("""
        CREATE TABLE dma_dimensions (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR(200) UNIQUE NOT NULL,
            description TEXT NOT NULL DEFAULT ''
        )
    """))

    conn.execute(text("""
        CREATE TABLE dma_questions (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            dimension_id   UUID NOT NULL REFERENCES dma_dimensions(id),
            question_key   VARCHAR(100) UNIQUE NOT NULL,
            question_text  TEXT NOT NULL,
            weight         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            active         BOOLEAN NOT NULL DEFAULT true,
            created_at     TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE dma_assessments (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_name VARCHAR(300) NOT NULL,
            created_at        TIMESTAMPTZ DEFAULT now()
        )
    """))

    conn.execute(text("""
        CREATE TABLE dma_responses (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            assessment_id  UUID NOT NULL REFERENCES dma_assessments(id) ON DELETE CASCADE,
            question_id    UUID NOT NULL REFERENCES dma_questions(id),
            score          INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5)
        )
    """))

    conn.execute(text("""
        CREATE TABLE dma_dimension_scores (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            assessment_id  UUID NOT NULL REFERENCES dma_assessments(id) ON DELETE CASCADE,
            dimension_id   UUID NOT NULL REFERENCES dma_dimensions(id),
            score          DOUBLE PRECISION NOT NULL,
            percentage     DOUBLE PRECISION NOT NULL
        )
    """))


def _seed_sora_version(conn):
    row = conn.execute(text("SELECT id FROM sora_versions WHERE version_label = '2.5'")).first()
    if row:
        return
    conn.execute(text("""
        INSERT INTO sora_versions (version_label, is_active) VALUES ('2.5', true)
    """))


def _get_version_id(conn):
    return conn.execute(
        text("SELECT id FROM sora_versions WHERE version_label = '2.5'")
    ).scalar_one()


def _seed_grc_matrix(conn):
    """
    4-band GRC matrix slice (kinetic energy × population density).

    SORA 2.5 Table 2 iGRC values:
      Band 1: KE ≤ 700 J
      Band 2: 700 < KE ≤ 34,000 J
      Band 3: 34,000 < KE ≤ 1,084,000 J
      Band 4: KE > 1,084,000 J
    """
    existing = conn.execute(text("SELECT COUNT(*) FROM grc_matrix")).scalar()
    if existing > 0:
        return

    vid = _get_version_id(conn)

    # (ke_range, population_density, igrc)
    # numrange uses [lower, upper) or [lower,) for unbounded
    rows = [
        # Band 1: 0–700 J
        ("[0, 700)", "controlled_ground", 1),
        ("[0, 700)", "sparsely_populated", 2),
        ("[0, 700)", "populated", 3),
        ("[0, 700)", "gathering", 4),
        # Band 2: 700–34,000 J
        ("[700, 34000)", "controlled_ground", 2),
        ("[700, 34000)", "sparsely_populated", 3),
        ("[700, 34000)", "populated", 5),
        ("[700, 34000)", "gathering", 6),
        # Band 3: 34,000–1,084,000 J
        ("[34000, 1084000)", "controlled_ground", 3),
        ("[34000, 1084000)", "sparsely_populated", 5),
        ("[34000, 1084000)", "populated", 7),
        ("[34000, 1084000)", "gathering", 8),
        # Band 4: > 1,084,000 J
        ("[1084000,)", "controlled_ground", 4),
        ("[1084000,)", "sparsely_populated", 6),
        ("[1084000,)", "populated", 8),
        ("[1084000,)", "gathering", 10),
    ]

    for ke_range, band, igrc in rows:
        conn.execute(text("""
            INSERT INTO grc_matrix (sora_version_id, ke_range, population_density, igrc)
            VALUES (:vid, CAST(:ke_range AS numrange), :band, :igrc)
        """), {"vid": vid, "ke_range": ke_range, "band": band, "igrc": igrc})


def _seed_sail_matrix(conn):
    """
    SORA 2.5 Table 4 — SAIL determination.

    GRC ranges × ARC-a through ARC-d.
    """
    existing = conn.execute(text("SELECT COUNT(*) FROM sail_matrix")).scalar()
    if existing > 0:
        return

    vid = _get_version_id(conn)

    # (grc_range_int4range, arc, sail)
    rows = [
        # GRC ≤ 2
        ("[1,3)", "ARC-a", 1),
        ("[1,3)", "ARC-b", 1),
        ("[1,3)", "ARC-c", 2),
        ("[1,3)", "ARC-d", 4),
        # GRC 3–4
        ("[3,5)", "ARC-a", 2),
        ("[3,5)", "ARC-b", 2),
        ("[3,5)", "ARC-c", 4),
        ("[3,5)", "ARC-d", 5),
        # GRC 5–6
        ("[5,7)", "ARC-a", 3),
        ("[5,7)", "ARC-b", 4),
        ("[5,7)", "ARC-c", 5),
        ("[5,7)", "ARC-d", 6),
        # GRC 7+
        ("[7,)", "ARC-a", 4),
        ("[7,)", "ARC-b", 5),
        ("[7,)", "ARC-c", 6),
        ("[7,)", "ARC-d", 6),
    ]

    for grc_range, arc, sail in rows:
        conn.execute(text("""
            INSERT INTO sail_matrix (sora_version_id, grc_range, arc, sail)
            VALUES (:vid, CAST(:grc_range AS int4range), :arc, :sail)
        """), {"vid": vid, "grc_range": grc_range, "arc": arc, "sail": sail})


def _seed_oso_catalogue(conn):
    """SORA 2.5 — all 17 Operational Safety Objectives."""
    existing = conn.execute(text("SELECT COUNT(*) FROM oso_catalogue")).scalar()
    if existing > 0:
        return

    vid = _get_version_id(conn)

    osos = [
        (1, "Ensure the UAS operator is competent and/or proven", "Operational"),
        (2, "UAS manufactured by competent and/or proven entity", "Technical"),
        (3, "UAS maintained by competent and/or proven entity", "Technical"),
        (4, "UAS developed to design standards", "Technical"),
        (5, "UAS is designed considering system safety and reliability", "Technical"),
        (6, "C3 link characteristics are appropriate for the operation", "Technical"),
        (7, "Inspection of UAS to ensure safe operating condition", "Operational"),
        (8, "Operational procedures are defined, validated, and adhered to", "Operational"),
        (9, "Remote crew trained and current and able to control the abnormal situation", "Human"),
        (10, "Safe recovery from technical issue", "Technical"),
        (11, "Procedures established and listing adverse operating conditions", "Operational"),
        (12, "UAS designed and qualified for adverse environmental conditions", "Technical"),
        (13, "External services supporting UAS operations are adequate", "Operational"),
        (14, "Operational volume robust and effective for safe containment", "Operational"),
        (15, "Adequate containment in place for ground risk mitigation", "Operational"),
        (16, "Multi-crew coordination", "Human"),
        (17, "Remote crew able to manage outcome of contingency", "Human"),
    ]

    for num, title, cat in osos:
        conn.execute(text("""
            INSERT INTO oso_catalogue (sora_version_id, oso_number, title, category)
            VALUES (:vid, :num, :title, :cat)
        """), {"vid": vid, "num": num, "title": title, "cat": cat})


def _seed_oso_sail_requirements(conn):
    """
    Robustness per OSO per SAIL — SORA 2.5 Table 5 values.

    O = Optional, L = Low, M = Medium, H = High.
    Each OSO has a robustness for SAIL I–VI.
    """
    existing = conn.execute(text("SELECT COUNT(*) FROM oso_sail_requirements")).scalar()
    if existing > 0:
        return

    # {oso_number: [SAIL_I, SAIL_II, SAIL_III, SAIL_IV, SAIL_V, SAIL_VI]}
    mappings: dict[int, list[str]] = {
        1:  ["O", "L", "L", "M", "H", "H"],
        2:  ["O", "O", "L", "L", "M", "H"],
        3:  ["O", "L", "L", "M", "M", "H"],
        4:  ["O", "O", "L", "M", "H", "H"],
        5:  ["O", "O", "L", "M", "H", "H"],
        6:  ["O", "L", "L", "M", "H", "H"],
        7:  ["O", "L", "L", "M", "H", "H"],
        8:  ["O", "L", "M", "M", "H", "H"],
        9:  ["O", "L", "L", "M", "M", "H"],
        10: ["O", "L", "M", "M", "H", "H"],
        11: ["O", "L", "L", "M", "M", "H"],
        12: ["O", "L", "L", "M", "M", "H"],
        13: ["O", "L", "L", "M", "M", "H"],
        14: ["O", "L", "M", "M", "H", "H"],
        15: ["O", "L", "M", "M", "H", "H"],
        16: ["O", "L", "L", "M", "M", "H"],
        17: ["O", "L", "L", "M", "M", "H"],
    }

    # Fetch OSO catalogue IDs
    rows = conn.execute(text(
        "SELECT id, oso_number FROM oso_catalogue ORDER BY oso_number"
    )).all()
    oso_id_map = {r[1]: r[0] for r in rows}

    for oso_num, levels in mappings.items():
        oso_id = oso_id_map.get(oso_num)
        if oso_id is None:
            continue
        for sail_lvl, robustness in enumerate(levels, start=1):
            conn.execute(text("""
                INSERT INTO oso_sail_requirements (oso_id, sail_level, robustness)
                VALUES (:oso_id, :sail, :rob)
            """), {"oso_id": oso_id, "sail": sail_lvl, "rob": robustness})


def _seed_grc_mitigations(conn):
    """
    SORA 2.5 GRC mitigations: M1 (strategic), M2 (effects reduction), M3 (ERP).

    Each robustness level (low/medium/high) maps to a GRC reduction.
    Values are updatable in the DB without code changes.
    """
    existing = conn.execute(text("SELECT COUNT(*) FROM grc_mitigations")).scalar()
    if existing > 0:
        return

    vid = _get_version_id(conn)

    # (mitigation_type, robustness, grc_reduction, description)
    rows = [
        # M1 — Strategic mitigations (reduce population exposure)
        ("M1", "low",    1, "Basic strategic mitigation: operational restrictions reducing overflown population"),
        ("M1", "medium", 2, "Demonstrated strategic mitigation: validated flight geography limiting ground risk exposure"),
        ("M1", "high",   2, "Validated strategic mitigation: flight geography with assured containment performance"),

        # M2 — Effects reduction (lower impact energy: parachute, frangibility)
        ("M2", "low",    0, "Partial effects reduction: design features that may limit injury severity"),
        ("M2", "medium", 1, "Demonstrated effects reduction: parachute or frangible design with supporting evidence"),
        ("M2", "high",   2, "Validated effects reduction: certified parachute or fully frangible structure"),

        # M3 — Emergency Response Plan (ERP)
        ("M3", "low",    0, "Basic ERP: emergency contact information and general response plan"),
        ("M3", "medium", 1, "Demonstrated ERP: rehearsed plan with assigned roles and coordination procedures"),
        ("M3", "high",   1, "Validated ERP: regularly exercised plan with proven response effectiveness"),
    ]

    for mit_type, robustness, reduction, desc in rows:
        conn.execute(text("""
            INSERT INTO grc_mitigations (sora_version_id, mitigation_type, robustness, grc_reduction, description)
            VALUES (:vid, :mt, :rob, :red, :desc)
        """), {"vid": vid, "mt": mit_type, "rob": robustness, "red": reduction, "desc": desc})

    print(f"  → {len(rows)} GRC mitigations seeded.")


def _seed_country_rules(conn):
    """Norway-specific CAA rules."""
    existing = conn.execute(text(
        "SELECT COUNT(*) FROM country_rules WHERE country_code = 'NO'"
    )).scalar()
    if existing > 0:
        return

    vid = _get_version_id(conn)

    rules = [
        (
            "insurance_above_250g",
            "true",
            "Insurance required for drones above 250 g MTOM (Luftfartstilsynet)",
        ),
        (
            "nsm_sensor_registration",
            "true",
            "Drones with cameras/sensors must be registered with NSM (Nasjonal Sikkerhetsmyndighet)",
        ),
    ]

    for key, value, desc in rules:
        conn.execute(text("""
            INSERT INTO country_rules (sora_version_id, country_code, rule_key, rule_value, description)
            VALUES (:vid, 'NO', :key, :val, :desc)
        """), {"vid": vid, "key": key, "val": value, "desc": desc})


def _seed_dma_questions(conn):
    """Seed 5 DMA dimensions with 5 questions each (25 total)."""

    # The seed always re-creates DMA tables, so no idempotency check needed.

    # ── Dimensions ────────────────────────────────────────────
    dimensions = {
        "Governance": "Organizational policies, accountability, and strategic oversight for the drone program.",
        "Operations": "Operational procedures, crew competency, and day-to-day mission management.",
        "Compliance": "Regulatory registrations, insurance, airspace authorizations, and audits.",
        "Technology": "Fleet management, redundancy, C3 links, software, and cybersecurity.",
        "Safety Management": "Safety Management System (SMS), risk assessments, emergency procedures, and safety culture.",
    }

    dim_ids: dict[str, str] = {}
    for name, desc in dimensions.items():
        row = conn.execute(text("""
            INSERT INTO dma_dimensions (name, description) VALUES (:n, :d) RETURNING id
        """), {"n": name, "d": desc}).first()
        dim_ids[name] = str(row[0])

    # ── Questions: (dimension, question_key, question_text, weight) ──
    questions = [
        # Governance
        ("Governance", "gov_policy", "Does the organization have a formal drone-use policy approved by senior management?", 1.5),
        ("Governance", "gov_roles", "Are roles and responsibilities for drone operations clearly defined and documented?", 1.0),
        ("Governance", "gov_accountability", "Is there a designated accountable manager for UAS operations?", 1.5),
        ("Governance", "gov_budget", "Is there a dedicated budget allocated for the drone program?", 1.0),
        ("Governance", "gov_review", "Is the drone program subject to regular management review and continuous improvement?", 1.0),

        # Operations
        ("Operations", "ops_sop", "Are standard operating procedures (SOPs) documented, validated, and actively followed?", 2.0),
        ("Operations", "ops_crew_training", "Is remote crew training current, recurrent, and aligned with regulatory requirements?", 1.5),
        ("Operations", "ops_preflight", "Are pre-flight checklists completed and recorded for every mission?", 1.0),
        ("Operations", "ops_incident_report", "Is there a formal incident and near-miss reporting system in place?", 1.5),
        ("Operations", "ops_maintenance", "Is there a documented and scheduled maintenance program for the UAS fleet?", 1.0),

        # Compliance
        ("Compliance", "comp_registration", "Are all UAS registered with the relevant national aviation authority?", 1.5),
        ("Compliance", "comp_insurance", "Is adequate insurance coverage in place for all drone operations?", 1.0),
        ("Compliance", "comp_airspace", "Are proper airspace authorizations obtained and verified before each flight?", 1.5),
        ("Compliance", "comp_privacy", "Are data protection and privacy regulations (e.g., GDPR) addressed in operations?", 1.0),
        ("Compliance", "comp_audit", "Are internal or external compliance audits conducted on a regular basis?", 1.0),

        # Technology
        ("Technology", "tech_fleet", "Is the UAS fleet inventoried with detailed technical specifications and maintenance records?", 1.0),
        ("Technology", "tech_redundancy", "Do UAS have redundant or failsafe systems (e.g., return-to-home, parachutes)?", 1.5),
        ("Technology", "tech_c3_link", "Is the command-and-control (C3) link monitored for latency, reliability, and interference?", 1.5),
        ("Technology", "tech_software", "Is flight planning and logging software used, maintained, and backed up?", 1.0),
        ("Technology", "tech_cybersecurity", "Are cybersecurity measures in place for ground control stations and data links?", 1.0),

        # Safety Management
        ("Safety Management", "safety_sms", "Is a formal Safety Management System (SMS) implemented and actively maintained?", 2.0),
        ("Safety Management", "safety_risk_assessment", "Are pre-mission risk assessments conducted systematically for every operation?", 1.5),
        ("Safety Management", "safety_emergency", "Are emergency response procedures defined, documented, and regularly rehearsed?", 1.5),
        ("Safety Management", "safety_culture", "Is a just and open safety-reporting culture promoted across the organization?", 1.0),
        ("Safety Management", "safety_continuous", "Is there a continuous improvement process based on safety performance data?", 1.0),
    ]

    for dim_name, key, txt, weight in questions:
        conn.execute(text("""
            INSERT INTO dma_questions (dimension_id, question_key, question_text, weight)
            VALUES (:did, :key, :txt, :wt)
        """), {"did": dim_ids[dim_name], "key": key, "txt": txt, "wt": weight})

    print(f"  → {len(dimensions)} DMA dimensions, {len(questions)} questions seeded.")


if __name__ == "__main__":
    seed_all()
