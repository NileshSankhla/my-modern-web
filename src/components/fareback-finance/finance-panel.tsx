"use client";

import { FinanceHeader } from "./header";
import { KpiBar } from "./kpi-bar";
import { ChartsSection } from "./charts-section";
import { WithdrawalRequests } from "./withdrawal-requests";
import { ManualDebitCredit } from "./manual-debit-credit";
import { TransactionHistory, type ClickRow } from "./transaction-history";
import { BillSection } from "./bill-section";
import { BalanceSection } from "./balance-section";


/**
 * Fareback Finance — admin treasury panel.
 *
 * Light-mode only, desktop-first. All data comes from
 * server-side props fetched in /app/finance/page.tsx.
 *
 * All monetary values from the DB are in paise.
 * The inr() helper in data.ts converts paise → rupees for display.
 */
export function FinancePanel({
  managerName = "Finance Manager",
  managerEmail = "",
  overview,
  topUsers = [],
  pendingWithdrawals = [],
  pendingGiftCards = [],
  users = [],
  clicks = [],
  walletTransactions = [],
}: {
  managerName?: string;
  managerEmail?: string;
  overview?: {
    totalCashbackBalance: number;
    totalAmazonBalance: number;
    totalPaidWithdrawals: number;
    totalFulfilledGiftCards: number;
    totalPendingWithdrawals: number;
    totalPendingGiftCards: number;
  };
  topUsers?: any[];
  pendingWithdrawals?: any[];
  pendingGiftCards?: any[];
  users?: any[];
  clicks?: ClickRow[];
  walletTransactions?: any[];
}) {
  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background: "linear-gradient(135deg, #f0fdf4 0%, #f8fafc 40%, #fef9f0 100%)",
      }}
    >
      <FinanceHeader managerName={managerName} managerEmail={managerEmail} />

      <main className="mx-auto max-w-screen-2xl space-y-6 px-6 py-8">
        {/* KPI summary bar */}
        <KpiBar overview={overview} pendingCount={pendingWithdrawals.length + pendingGiftCards.length} />

        {/* Charts */}
        <ChartsSection overview={overview} topUsers={topUsers} />

        {/* Withdrawal requests */}
        <WithdrawalRequests
          pendingWithdrawals={pendingWithdrawals}
          pendingGiftCards={pendingGiftCards}
        />

        {/* Manual debit / credit */}
        <ManualDebitCredit users={users} />

        {/* Click tracking history */}
        <TransactionHistory clicks={clicks} />

        {/* Wallet transactions (credits/debits) */}
        <BillSection walletTransactions={walletTransactions} />

        {/* Balances */}
        <BalanceSection users={users} />
      </main>
    </div>
  );
}
