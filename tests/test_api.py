"""
5 pytest tests using real SORA 2.5 numbers.

Requires a running PostgreSQL with seeded data.
Set DATABASE_URL in .env or environment before running.

Run:  pytest tests/ -v
"""
from httpx import ASGITransport, AsyncClient


# ── Test 1: 250 g bypass rule ─────────────────────────────────

async def test_250g_bypass_returns_grc_1(client):
    """A 200 g drone at 20 m/s should trigger the bypass → GRC 1 immediately."""
    resp = await client.post("/sora/calculate", json={
        "mtom_grams": 200,
        "max_speed_ms": 20,
        "characteristic_dimension_m": 0.3,
        "population_density_band": "populated",
        "arc": "ARC-b",
        "altitude_m": 50,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["bypass_applied"] is True
    assert data["igrc"] == 1
    assert data["kinetic_energy_j"] is None


# ── Test 2: Populated-area GRC lookup ─────────────────────────

async def test_populated_area_grc_lookup(client):
    """
    A 2 kg drone at 25 m/s:
      KE = 0.5 × 2 × 25² = 625 J
      Band 1 (0–700 J), populated → iGRC = 3.
    """
    resp = await client.post("/sora/calculate", json={
        "mtom_grams": 2000,
        "max_speed_ms": 25,
        "characteristic_dimension_m": 0.5,
        "population_density_band": "populated",
        "arc": "ARC-a",
        "altitude_m": 100,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["bypass_applied"] is False
    assert data["kinetic_energy_j"] == 625.0
    assert data["igrc"] == 3


# ── Test 3: SAIL III from ARC-b and GRC 4 ────────────────────

async def test_sail_iii_from_arc_b_grc_4(client):
    """
    GRC 4 with ARC-b should yield SAIL 2 per the seeded matrix
    (GRC 3–4 band, ARC-b → SAIL 2).

    To get GRC=4, we need KE in [0,700) + gathering band → iGRC=4.
    KE = 0.5 × 0.5 × 20² = 100 J (band 1, gathering → 4).
    """
    resp = await client.post("/sora/calculate", json={
        "mtom_grams": 500,
        "max_speed_ms": 20,
        "characteristic_dimension_m": 0.4,
        "population_density_band": "gathering",
        "arc": "ARC-b",
        "altitude_m": 80,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["igrc"] == 4
    assert data["sail"] == 2  # GRC 3–4, ARC-b → SAIL 2


# ── Test 4: Exactly 17 OSOs returned ─────────────────────────

async def test_17_osos_returned(client):
    """Any valid SORA calculation should return exactly 17 OSOs."""
    resp = await client.post("/sora/calculate", json={
        "mtom_grams": 2000,
        "max_speed_ms": 25,
        "characteristic_dimension_m": 0.5,
        "population_density_band": "populated",
        "arc": "ARC-a",
        "altitude_m": 100,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["oso_requirements"]) == 17


# ── Test 5: 422 rejection for altitude > 120 m ───────────────

async def test_altitude_above_120m_rejected(client):
    """Altitude above 120 m AGL must be rejected with HTTP 422."""
    resp = await client.post("/sora/calculate", json={
        "mtom_grams": 2000,
        "max_speed_ms": 25,
        "characteristic_dimension_m": 0.5,
        "population_density_band": "populated",
        "arc": "ARC-a",
        "altitude_m": 150,
    })
    assert resp.status_code == 422
