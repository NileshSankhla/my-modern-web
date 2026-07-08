# ADR 0003 — RBAC and Audit Logging for Financial Actions

Status: Proposed
Date: 2026-06-30

## Context

Admin and finance users have high-impact capabilities (approving payouts, adjusting balances). Current route-level checks are insufficient for fine-grained control and forensic requirements.

## Decision

- Enforce RBAC at the server-action level: every server action that mutates financial state must check the caller's role/permissions.
- Record an immutable audit log row for each elevated action (admin adjustments, payout approvals, refund/reversal actions). Audit log fields: `id`, `actor_user_id`, `action_name`, `target_type`, `target_id`, `delta_amount`, `metadata`, `created_at`.
- Audit logs are append-only and accessible in the Finance admin UI with export and filtering by actor, date range, and action.

## Consequences

- Easier for compliance and internal investigations.
- Enables segmentation of duties: e.g., one user can approve withdrawals, another can execute bank transfer steps.

## Implementation Notes

- Store audit log in DB (Postgres/Neon) as an append-only table.
- Use server middleware wrappers that accept an `actionName` and `permission` and create the audit row inside the same transaction as the business mutation.

## Next Steps

- Define permission matrix for Finance and Admin roles.
- Implement server middleware and integrate with existing actions.

---

Derived from fareback-design-ledger.md
