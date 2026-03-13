"""
FastAPI application entry-point.

Uses lifespan to ensure DB connectivity on startup.
Run locally:  uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.db import engine
from app.api import sora, dma

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Verify database connection on startup; dispose on shutdown."""
    async with engine.connect() as conn:
        await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(sora.router, prefix="/sora", tags=["SORA Builder"])
app.include_router(dma.router, prefix="/dma", tags=["DMA"])


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


# ── Static files & SPA fallback ───────────────────────────────
DIST_DIR = STATIC_DIR / "dist"

# In serverless deployments (e.g., Vercel API function), frontend assets are
# typically served by the platform, so only mount local built assets if present.
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/", include_in_schema=False)
async def serve_ui():
    if not DIST_DIR.exists():
        return {"message": "Frontend not bundled in this runtime. Use /docs for API."}
    return FileResponse(DIST_DIR / "index.html")
