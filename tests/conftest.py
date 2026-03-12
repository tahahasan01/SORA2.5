"""
pytest configuration — shared async event loop and HTTP client for all tests.

Creates a dedicated test engine + session factory so that DB operations
during tests never collide with the app's module-level engine/lifespan.
"""
import asyncio
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db import get_db
from app.main import app


# ── session-scoped event loop (one loop for all async tests) ──

@pytest.fixture(scope="session")
def event_loop():
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


# ── session-scoped test engine + session factory ──────────────

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    eng = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture(scope="session")
async def test_session_factory(test_engine):
    yield async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )


# ── ASGI client with get_db overridden and lifespan disabled ──

@pytest_asyncio.fixture(scope="session")
async def client(test_session_factory):
    """HTTP client whose get_db yields a fresh session per request."""

    async def override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    # Replace lifespan with no-op so the module-level engine is never touched
    @asynccontextmanager
    async def _noop_lifespan(a):
        yield

    original_lifespan = app.router.lifespan_context
    app.router.lifespan_context = _noop_lifespan

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.router.lifespan_context = original_lifespan
    app.dependency_overrides.clear()
