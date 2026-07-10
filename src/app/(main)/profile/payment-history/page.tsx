import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/security/encryption";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";
import { db } from "@/lib/db";
import {
  withdrawalRequests,
  amazonGiftCardRequests,
  walletTransactions,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import PaymentHistoryClient, {
  type UnifiedHistoryItem,
} from "@/components/profile/payment-history-client";

export const metadata: Metadata = {
  title: "Payment & Financial Ledger | Fareback",
  description: "Enterprise-grade audit ledger of all UPI withdrawals, gift cards, and wallet settlements.",
};

export default async function PaymentHistoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/profile/payment-history");
  }

  const [withdrawals, giftCardRequests, ledgerTx] = await Promise.all([
    db
      .select({
        id: withdrawalRequests.id,
        amountInPaise: withdrawalRequests.amountInPaise,
        status: withdrawalRequests.status,
        upiIdEncrypted: withdrawalRequests.upiIdEncrypted,
        adminNote: withdrawalRequests.adminNote,
        createdAt: withdrawalRequests.createdAt,
        processedAt: withdrawalRequests.processedAt,
      })
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, user.id))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(100)
      .then((reqs) =>
        reqs.map((r) => ({
          ...r,
          upiId: decryptField(r.upiIdEncrypted),
        })),
      ),

    db
      .select({
        id: amazonGiftCardRequests.id,
        amountInPaise: amazonGiftCardRequests.amountInPaise,
        status: amazonGiftCardRequests.status,
        adminNote: amazonGiftCardRequests.adminNote,
        createdAt: amazonGiftCardRequests.createdAt,
        processedAt: amazonGiftCardRequests.processedAt,
      })
      .from(amazonGiftCardRequests)
      .where(eq(amazonGiftCardRequests.userId, user.id))
      .orderBy(desc(amazonGiftCardRequests.createdAt))
      .limit(100),

    db
      .select({
        id: walletTransactions.id,
        type: walletTransactions.type,
        amountInPaise: walletTransactions.amountInPaise,
        note: walletTransactions.note,
        walletType: walletTransactions.walletType,
        createdAt: walletTransactions.createdAt,
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, user.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(100),
  ]);

  const unifiedItems: UnifiedHistoryItem[] = [];

  // 1. Map UPI Withdrawals
  for (const w of withdrawals) {
    const isPaid = w.status === "paid" || w.status === "approved";
    const isRejected = w.status === "rejected";
    const isPending = !isPaid && !isRejected;

    unifiedItems.push({
      id: `upi-${w.id}`,
      category: "upi",
      title: "UPI Bank Payout Settlement",
      subtitle: w.upiId ? `Disbursement to UPI: ${w.upiId}` : "Direct UPI Bank Transfer",
      amountInPaise: w.amountInPaise,
      isCredit: false,
      status: isPaid ? "completed" : isRejected ? "rejected" : "pending",
      statusLabel: isPaid
        ? "DISBURSED / SETTLED"
        : isRejected
        ? "REJECTED — RETURNED TO WALLET"
        : "QUEUED FOR DISBURSEMENT",
      timestamp: formatDate(w.createdAt),
      rawDate: w.createdAt.getTime(),
      referenceId: `#UPI-${w.id}`,
      note: w.adminNote || undefined,
    });
  }

  // 2. Map Gift Card Requests
  for (const g of giftCardRequests) {
    const isFulfilled = g.status === "fulfilled" || g.status === "approved";
    const isRejected = g.status === "rejected";
    const isPending = !isFulfilled && !isRejected;

    unifiedItems.push({
      id: `gift-${g.id}`,
      category: "gift_card",
      title: "Amazon Pay Gift Card Redemption",
      subtitle: "Electronic Gift Voucher Claim",
      amountInPaise: g.amountInPaise,
      isCredit: false,
      status: isFulfilled ? "completed" : isRejected ? "rejected" : "pending",
      statusLabel: isFulfilled
        ? "VOUCHER DELIVERED"
        : isRejected
        ? "CLAIM REJECTED"
        : "PROCESSING VOUCHER",
      timestamp: formatDate(g.createdAt),
      rawDate: g.createdAt.getTime(),
      referenceId: `#GIFT-${g.id}`,
      note: g.adminNote || undefined,
    });
  }

  // 3. Map Wallet Ledger Transactions
  for (const t of ledgerTx) {
    const isCredit = t.type === "credit";

    unifiedItems.push({
      id: `ledger-${t.id}`,
      category: "ledger",
      title: isCredit
        ? "Ledger Credit Adjustment"
        : "Ledger Debit Settlement",
      subtitle:
        t.walletType === "amazon_rewards"
          ? "Amazon Pay Rewards Wallet"
          : "Withdrawable Cashback Wallet",
      amountInPaise: t.amountInPaise,
      isCredit: isCredit,
      status: "completed",
      statusLabel: "IMMUTABLE LEDGER RECORD",
      timestamp: formatDate(t.createdAt),
      rawDate: t.createdAt.getTime(),
      referenceId: `#LEDGER-${t.id}`,
      note: t.note || undefined,
    });
  }

  const totalPaidOut =
    withdrawals
      .filter((w) => w.status === "paid" || w.status === "approved")
      .reduce((acc, w) => acc + w.amountInPaise, 0) +
    giftCardRequests
      .filter((g) => g.status === "fulfilled" || g.status === "approved")
      .reduce((acc, g) => acc + g.amountInPaise, 0);

  const totalPending =
    withdrawals
      .filter((w) => w.status === "pending")
      .reduce((acc, w) => acc + w.amountInPaise, 0) +
    giftCardRequests
      .filter((g) => g.status === "pending")
      .reduce((acc, g) => acc + g.amountInPaise, 0);

  const totalLedgerCount = unifiedItems.length;

  return (
    <PageShell>
      <PageHeader
        title="Payment & Financial Ledger"
        subtitle="Complete audit trail of all UPI payouts, gift cards, and wallet settlements"
        backHref="/profile"
      />

      <div className="mt-4">
        <PaymentHistoryClient
          items={unifiedItems}
          totalPaidOut={totalPaidOut}
          totalPending={totalPending}
          totalLedgerCount={totalLedgerCount}
        />
      </div>
    </PageShell>
  );
}
