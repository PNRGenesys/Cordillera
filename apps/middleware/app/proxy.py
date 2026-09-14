"""Transparent reverse proxy for the API.

The middleware sits on the critical path: the frontend calls `/api/*` and this
module forwards each request to the internal Fastify API, then returns its
response unchanged. Keeping it transparent means the frontend keeps using the
relative `/api/` path and the httpOnly session cookie keeps working, while the
API stops being reachable directly from the browser. Edge concerns (rate
limiting, edge auth) will hang off this single entry point later.
"""

from http.cookiejar import CookieJar

import httpx
from fastapi import Request, Response

# Hop-by-hop headers must not be forwarded; they describe a single transport hop,
# not the end-to-end message (RFC 7230). httpx sets Host/Content-Length itself.
HOP_BY_HOP_HEADERS = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "host",
        "content-length",
    }
)


class NoStoreCookieJar(CookieJar):
    """Cookie jar that never keeps anything.

    The httpx client is shared by every visitor, and its default jar would store each
    `Set-Cookie` the API returns and replay it on the next request — whoever made it. One
    customer's session would then be handed to everybody else. Cookies must only travel in
    the headers of the request they belong to, which `_forwardable_request_headers` already
    forwards, so this jar drops every cookie the upstream tries to store.

    It is passed to `AsyncClient(cookies=...)` as a plain `CookieJar`: httpx copies a
    `httpx.Cookies` into a fresh jar, but adopts a `CookieJar` instance as given.
    """

    def extract_cookies(self, response: object, request: object) -> None:
        return


def build_api_client(
    base_url: str,
    timeout: httpx.Timeout,
    transport: httpx.AsyncBaseTransport | None = None,
) -> httpx.AsyncClient:
    """Build the shared upstream client.

    The single place where it is created, so its no-store cookie policy cannot be
    bypassed by accident. `transport` is only passed by the tests.
    """

    return httpx.AsyncClient(
        base_url=base_url, timeout=timeout, transport=transport, cookies=NoStoreCookieJar()
    )


def _forwardable_request_headers(request: Request) -> dict[str, str]:
    """Copy client headers except hop-by-hop ones. Cookie is kept so the API
    still sees the session cookie.

    Accept-Encoding is replaced with `identity`: httpx decompresses every response
    transparently, so letting the API gzip it would only mean compressing and
    inflating the same bytes for nothing. The edge (nginx) compresses instead.
    """

    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS and key.lower() != "accept-encoding"
    }
    headers["accept-encoding"] = "identity"
    return headers


async def proxy_to_api(request: Request) -> Response:
    """Forward the incoming request to the Fastify API and relay its response.

    Preserves method, path, query string, headers, cookies and body in both
    directions. Set-Cookie headers are relayed individually so the browser
    receives the session cookie exactly as the API issued it.
    """

    client: httpx.AsyncClient = request.app.state.api_client

    # Same path and query as received; the client's base_url points at the API.
    # Fastify routes are all prefixed with /api, and request.url.path keeps that
    # prefix, so the target resolves to e.g. http://api:3000/api/products.
    target = request.url.path
    if request.url.query:
        target = f"{target}?{request.url.query}"

    body = await request.body()

    try:
        upstream = await client.request(
            method=request.method,
            url=target,
            headers=_forwardable_request_headers(request),
            content=body,
        )
    except httpx.RequestError:
        # The API is unreachable or timed out: report a bad gateway rather than
        # leaking an internal error.
        return Response(content=b'{"code":"bad_gateway","message":"Upstream API unavailable"}', status_code=502, media_type="application/json")

    # Relay response headers, dropping ones the ASGI server recomputes. Set-Cookie
    # is added separately (there can be several and they must stay distinct).
    excluded = {"content-length", "content-encoding", "transfer-encoding", "connection", "set-cookie"}
    response = Response(content=upstream.content, status_code=upstream.status_code)
    for key, value in upstream.headers.items():
        if key.lower() not in excluded:
            response.headers[key] = value
    for cookie in upstream.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", cookie)

    return response
