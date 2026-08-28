"""
Rate limiting — single shared, production-ready limiter.

Why this module exists (audit issue A4)
---------------------------------------
Every router used to build its own limiter:

    limiter = Limiter(key_func=get_remote_address)

That pattern had two production defects:

1. **In-memory storage.** slowapi's default storage lives in one worker's
   RAM: counters reset on every restart and are never shared between
   uvicorn workers, so N workers silently allowed N × the intended rate.
2. **Wrong client key.** ``get_remote_address`` returns the TCP peer.
   Behind nginx / a cloud load balancer the peer is the proxy itself, so
   every user on earth shared one bucket (10 logins/min per *school*) —
   while a direct attacker could still rotate source IPs freely.

The fix
-------
* **One limiter** (this module) imported by every router and ``main.py`` —
  one shared counter store, one configuration surface.
* **Redis-backed counters** (``REDIS_URL``) so all workers share state.
  The connection is verified once at startup; if Redis is unreachable we
  fall back to in-memory storage and log a loud warning instead of
  failing every request.
* **A spoofing-resistant key function.** ``X-Forwarded-For`` is honoured
  only when the direct TCP peer is a trusted proxy, and the chain is
  walked right-to-left to find the first untrusted hop — the classic
  "rightmost untrusted" rule that makes header forgery useless.

Configuration
-------------
REDIS_URL          redis://host:6379/0   (already in Settings)
TRUSTED_PROXIES    optional comma-separated extra CIDRs, e.g. the public
                   IPs of your own load balancers. Private/loopback ranges
                   are always trusted (a container/sidecar proxy usually
                   talks to the app from a private address).
"""

from __future__ import annotations

import ipaddress
import logging
from typing import Iterable

from fastapi import Request
from limits.storage import storage_from_string
from slowapi import Limiter

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── Trusted-proxy resolution ──────────────────────────────────────────────────

# Proxies that never need configuring: loopback, RFC1918 private space,
# link-local (typical docker/sidecar/k8s service meshes) and their IPv6
# equivalents. An attacker on the public internet cannot originate from
# these ranges, so trusting them is safe and covers every common topology.
_DEFAULT_TRUSTED_CIDRS = (
    "127.0.0.0/8",     # IPv4 loopback
    "10.0.0.0/8",      # RFC1918
    "172.16.0.0/12",   # RFC1918
    "192.168.0.0/16",  # RFC1918
    "169.254.0.0/16",  # link-local (docker bridge, cloud metadata nets)
    "::1/128",         # IPv6 loopback
    "fc00::/7",        # IPv6 unique-local
    "fe80::/10",       # IPv6 link-local
)


def _parse_networks(entries: Iterable[str]) -> list[ipaddress._BaseNetwork]:
    """Parse IP/CIDR strings, skipping (and logging) malformed entries."""
    networks: list[ipaddress._BaseNetwork] = []
    for raw in entries:
        text = raw.strip()
        if not text:
            continue
        try:
            networks.append(ipaddress.ip_network(text, strict=False))
        except ValueError:
            logger.warning("TRUSTED_PROXIES: ignoring invalid entry %r", text)
    return networks


def _load_trusted_networks() -> list[ipaddress._BaseNetwork]:
    """Default trusted ranges + operator-supplied TRUSTED_PROXIES CIDRs."""
    settings = get_settings()
    extra = _parse_networks((settings.TRUSTED_PROXIES or "").split(","))
    networks = _parse_networks(_DEFAULT_TRUSTED_CIDRS) + extra
    if extra:
        logger.info("Rate limiter trusting %d extra proxy network(s)", len(extra))
    return networks


# Computed once at import; cheap membership checks on the hot path.
_TRUSTED_NETWORKS = _load_trusted_networks()


def _is_trusted_proxy(ip_text: str) -> bool:
    """True if ``ip_text`` belongs to a network we accept as a proxy."""
    try:
        address = ipaddress.ip_address(ip_text.strip())
    except ValueError:
        # Malformed value can never be trusted.
        return False
    return any(address in network for network in _TRUSTED_NETWORKS)


def client_ip(request: Request) -> str:
    """
    slowapi key function: the real client IP for rate-limit bucketing.

    Rules:
      * No ``X-Forwarded-For`` (or the direct peer is not a trusted proxy)
        → the TCP peer address. A forged header from an untrusted client is
        ignored entirely.
      * Trusted peer + ``X-Forwarded-For`` → walk the chain from the right
        (entries appended by our own infrastructure) and return the first
        address that is *not* a trusted proxy. If the whole chain consists
        of proxies, fall back to the leftmost entry.
    """
    direct = request.client.host if request.client else None
    if not direct:
        return "unknown"

    xff = request.headers.get("x-forwarded-for", "")
    hops = [hop.strip() for hop in xff.split(",") if hop.strip()]
    if not hops or not _is_trusted_proxy(direct):
        return direct

    for hop in reversed(hops):
        if not _is_trusted_proxy(hop):
            return hop
    # Every hop is a known proxy — use the origin the chain claims.
    return hops[0]


# ── Storage resolution (Redis with safe fallback) ─────────────────────────────


def resolve_storage_uri(uri: str | None) -> str:
    """
    Return the storage URI the limiter should use.

    Verifies Redis is actually reachable *before* wiring it in: a rate
    limiter that errors on every request is worse than one in memory.
    Any failure (bad URL, server down, missing driver) falls back to the
    in-memory store with a loud log so operators see the degraded mode.
    """
    if not uri or not uri.startswith("redis"):
        return "memory://"
    try:
        storage = storage_from_string(uri)
        # limits' RedisStorage exposes the underlying client as `.storage`.
        client = getattr(storage, "storage", None)
        if client is not None and hasattr(client, "ping"):
            client.ping()
        logger.info("Rate limiting: shared Redis storage at %s", uri)
        return uri
    except Exception as exc:  # noqa: BLE001 — any failure → degraded mode
        logger.warning(
            "Rate limiting: Redis unavailable (%s: %s) — falling back to "
            "in-memory storage. Limits will NOT be shared across workers "
            "and will reset on restart. Set REDIS_URL to a reachable Redis "
            "for production.",
            type(exc).__name__,
            exc,
        )
        return "memory://"


# ── The single shared limiter ─────────────────────────────────────────────────

settings = get_settings()

limiter = Limiter(
    key_func=client_ip,
    storage_uri=resolve_storage_uri(settings.REDIS_URL),
)
