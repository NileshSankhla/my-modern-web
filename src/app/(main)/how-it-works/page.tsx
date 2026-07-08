import type { Metadata } from "next";
import {
  User,
  ShoppingBag,
  ShoppingCart,
  IndianRupee,
  Wallet,
  CheckCircle,
} from "lucide-react";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "How It Works | Fareback",
  description: "Learn how to earn cashback on every purchase with Fareback.",
};

const steps = [
  {
    icon: User,
    title: "Create Free Account",
    description:
      "Sign up with Google or email in under 30 seconds. No credit card required.",
    color: "bg-primary text-primary-foreground",
    glowColor: "bg-primary/10",
  },
  {
    icon: ShoppingBag,
    title: "Choose a Store",
    description:
      "Browse our partner stores — Amazon, Flipkart, Myntra, and more — and tap 'Shop Now'.",
    color: "bg-blue-500 text-white",
    glowColor: "bg-blue-500/10",
  },
  {
    icon: ShoppingCart,
    title: "Shop Normally",
    description:
      "We redirect you to the store and activate tracking. Just shop as you always would.",
    color: "bg-violet-500 text-white",
    glowColor: "bg-violet-500/10",
  },
  {
    icon: IndianRupee,
    title: "Earn Cashback",
    description:
      "Your purchase is automatically tracked. Cashback appears in your wallet within 48 hours.",
    color: "bg-orange-500 text-white",
    glowColor: "bg-orange-500/10",
  },
  {
    icon: Wallet,
    title: "Withdraw via UPI",
    description:
      "Once confirmed (30–60 days), request a UPI payout instantly from the Wallet tab.",
    color: "bg-success text-success-foreground",
    glowColor: "bg-success/10",
  },
];

const TIPS = [
  "Start with an empty cart before clicking through Fareback",
  "Don't use browser coupon extensions during checkout",
  "Complete your purchase in the same browser session",
  "Bank and card offers still apply — they stack with cashback",
];

export default function HowItWorksPage() {
  return (
    <PageShell>
      <PageHeader
        backHref="/profile"
        title="How It Works"
        subtitle="5 simple steps to earn cashback"
      />

      {/* Steps */}
      <div className="relative mb-8">
        {/* Connecting line */}
        <div className="absolute left-[26px] top-10 bottom-10 w-[2px] bg-gradient-to-b from-primary/40 via-primary/20 to-primary/5" />

        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative flex gap-5">
                {/* Step icon */}
                <div
                  className={`relative z-10 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl shadow-md ${step.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1.5 pb-2">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pro tips */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="mb-3 text-sm font-bold text-foreground">
          💡 Tips for guaranteed tracking
        </h3>
        <div className="space-y-2">
          {TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-sm text-muted-foreground">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
