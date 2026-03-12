# Drone Compliance API

MVP backend for a drone regulatory compliance platform — **SORA 2.5 Builder** + **DMA** modules.

All regulatory values (GRC matrix, SAIL matrix, 17 OSOs, country rules) live in PostgreSQL — zero hardcoded values in Python.

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (async) |
| Validation | Pydantic v2 |
| Database | PostgreSQL (numrange / int4range) |
| Runtime | Python 3.11+ |

## Project Structure

```
app/
├── api/
│   ├── dma.py              # POST /dma/evaluate
│   └── sora.py             # POST /sora/calculate
├── models/
│   ├── dma.py              # DmaQuestion
│   └── sora.py             # SoraVersion, GrcMatrix, SailMatrix,
│                           #   OsoCatalogue, OsoSailRequirement, CountryRule
├── schemas/
│   ├── dma.py              # Request / response schemas
│   └── sora.py
├── services/
│   ├── dma_service.py      # Weighted-average DMA scoring
│   └── sora_service.py     # GRC→SAIL→OSO pipeline (all DB-driven)
├── config.py               # pydantic-settings
├── db.py                   # Async engine + session factory
├── main.py                 # FastAPI app with lifespan
└── seed.py                 # DDL + real SORA 2.5 seed data
tests/
└── test_api.py             # 5 integration tests
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection details
```

### 3. Create the database

```bash
createdb drone_compliance   # or via psql / pgAdmin
```

### 4. Seed tables + data

This creates all tables (with proper range types and exclusion constraints) and inserts
real SORA 2.5 regulatory data:

```bash
python -m app.seed
```

### 5. Start the server

```bash
uvicorn app.main:app --reload
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

### 6. Run tests

```bash
pytest tests/ -v
```

Requires a seeded PostgreSQL database.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/sora/calculate` | Run SORA 2.5 GRC → SAIL → OSO pipeline |
| POST | `/dma/evaluate` | Score a DMA dimension questionnaire |

### SORA Calculate — example request

```json
{
  "mtom_grams": 2000,
  "max_speed_ms": 25,
  "characteristic_dimension_m": 0.5,
  "population_density_band": "populated",
  "arc": "ARC-a",
  "altitude_m": 100,
  "country_code": "NO"
}
```

### DMA Evaluate — example request

```json
{
  "dimension": "Operations",
  "scores": {
    "ops_procedures": 4,
    "ops_training": 3,
    "ops_documentation": 5,
    "ops_incident_response": 2,
    "ops_continuous_improvement": 4
  }
}
```

## Adding a New GRC Matrix Row (SQL only — no Python changes)

To add a new kinetic-energy band without touching any code:

```sql
INSERT INTO grc_matrix (sora_version_id, ke_range, population_density, igrc)
VALUES (
  (SELECT id FROM sora_versions WHERE version_label = '2.5'),
  numrange(1084000, 5000000),    -- new KE band: 1,084,000 – 5,000,000 J
  'populated',
  9
);
```

The `EXCLUDE USING gist` constraint prevents overlapping bands for the same
population density within a SORA version.

## Activating a Future SORA 2.6 Version

1. Insert the new version (inactive):
   ```sql
   INSERT INTO sora_versions (version_label, is_active) VALUES ('2.6', false);
   ```

2. Insert GRC, SAIL, OSO, and country-rule rows referencing the new version.

3. Swap the active flag:
   ```sql
   UPDATE sora_versions SET is_active = false WHERE version_label = '2.5';
   UPDATE sora_versions SET is_active = true  WHERE version_label = '2.6';
   ```

Both versions' data stays in the DB — rollback is a single `UPDATE`.

## Key Design Decisions

- **PostgreSQL range types**: `NUMRANGE` for kinetic-energy bands, `INT4RANGE` for
  GRC ranges in the SAIL matrix. Queried with the `@>` containment operator — no
  Python if/else ladders.
- **250 g bypass**: Drones ≤ 250 g AND < 25 m/s skip KE calculation and get GRC 1
  directly (EASA low-risk class).
- **120 m altitude hard limit**: Requests above 120 m AGL are rejected with HTTP 422.
- **17 OSOs**: The full set from SORA 2.5 Table 5 with per-SAIL robustness levels
  (O / L / M / H).
- **Services pattern**: Thin routers delegate to `SoraService` / `DmaService`,
  keeping business logic testable and separate from HTTP concerns.
- **Raw SQL DDL in seed.py**: Ensures proper PostgreSQL range types and exclusion
  constraints that SQLAlchemy's `metadata.create_all()` doesn't natively support.

## Out of Scope (MVP)

- User authentication / authorisation
- Frontend / UI
- Docker containerisation
- Alembic migrations (seed.py handles DDL for the prototype)
- Air Risk (ARC) determination — ARC is accepted as input
- Mitigation measures and GRC adjustments
- PDRA / STS category checks
- Multi-tenant / multi-organisation support
- PDF report generation
- Audit logging
