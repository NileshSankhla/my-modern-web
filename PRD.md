# Fareback Product Requirements Document (PRD)

## 1. Product Overview
Fareback is a cashback platform that helps users earn rewards when shopping via partner merchants, starting with Amazon and expanding to additional stores. Users click out through Fareback affiliate links, purchases are tracked, rewards are credited to wallet balances, and withdrawals are requested via UPI.

## 2. Problem Statement
- Users miss cashback opportunities because tracking and payout workflows are fragmented.
- Existing cashback experiences often lack transparent tracking status and payout clarity.
- Manual reconciliation and claim handling create operational overhead for finance/admin teams.

## 3. Goals
- Deliver a reliable click-to-cashback journey with clear tracking states.
- Provide transparent user wallets for confirmed and pending rewards.
- Enable secure withdrawal requests with auditable finance workflows.
- Support merchant expansion beyond Amazon with scalable link management.

## 4. Non-Goals
- Building a full e-commerce checkout experience inside Fareback.
- Real-time partner-side order ingestion for all merchants in v1.
- International currencies and non-INR payouts in v1.

## 5. Target Users
1. **Shoppers**: Want to earn cashback with minimal extra effort.
2. **Finance Ops/Admins**: Need efficient review, reconciliation, and payout control.
3. **Growth Team**: Needs merchant/cashback management to scale partner coverage.

## 6. User Experience Requirements

### 6.1 Core User Flow
1. User signs up/signs in (Google or email).
2. User browses stores and cashback rates.
3. User taps **Shop Now** to redirect via Fareback tracking.
4. Fareback records click and tracking status.
5. Reward moves through pending/confirmed lifecycle.
6. User requests withdrawal when eligible.

### 6.2 Tracking Transparency
- Show clear statuses (e.g., unreviewed, tracked, approved, deleted).
- Show pending vs confirmed wallet amounts.
- Provide user-facing guidance for successful tracking.

### 6.3 Wallet & Withdrawals
- Support wallet types (cashback and Amazon rewards).
- Enforce minimum and maximum withdrawal limits.
- Show payout history and request lifecycle.

## 7. Functional Requirements

### FR-1 Authentication & Profile
- Users can register/login securely with Google/email.
- Session management and account security controls are enforced.

### FR-2 Merchant Discovery
- Display supported merchants with rates and branding.
- Surface “coming soon” merchants separately.

### FR-3 Click Tracking & Redirect
- Every outbound merchant click is tracked with merchant and user context.
- Redirect flow includes basic integrity, idempotency, and rate-limit protections.

### FR-4 Cashback Lifecycle
- Cashback entries map to tracked clicks.
- Finance/admin can review and update tracking outcomes.
- User balances reflect approved rewards and pending amounts separately.

### FR-5 Wallet Ledger & Auditability
- Financial changes are auditable and traceable.
- System supports reconciliation workflows and audit logs for sensitive actions.

### FR-6 Withdrawal Management
- Users can request withdrawals to UPI with validation checks.
- Admin/finance can review and action requests.
- Withdrawal status updates are visible to users.

### FR-7 Admin & Finance Console
- Admin panel for merchant link management and operational data tools.
- Finance panel for KPIs, transaction history, and withdrawal operations.
- Access control enforced for privileged actions.

### FR-8 Notifications & Communication
- Users receive key lifecycle communication (welcome and critical status updates).
- Support/contact paths are visible in product surfaces.

## 8. Non-Functional Requirements
- **Security**: Input validation, secure headers, anti-fraud/rate-limit controls, RBAC.
- **Reliability**: Durable financial records and recoverable reconciliation paths.
- **Performance**: Redirect and wallet reads should remain responsive under load.
- **Scalability**: Merchant configuration should be extensible without major rewrites.
- **Observability**: Health checks, audit logs, and operational dashboards for admin/finance.

## 9. Metrics & Success Criteria
- Click-to-tracked conversion rate.
- Tracked-to-approved conversion rate.
- Time from click to tracked status update.
- Withdrawal request success rate and processing time.
- Monthly active users and repeat shopper rate.
- Support/claim volume per 1,000 tracked clicks.

## 10. Constraints & Dependencies
- Affiliate network attribution windows and reporting delays.
- Merchant URL validation and partner policy compliance.
- Payment rails and UPI handling constraints.
- Infrastructure dependencies (database, Redis, email provider).

## 11. Risks & Mitigations
- **Attribution loss**: Mitigate with strict click-tracking guardrails and user education.
- **Fraud/abuse**: Mitigate with rate limiting, anomaly checks, and admin review tools.
- **Payout disputes**: Mitigate with auditable ledgers and clear status history.
- **Merchant expansion complexity**: Mitigate with configurable merchant/link architecture.

## 12. Rollout Plan
1. Stabilize Amazon-centric funnel and wallet/withdrawal reliability.
2. Strengthen finance reconciliation and audit tooling.
3. Expand to additional merchants with phased enablement and monitoring.
4. Iterate UX using conversion, tracking, and payout metrics.

## 13. Open Questions
- What are the target SLAs for moving rewards from tracked to approved?
- Which merchants are prioritized after Amazon for full affiliate integration?
- Should payout cadence be instant-on-approval or batched windows?
- What support workflow is needed for disputed/missing cashback claims?
