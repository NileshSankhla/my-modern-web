# ADR 0001 — Ledger vs Balance (Append-only wallet ledger)

Status: Proposed
Date: 2026-06-30

## Context

Fareback currently stores mutable balance columns on user records (e.g. `users.money_balance`). This approach prevents negative balances via guarded updates but provides no historical record of changes. For systems dealing with monetary value or gift-card balances, auditability, reconciliation, and forensics are essential.

## Decision

Introduce an append-only `wallet_ledger` table that records each balance-affecting event as a new row. The canonical ledger is the source of truth; per-user balance columns become a derived cache that can be recomputed from the ledger.

Ledger row fields (proposed):

- `id` (PK, uuid)
- `user_id` (FK)
- `wallet_type` (enum: `cashback`, `amazon_rewards`, etc.)
- `event_type` (enum: `click_tracked`, `claim_issued`, `withdrawal_requested`, `withdrawal_paid`, `admin_adjustment`, `reversal`, ...)
- `amount_in_paise` (signed int)
- `direction` (`credit`/`debit`)
- `source_reference` (nullable varchar) — affiliate click id/order id/withdrawal id/admin-note
- `balance_after_in_paise` (int) — snapshot after applying the event
- `metadata` (jsonb) — optional extensible data
- `created_at` (timestamp)

## Consequences

- Pros:
  - Full audit trail for every money-affecting event.
  - Reconciliation is possible by summing ledger rows.
  - Easier dispute resolution and forensic analysis.
  - Ledger-backed invariants are easier to test and reason about.
- Cons:
  - Slightly more complex writes — must append ledger row and update cache in the same transaction.
  - Requires migration and new operational discipline (run a recompute check job).

## Implementation Notes

- Writes that change balances must be transactional: append ledger row(s) + update `wallets` (or `users`) cache column in the same DB transaction.
- Add a background job that recomputes derived balances by summing the ledger and diffs against cached balance columns; emit alerts when mismatches occur.
- Add integrity checks and constraints where possible (e.g., non-null `amount_in_paise`), but prefer application-level validation for business rules.

## Related ADRs

- Click-token attribution (pending) — required to make `click_tracked` events verifiable.
- RBAC + Audit Logging — audit log will complement ledger events that require human review.

## Next Steps

- Add migration for `wallet_ledger` and API endpoints for adding ledger rows (transactional wrappers).
- Implement daily recompute-and-diff job and alerting.
- Update documentation and compliance notes.

---

Recorded from: fareback-design-ledger.md
