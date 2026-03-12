<div align="center">

# DroneComply
### EASA SORA 2.5 Compliance Platform

**Full-stack drone risk assessment tool — SORA 2.5 Builder + Design Maturity Assessment**

<!-- Language / Runtime -->
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=nodedotjs&logoColor=white)

<!-- Backend -->
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.4-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-v2-E92063?style=flat-square&logo=pydantic&logoColor=white)

<!-- Frontend -->
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-11.0-0055FF?style=flat-square&logo=framer&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r160-000000?style=flat-square&logo=threedotjs&logoColor=white)

<!-- Regulatory -->
![EASA SORA](https://img.shields.io/badge/EASA-SORA_2.5-0033A0?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)

</div>

---

A full-stack drone regulatory compliance platform implementing the **EASA SORA 2.5** (Specific Operations Risk Assessment) methodology and a **Design Maturity Assessment (DMA)** module. All regulatory values — GRC matrix, SAIL matrix, 17 OSOs, country rules — live in PostgreSQL with zero hardcoded thresholds in application code.

---

## Tech Stack

### Backend

| Layer | Technology | Version |
|---|---|---|
| Language | Python | 3.12 |
| Framework | FastAPI (async) | >= 0.110 |
| ORM | SQLAlchemy 2.0 (async) | >= 2.0 |
| DB Driver | asyncpg | >= 0.29 |
| Validation | Pydantic v2 | >= 2.6 |
| Settings | pydantic-settings | >= 2.1 |
| Database | PostgreSQL | 16.4 |
| Server | Uvicorn (ASGI) | >= 0.27 |
| Testing | pytest + pytest-asyncio + httpx | latest |

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | ~5.6 |
| UI Library | React | 18.3 |
| Build Tool | Vite | 6.0 |
| CSS | Tailwind CSS | 3.4 |
| Animations | Framer Motion | 11.0 |
| 3D Graphics | Three.js + React Three Fiber + Drei | 0.160 / 8.15 / 9.92 |
| Icons | Lucide React | 0.312 |
| Utilities | clsx | 2.1 |
| PostCSS | Autoprefixer + PostCSS | 10.4 / 8.4 |

### SORA Engine (Pure Python)

The risk assessment pipeline runs as an independent, framework-agnostic Python engine with **zero dependencies** on FastAPI, SQLAlchemy, or any external library. All regulatory data is injected via dataclasses — the engine is fully testable in isolation.

**Pipeline:** `validate → bypass check → KE calculation → iGRC lookup → mitigations → final GRC → SAIL lookup → OSO mapping → traceability assembly`

---

## Features

### SORA 2.5 Risk Assessment Builder
- Full GRC → SAIL → OSO pipeline driven entirely by database lookups (PostgreSQL range types)
- **250 g bypass**: Drones ≤ 250 g AND < 25 m/s skip KE calculation → GRC 1 (EASA low-risk class)
- **120 m altitude hard limit**: Requests above 120 m AGL are rejected (HTTP 422)
- **17 OSOs** from SORA 2.5 Table 5 with per-SAIL robustness levels (Optional / Low / Medium / High)
- **GRC mitigation pipeline**: M1 (strategic), M2 (effects), M3 (ERP) — each with none/low/medium/high
- **Country-specific flags**: Per-country regulatory notes (e.g., Norway restrictions)
- **Full audit trail**: Every calculation step is traced with rule source references
- **5 one-click presets**: DJI Mini 3, DJI Mavic 3, Delivery Drone, Inspection Drone, Event Coverage

### Design Maturity Assessment (DMA)
- Multi-dimension questionnaire with weighted scoring
- 1–5 scale: Not Implemented → Initial → Developing → Established → Optimized
- Per-dimension progress tracking and breakdown visualization
- Dimension navigation chips with completion indicators
- Organizational maturity ring chart with animated SVG

### UI / UX
- **Dark / Light mode** toggle with localStorage persistence (defaults to dark)
- **Unit toggle**: Switch between grams + m/s (SI) and kg + km/h (friendly) — API always receives SI units
- **Responsive layout**: 5-column grid on desktop, stacks on mobile
- **Framer Motion animations**: Page transitions, result card reveals, staggered list entries, spring-based tab indicators
- **SAIL gauge bar**: Animated gradient bar showing risk level (I–VI)
- **GRC reduction flow**: Visual pipeline showing iGRC → M1/M2/M3 reductions → final GRC
- **Maturity ring**: Animated SVG donut chart with drop-shadow glow
- **Professional design**: Clean surfaces, no glass morphism or gradients — `dark:` Tailwind prefixes throughout
- **Toast notifications**: Success/error toasts with auto-dismiss
- **Collapsible audit trail**: Step-by-step traceability with rule sources

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── dma.py                  # POST /dma/assess, GET /dma/questions
│   │   └── sora.py                 # POST /sora/calculate
│   ├── engine/
│   │   ├── sora_engine.py          # Pure Python SORA 2.5 calculation engine
│   │   └── dma_scoring_engine.py   # Pure Python DMA weighted-average scorer
│   ├── models/
│   │   ├── dma.py                  # DmaQuestion, DmaDimension
│   │   └── sora.py                 # SoraVersion, GrcMatrix, SailMatrix,
│   │                               #   OsoCatalogue, OsoSailRequirement, CountryRule
│   ├── schemas/
│   │   ├── dma.py                  # Pydantic request / response schemas
│   │   └── sora.py
│   ├── services/
│   │   ├── dma_service.py          # DMA business logic (DB → engine → response)
│   │   └── sora_service.py         # SORA business logic (DB → engine → response)
│   ├── config.py                   # pydantic-settings (DATABASE_URL, etc.)
│   ├── db.py                       # Async engine + session factory
│   ├── main.py                     # FastAPI app with lifespan, CORS, static mount
│   └── seed.py                     # DDL + real SORA 2.5 seed data (SQL)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Background3D.tsx    # Three.js scene (globe, drone, particles)
│   │   │   ├── DmaEvaluator.tsx    # DMA questionnaire + results panel
│   │   │   ├── Navbar.tsx          # Navigation bar with theme toggle
│   │   │   └── SoraBuilder.tsx     # SORA form + presets + results (~650 lines)
│   │   ├── api/
│   │   │   └── client.ts           # Typed API client (fetch wrapper)
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces (SoraRequest, SoraResponse, DMA types)
│   │   ├── App.tsx                 # Root component (tab routing, theme state, toasts)
│   │   ├── main.tsx                # React entry point
│   │   └── index.css               # Tailwind base + light/dark theme overrides
│   ├── tailwind.config.js          # Custom colors, fonts (Inter, JetBrains Mono), darkMode: 'class'
│   ├── vite.config.ts              # Vite config (React plugin, build → ../static/dist)
│   └── package.json
├── static/dist/                    # Production build output (served by FastAPI)
├── tests/
│   └── test_api.py                 # 5 integration tests (bypass, GRC, SAIL, OSO, altitude)
├── requirements.txt
├── pyproject.toml
├── pytest.ini
└── .env.example
```

---

## Setup

### Prerequisites

- Python 3.12+
- Node.js 22+
- PostgreSQL 16+

### 1. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
# Example: postgresql+asyncpg://postgres:password@127.0.0.1:5432/drone_compliance
```

### 4. Create and seed the database

```bash
createdb drone_compliance       # or via psql / pgAdmin
python -m app.seed              # Creates tables + inserts SORA 2.5 regulatory data
```

This creates all tables with proper PostgreSQL range types (`NUMRANGE`, `INT4RANGE`) and `EXCLUDE USING gist` constraints, then inserts real SORA 2.5 regulatory data (GRC matrix, SAIL matrix, 17 OSOs, country rules).

### 5. Build the frontend

```bash
cd frontend
npm run build                   # Outputs to ../static/dist/
```

### 6. Start the server

```bash
uvicorn app.main:app --reload --port 8000
```

- App: [http://localhost:8000](http://localhost:8000)
- API docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)

### 7. Run tests

```bash
pytest tests/ -v
```

5 integration tests covering: 250 g bypass, populated area GRC lookup, SAIL III from ARC-b + GRC 4, 17 OSOs returned, altitude > 120 m rejection.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/sora/calculate` | Run full SORA 2.5 GRC → SAIL → OSO pipeline |
| `GET` | `/dma/questions` | Get all DMA dimensions and questions |
| `POST` | `/dma/assess` | Score a DMA questionnaire |

### SORA Calculate — example request

```json
{
  "drone_type": "DJI Mavic 3 Pro",
  "mtom_grams": 958,
  "max_speed_ms": 21,
  "characteristic_dimension_m": 0.38,
  "altitude_m": 50,
  "population_density_band": "populated",
  "arc": "ARC-b",
  "propulsion_type": "electric",
  "endurance_min": 43,
  "flight_frequency": "frequent",
  "operational_scenario": "VLOS",
  "mitigation_m1": "low",
  "mitigation_m2": "none",
  "mitigation_m3": "none",
  "country_code": "NO"
}
```

### SORA Calculate — example response

```json
{
  "bypass_applied": false,
  "kinetic_energy_j": 210.9,
  "igrc": 4,
  "initial_grc": 4,
  "final_grc": 3,
  "m1_reduction": 1,
  "m2_reduction": 0,
  "m3_reduction": 0,
  "sail": 3,
  "arc": "ARC-b",
  "oso_requirements": [
    { "oso_number": 1, "title": "Ensure the UAS operator is competent...", "robustness": "M" }
  ],
  "country_flags": [
    { "rule_key": "NO_120m", "description": "Norway: Max 120m AGL..." }
  ],
  "traceability": [
    { "step": "KE_CALC", "description": "Kinetic energy = 0.5 * 0.958 * 21^2", "rule_source": "SORA 2.5 Annex B", "value": "210.9 J" }
  ],
  "assumptions": ["Altitude within 120m AGL limit"],
  "input_parameters": { "drone_type": "DJI Mavic 3 Pro", "mtom_grams": 958 }
}
```

---

## Key Design Decisions

- **PostgreSQL range types**: `NUMRANGE` for kinetic-energy bands, `INT4RANGE` for GRC ranges in the SAIL matrix — queried with the `@>` containment operator. No Python if/else ladders.
- **Pure engine pattern**: `sora_engine.py` and `dma_scoring_engine.py` are framework-agnostic. All regulatory data is injected via dataclasses — zero DB or HTTP imports. Fully unit-testable in isolation.
- **Services pattern**: Thin API routers delegate to `SoraService` / `DmaService`, which load DB data and call the pure engines. Business logic stays separate from HTTP concerns.
- **250 g bypass**: EASA low-risk class — drones ≤ 250 g AND < 25 m/s skip KE calculation and get GRC 1 directly.
- **120 m altitude hard limit**: Rejected at validation (HTTP 422).
- **17 OSOs**: Full set from SORA 2.5 Table 5 with per-SAIL robustness levels (O / L / M / H).
- **Raw SQL DDL in seed.py**: Ensures proper PostgreSQL range types and exclusion constraints that SQLAlchemy's `metadata.create_all()` doesn't natively support.
- **Client-side unit conversion**: API speaks grams + m/s internally. The frontend unit toggle (kg / km/h) converts on display/input without touching the API contract.
- **Dark mode via Tailwind class strategy**: `darkMode: 'class'` on `<html>`, persisted in localStorage. All components use `dark:` prefix classes.

## Extending the System

### Adding a New GRC Matrix Row (SQL only — no code changes)

```sql
INSERT INTO grc_matrix (sora_version_id, ke_range, population_density, igrc)
VALUES (
  (SELECT id FROM sora_versions WHERE version_label = '2.5'),
  numrange(1084000, 5000000),
  'populated',
  9
);
```

### Activating a Future SORA 2.6 Version

```sql
INSERT INTO sora_versions (version_label, is_active) VALUES ('2.6', false);
-- Insert GRC, SAIL, OSO, and country-rule rows referencing the new version.
UPDATE sora_versions SET is_active = false WHERE version_label = '2.5';
UPDATE sora_versions SET is_active = true  WHERE version_label = '2.6';
-- Rollback is a single UPDATE — both versions' data stays in the DB.
```

---

## License

MIT
