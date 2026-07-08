import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  AMAZON_REWARDS_WALLET_TYPE,
  DEFAULT_WALLET_TYPE,
  getWalletBalance,
} from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [cashbackWallet, amazonRewardWallet] = await Promise.all([
      getWalletBalance(user.id, DEFAULT_WALLET_TYPE),
      getWalletBalance(user.id, AMAZON_REWARDS_WALLET_TYPE),
    ]);

    return NextResponse.json(
      {
        cashbackBalanceInPaise: cashbackWallet.balanceInPaise,
        amazonRewardBalanceInPaise: amazonRewardWallet.balanceInPaise,
        totalBalanceInPaise: cashbackWallet.balanceInPaise + amazonRewardWallet.balanceInPaise,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
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
