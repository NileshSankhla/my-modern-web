"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

interface TrackingRedirectButtonProps {
  merchantId: number;
  merchantName: string;
  isAmazon: boolean;
}

const TrackingRedirectButton = ({ merchantId, merchantName, isAmazon }: TrackingRedirectButtonProps) => {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleRedirect = () => {
    if (isRedirecting) return;

    setIsRedirecting(true);
    window.location.href = `/api/redirect?merchantId=${merchantId}`;

    setTimeout(() => setIsRedirecting(false), 5000);
  };

  return (
    <button
      type="button"
      onClick={handleRedirect}
      disabled={isRedirecting}
      className={`group relative inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg transition-all overflow-hidden w-full sm:w-auto ${
        isRedirecting ? "cursor-not-allowed opacity-90" : "hover:shadow-xl hover:-translate-y-0.5"
      } ${
        isAmazon
          ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          : "bg-primary hover:bg-primary/90"
      }`}
    >
      <span className="relative z-10 flex items-center">
        {isRedirecting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {isAmazon ? "Locking Session & Tracking Rewards..." : "Locking Session & Redirecting..."}
          </>
        ) : (
          <>
            Continue to {merchantName}
            <ExternalLink className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </>
        )}
      </span>
    </button>
  );
};

export default TrackingRedirectButton;