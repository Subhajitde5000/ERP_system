## 2025-05-10 - Missing Rate Limit on Password Reset Endpoints
**Vulnerability:** The tenant password reset endpoint `POST /api/v1/tenant/auth/reset-password` was missing rate limiting, leaving it open to potential token brute-force or abuse.
**Learning:** Endpoints requiring `Request` for slowapi rate limiting decorators must explicitly include `request: Request` in their FastAPI parameter signatures.
**Prevention:** Ensure all sensitive authentication or state-modifying endpoints have explicit rate limits configured in the router definition.
