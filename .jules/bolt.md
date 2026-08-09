## 2026-08-09 - [O(N) N+1 Database Query & Coroutine Bug in Events DTO]
**Learning:**
- Iterating over query results and fetching related record details (like Department/Class names or Creator names) in separate awaited database queries causes an N+1 query problem, creating massive round-trip latencies for the client and wasting database connection pool capacity.
- Fetching these related record attributes can be optimized from O(N) to O(1) database queries by collecting all foreign keys first, fetching them in bulk with `.in_()`, and performing in-memory dictionary lookups.
- Calling async functions within list comprehensions without calling `await` (e.g. `[_event_dto(event) for event in events]`) results in a list of raw, unresolved Python coroutine objects rather than finalized DTO models, creating hard-to-detect Pydantic serialization bugs when lists are empty in dummy test suites.

**Action:**
- Always batch-retrieve related entity names using `.in_()` queries instead of looping over records to fetch details one-by-one.
- Strictly double-check that all async helper methods called inside list comprehensions or loops are correctly awaited or resolved in bulk.
