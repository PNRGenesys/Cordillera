"""Tests for the transparent proxy.

They run the FastAPI app in-process and replace the upstream with a mock transport,
so no API or database is needed. What they protect is the part that is easy to get
wrong in a shared-client proxy: whose cookies travel with which request.
"""

from collections.abc import AsyncIterator, Callable
from contextlib import AsyncExitStack

import httpx
import pytest

from app.main import app
from app.proxy import build_api_client


def _upstream(request: httpx.Request) -> httpx.Response:
    """Stand-in for the Fastify API: logs in, and echoes what it received."""

    if request.url.path == "/api/auth/login":
        return httpx.Response(
            200,
            json={"ok": True},
            headers={"set-cookie": "cordillera_session=secret-token; Path=/; HttpOnly"},
        )
    return httpx.Response(
        200,
        json={
            "cookie": request.headers.get("cookie", ""),
            "acceptEncoding": request.headers.get("accept-encoding", ""),
        },
    )


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def visitors() -> AsyncIterator[Callable[[], httpx.AsyncClient]]:
    """Hands out browsers talking to the app, each with its own cookie jar.

    Separate clients are the point: one visitor's session must not reach another's.
    """

    # ASGITransport does not run the lifespan, so the upstream client is only the mock below.
    app.state.api_client = build_api_client(
        "http://api.test", httpx.Timeout(5.0), transport=httpx.MockTransport(_upstream)
    )
    async with AsyncExitStack() as browsers:

        def new_visitor() -> httpx.AsyncClient:
            edge = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://edge.test")
            browsers.push_async_callback(edge.aclose)
            return edge

        yield new_visitor
    await app.state.api_client.aclose()


@pytest.mark.anyio
async def test_relays_the_session_cookie_to_the_browser(visitors: Callable[[], httpx.AsyncClient]) -> None:
    response = await visitors().post("/api/auth/login")

    assert response.status_code == 200
    assert "cordillera_session=secret-token" in response.headers["set-cookie"]


@pytest.mark.anyio
async def test_a_session_never_leaks_to_the_next_visitor(visitors: Callable[[], httpx.AsyncClient]) -> None:
    """The upstream client is shared, so a cookie kept there would be replayed for everyone."""

    await visitors().post("/api/auth/login")
    response = await visitors().get("/api/auth/me")

    assert response.json()["cookie"] == ""


@pytest.mark.anyio
async def test_forwards_the_cookie_of_the_request_it_belongs_to(visitors: Callable[[], httpx.AsyncClient]) -> None:
    visitor = visitors()
    await visitor.post("/api/auth/login")
    response = await visitor.get("/api/auth/me")

    assert response.json()["cookie"] == "cordillera_session=secret-token"


@pytest.mark.anyio
async def test_asks_the_api_for_an_uncompressed_body(visitors: Callable[[], httpx.AsyncClient]) -> None:
    """httpx would inflate it right away; the edge compresses instead."""

    response = await visitors().get("/api/products", headers={"accept-encoding": "gzip"})

    assert response.json()["acceptEncoding"] == "identity"
