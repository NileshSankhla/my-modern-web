# ADR 0002 — Click-Token Attribution

Status: Proposed
Date: 2026-06-30

## Context

Manual claim review is expensive and error-prone. To make tracking verifiable and automatable, Fareback should create short-lived signed click tokens before redirecting users to partner sites and store them in Redis with a TTL equal to the merchant attribution window.

## Decision

- When a user clicks a partner merchant via Fareback, mint a signed click token: `{clickId, userId, merchantId, timestamp, trackingTag}`.
- Store the token in Redis with TTL = attributionWindow (configurable per merchant, default 30 days).
- Redirect the user to the affiliate URL with the `clickToken` encoded in a query param or as a short path. The merchant will not use the token, but it's the server-side record used to reconcile later.
- When a claim or a commissions CSV row arrives containing an orderId or trackingTag, attempt to match it to a click token first. Matching establishes a high-confidence "tracked" event.

## Consequences

- Pros:
  - Vastly improves automated matching rates.
  - Manual review becomes exceptional handling for misses.
- Cons:
  - Requires Redis and careful key TTL management.
  - Must account for cross-device flows (store token on server-side tied to clickId; allow user to sign-in to associate later).

## Implementation Notes

- Use a short random `clickId` (e.g., cuid2) as the key. Token payload is cryptographically signed (HMAC) so Finance can verify claims exported in CSVs.
- Edge/redirect path must only do a Redis read and redirect to avoid DB latency.
- Provide an Admin exception queue for unmatched rows with heuristics to attempt fuzzy match (email, amount, time-window).

## Next Steps

- Implement redirect endpoint and Redis key schema.
- Add matching logic to the reconciliation pipeline.

---

Derived from fareback-design-ledger.md
