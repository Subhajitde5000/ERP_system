"""
Tests for the production rate-limiting fix (audit issue A4).

Covers:
  1. `client_ip` key function — trusted-proxy logic and header-spoofing
     resistance.
  2. `resolve_storage_uri` — Redis verification and safe in-memory fallback.
  3. End-to-end 429 behaviour through the real exception handler, including
     proof that a spoofed X-Forwarded-For from an untrusted peer cannot
     bypass or redirect buckets, while a genuine proxy hop is honoured.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app import rate_limit
from app.rate_limit import client_ip, limiter, resolve_storage_uri


# ── Helpers ───────────────────────────────────────────────────────────────────


def fake_request(peer: str | None, xff: str | None = None) -> Request:
    """A minimal stand-in for a FastAPI Request (only what client_ip reads)."""
    headers = {"x-forwarded-for": xff} if xff is not None else {}
    client = SimpleNamespace(host=peer) if peer else None
    return SimpleNamespace(headers=headers, client=client)  # type: ignore[return-value]


# ── 1. client_ip key function ────────────────────────────────────────────────


def test_direct_connection_uses_the_tcp_peer():
    """No proxy headers → bucket on the socket address itself."""
    assert client_ip(fake_request("203.0.113.7")) == "203.0.113.7"


def test_missing_client_is_bucketed_as_unknown_not_crash():
    assert client_ip(fake_request(None)) == "unknown"


def test_xff_from_an_untrusted_peer_is_ignored():
    """The core spoofing guard: a public client cannot whitelist itself."""
    request = fake_request("203.0.113.7", xff="127.0.0.1, 10.0.0.1")
    assert client_ip(request) == "203.0.113.7"


def test_xff_from_a_trusted_peer_yields_rightmost_untrusted_hop():
    """nginx (127.0.0.1) appends the real client to the chain's right."""
    request = fake_request("127.0.0.1", xff="198.51.100.23")
    assert client_ip(request) == "198.51.100.23"


def test_xff_chain_skips_known_upstream_proxies():
    """client → external LB (8.8.8.8) → internal LB (10.0.0.5) → app.

    Walking right-to-left must skip the trusted internal hop and stop at the
    first untrusted address — the true client.
    """
    request = fake_request("10.0.0.5", xff="198.51.100.9, 203.0.113.50")
    assert client_ip(request) == "203.0.113.50"


def test_all_proxy_chain_falls_back_to_leftmost():
    """If every hop is a known proxy, trust the origin the chain claims."""
    request = fake_request("127.0.0.1", xff="10.1.2.3, 192.168.0.9")
    assert client_ip(request) == "10.1.2.3"


def test_malformed_xff_entries_are_treated_as_untrusted():
    """Garbage in the chain terminates the walk at that hop (never crash)."""
    request = fake_request("127.0.0.1", xff="not-an-ip, 198.51.100.4")
    # Rightmost untrusted is the valid public IP.
    assert client_ip(request) == "198.51.100.4"
    request = fake_request("127.0.0.1", xff="198.51.100.4, not-an-ip")
    # The malformed entry is itself untrusted → it is the bucket key.
    assert client_ip(request) == "not-an-ip"


def test_ipv6_loopback_is_trusted_and_v6_client_is_returned():
    request = fake_request("::1", xff="2001:db8::42")
    assert client_ip(request) == "2001:db8::42"


def test_extra_trusted_proxies_from_settings_are_honoured(monkeypatch):
    """TRUSTED_PROXIES lets operators whitelist public LB addresses."""
    import ipaddress

    extra = ipaddress.ip_network("203.0.113.64/26")
    monkeypatch.setattr(
        rate_limit, "_TRUSTED_NETWORKS", rate_limit._TRUSTED_NETWORKS + [extra]
    )
    # Peer inside the configured LB range: header is honoured.
    trusted = fake_request("203.0.113.70", xff="198.51.100.77")
    assert client_ip(trusted) == "198.51.100.77"
    # Peer outside it: header still ignored.
    untrusted = fake_request("203.0.113.200", xff="198.51.100.77")
    assert client_ip(untrusted) == "203.0.113.200"


def test_parse_networks_skips_garbage_without_raising():
    parsed = rate_limit._parse_networks(["10.0.0.0/8", "bogus", "", "192.168.1.5"])
    assert len(parsed) == 2


# ── 2. Storage resolution ────────────────────────────────────────────────────


def test_blank_or_memory_uri_stays_in_memory():
    assert resolve_storage_uri(None) == "memory://"
    assert resolve_storage_uri("") == "memory://"
    assert resolve_storage_uri("memory://") == "memory://"


def test_unreachable_redis_falls_back_to_memory():
    """The sandbox has no Redis: this exercises the real failure path."""
    assert resolve_storage_uri("redis://127.0.0.1:63999/0") == "memory://"


def test_reachable_redis_is_selected(monkeypatch):
    """When the ping succeeds the shared Redis URI is wired in."""

    class FakeClient:
        def ping(self):
            return True

    class FakeStorage:
        storage = FakeClient()

    monkeypatch.setattr(rate_limit, "storage_from_string", lambda uri: FakeStorage())
    assert resolve_storage_uri("redis://cache:6379/0") == "redis://cache:6379/0"


def test_failing_ping_falls_back_to_memory(monkeypatch):
    class FakeStorage:
        storage = SimpleNamespace(ping=lambda: (_ for _ in ()).throw(ConnectionError("down")))

    monkeypatch.setattr(rate_limit, "storage_from_string", lambda uri: FakeStorage())
    assert resolve_storage_uri("redis://cache:6379/0") == "memory://"


# ── 3. End-to-end 429 behaviour ──────────────────────────────────────────────

# The endpoint is decorated exactly ONCE at module level: slowapi registers
# limits per endpoint key (module.funcname), so re-decorating inside a helper
# would stack duplicate limits and consume the bucket 2-3x too fast.


@limiter.limit("3/minute")
async def limited(request: Request):
    return {"ok": True}


def _limited_app() -> FastAPI:
    """A throwaway app wired exactly like main.py: shared limiter + handler."""
    from app.main import rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.get("/limited")(limited)
    return app


@pytest.mark.asyncio
async def test_limit_enforced_and_returns_standard_error_envelope():
    """4th request within the window → 429 with ErrorDetail JSON + Retry-After."""
    limiter.reset()
    app = _limited_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        ok = [await ac.get("/limited") for _ in range(3)]
        blocked = await ac.get("/limited")

    assert all(r.status_code == 200 for r in ok)
    assert blocked.status_code == 429
    body = blocked.json()
    assert body["success"] is False
    assert body["error"] == "RATE_LIMIT_EXCEEDED"
    assert blocked.headers.get("retry-after") == "60"


@pytest.mark.asyncio
async def test_spoofed_xff_cannot_reset_the_bucket(monkeypatch):
    """Forging X-Forwarded-For must NOT change the bucket.

    The test client connects from 127.0.0.1, which is trusted by default;
    to simulate an app exposed directly to the internet we drop all trusted
    networks — the peer then becomes untrusted and its header is ignored.
    """
    monkeypatch.setattr(rate_limit, "_TRUSTED_NETWORKS", [])
    limiter.reset()
    app = _limited_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        for _ in range(3):
            await ac.get("/limited")
        # Spoof a new client IP on every request — same bucket, still blocked.
        blocked = await ac.get("/limited", headers={"X-Forwarded-For": "9.9.9.9"})
    assert blocked.status_code == 429


@pytest.mark.asyncio
async def test_genuine_proxy_sees_each_client_separately():
    """Through a trusted hop, different clients get different buckets."""
    limiter.reset()
    app = _limited_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        for _ in range(3):
            assert (await ac.get("/limited", headers={"X-Forwarded-For": "198.51.100.1"})).status_code == 200
        # First client is exhausted…
        assert (await ac.get("/limited", headers={"X-Forwarded-For": "198.51.100.1"})).status_code == 429
        # …but a second client behind the same proxy is unaffected.
        assert (await ac.get("/limited", headers={"X-Forwarded-For": "198.51.100.2"})).status_code == 200
