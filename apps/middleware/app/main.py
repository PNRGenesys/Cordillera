"""FastAPI application entry point for the control-plane middleware.

The middleware is the single entry point in front of the API: every `/api/*`
request from the frontend is proxied to the internal Fastify service (see
proxy.py). Its own `/health` stays local so a slow API never marks it unhealthy.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

import httpx
from fastapi import FastAPI, Request, Response

from .config import get_settings
from .proxy import build_api_client, proxy_to_api


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create a shared httpx client so proxied requests reuse connections.

    The read timeout is generous because some API calls (checkout with an atomic
    inventory reservation) do real work; connect stays short to fail fast when
    the API is down. The client is shared by every visitor, so it is given a jar
    that stores no cookies (see `NoStoreCookieJar`).
    """

    settings = get_settings()
    timeout = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)
    async with build_api_client(settings.api_base_url, timeout) as client:
        app.state.api_client = client
        yield


app = FastAPI(title="Cordillera Middleware", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness endpoint used by the container healthcheck and monitoring.

    Kept intentionally cheap: it must not depend on downstream services so a
    slow API or gateway never makes this service look unhealthy.
    """

    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    """Basic identity endpoint to confirm which service answered."""

    settings = get_settings()
    return {"service": "cordillera-middleware", "api_base_url": settings.api_base_url}


# Catch-all for the API surface. Every method under /api/ is forwarded to the
# Fastify service; this includes the OpenAPI docs at /api/docs during development.
@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def api_proxy(request: Request, path: str) -> Response:
    return await proxy_to_api(request)
