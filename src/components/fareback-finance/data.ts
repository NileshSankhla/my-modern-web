// ============================================================================
// Fareback Finance — Shared types + formatting helpers
// ============================================================================

export type RewardType = "money" | "gift";

// ---------- Charts ----------------------------------------------------------

export interface RewardSummary {
  /** Money rewards already paid out (in paise) */
  disbursedMoney: number;
  /** Gift rewards already paid out (in paise) */
  disbursedGift: number;
  /** Money rewards pending approval / payout (in paise) */
  pendingMoney: number;
  /** Gift rewards pending approval / payout (in paise) */
  pendingGift: number;
}

export interface TopUserHolding {
  userId: string;
  name: string;
  walletBalance: number;
  paidRewards: number;
}

// ---------- Withdrawal requests --------------------------------------------

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  /** Amount in paise */
  amount: number;
  /** Current wallet balance in paise */
  walletBalance: number;
  type: RewardType;
  requestedAt: string;
}

// ---------- Manual debit / credit ------------------------------------------

export interface ManualEntry {
  id: string;
  userId: string;
  userName: string;
  /** Balance in paise */
  walletBalance: number;
  lastAction?: { type: "credit" | "debit"; amount: number; at: string };
}

// ---------- Wallet transaction history -------------------------------------

export type TxSection = "not_review" | "tracked" | "not_tracked" | "paid";

export interface WalletTransaction {
  id: string;
  userId: string;
  time: string;
  store: string;
  linkId: string;
  /** Amount in paise */
  amount: number;
  type: RewardType;
  section: TxSection;
  /** Present for paid section entries created via manual credit/debit */
  manual?: { kind: "credit" | "debit"; amount: number };
}

// ---------- Balance ---------------------------------------------------------

export interface BalanceRow {
  userId: string;
  userName: string;
  /** Cashback balance in paise */
  moneyBalance: number;
  /** Amazon rewards balance in paise */
  giftBalance: number;
}

// ---------- Formatting helpers ---------------------------------------------

/**
 * Format a paise value as INR string (e.g. 150000 paise → ₹1,500).
 * All amounts coming from the DB are stored in paise.
 */
export const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format((Number(paise) || 0) / 100);

/**
 * Format a paise value in compact lakhs notation (e.g. 1500000 → ₹15K or ₹1.5L).
 */
export const inrCompact = (paise: number): string => {
  const rupees = (Number(paise) || 0) / 100;
  if (rupees >= 10_00_000) {
    return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
};

/**
 * Format a raw rupees number (not paise) — use ONLY for display values
 * that are already in rupees.
 */
export const inrRupees = (rupees: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(rupees) || 0);
