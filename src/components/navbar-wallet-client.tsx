"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet, ChevronDown } from "lucide-react";
import { formatPaiseAsINR } from "@/lib/utils";

const NavbarWalletClient = () => {
  const [totalBalanceInPaise, setTotalBalanceInPaise] = useState<number | null>(null);
  const [cashbackBalanceInPaise, setCashbackBalanceInPaise] = useState<number | null>(null);
  const [amazonRewardBalanceInPaise, setAmazonRewardBalanceInPaise] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await fetch("/api/user/wallet");
        if (res.ok) {
          const data = await res.json();
          setCashbackBalanceInPaise(data.cashbackBalanceInPaise ?? 0);
          setAmazonRewardBalanceInPaise(data.amazonRewardBalanceInPaise ?? 0);
          setTotalBalanceInPaise(data.totalBalanceInPaise ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallet();
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  if (isLoading || totalBalanceInPaise === null) {
    return (
      <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-semibold md:flex animate-pulse">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="w-12 h-4 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div ref={popoverRef} className="relative hidden md:block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted/70"
      >
        <Wallet className="h-4 w-4 text-primary" />
        <span>{formatPaiseAsINR(totalBalanceInPaise)}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background shadow-lg z-50">
          <div className="space-y-3 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Cashback</p>
              <p className="text-lg font-bold text-foreground">{formatPaiseAsINR(cashbackBalanceInPaise ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Amazon Rewards</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatPaiseAsINR(amazonRewardBalanceInPaise ?? 0)}</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Total Balance</p>
              <p className="text-lg font-bold text-primary">{formatPaiseAsINR(totalBalanceInPaise)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavbarWalletClient;
