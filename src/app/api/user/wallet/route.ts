import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  AMAZON_REWARDS_WALLET_TYPE,
  DEFAULT_WALLET_TYPE,
  getWalletBalance,
} from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [cashbackBalanceInPaise, amazonRewardBalanceInPaise] = await Promise.all([
      getWalletBalance(user.id, DEFAULT_WALLET_TYPE),
      getWalletBalance(user.id, AMAZON_REWARDS_WALLET_TYPE),
    ]);

    return NextResponse.json(
      {
        cashbackBalanceInPaise,
        amazonRewardBalanceInPaise,
        totalBalanceInPaise: cashbackBalanceInPaise + amazonRewardBalanceInPaise,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Wallet API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
