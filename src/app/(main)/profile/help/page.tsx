import type { Metadata } from "next";
import {
  MessageCircle,
  Mail,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle,
  Wallet,
  ShoppingCart,
  Store,
  Zap,
} from "lucide-react";
import Link from "next/link";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Help & Support | Fareback",
  description: "Get help with Fareback cashback — FAQs, tracking issues, and contact support.",
};

const FAQ_ITEMS = [
  {
    q: "How long does it take to track my purchase?",
    a: "Purchases are tracked within 48 hours of completion. You'll see it appear as 'Pending' in your Earnings page.",
    icon: Clock,
  },
  {
    q: "When can I withdraw my cashback?",
    a: "Rewards become withdrawable after the merchant return period ends (usually 30–60 days). Once confirmed, you can request a UPI payout from the Wallet tab.",
    icon: Wallet,
  },
  {
    q: "My purchase is not tracked. What do I do?",
    a: "Make sure you: (1) started with an empty cart, (2) clicked through Fareback first, (3) didn't use browser extensions or third-party coupon sites. If it still isn't tracked after 48 hours, contact us.",
    icon: ShoppingCart,
  },
  {
    q: "Is there a minimum withdrawal amount?",
    a: "No minimum. You can withdraw any confirmed amount in your wallet.",
    icon: CheckCircle,
  },
  {
    q: "Do bank offers and credit card discounts still apply?",
    a: "Yes. Bank discounts, card offers, and site-wide merchant deals remain valid. Fareback cashback is designed to stack on top whenever the order is tracked successfully.",
    icon: Zap,
  },
  {
    q: "How do I ensure my purchase tracks correctly?",
    a: "Start with an empty cart, click 'Shop Now' through Fareback, and complete your purchase in the same browser window without using external coupon tools or switching devices.",
    icon: Store,
  },
];

export default function HelpPage() {
  return (
    <PageShell>
      <PageHeader
        title="Help & Support"
        subtitle="Answers & contact options"
        backHref="/profile"
      />

      {/* Contact options */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href="mailto:support@fareback.in"
          className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 active:scale-[0.98]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">Email Support</p>
            <p className="text-xs text-muted-foreground">support@fareback.in</p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>

        <a
          href="https://www.instagram.com/fareback.inn/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 active:scale-[0.98]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10">
            <MessageCircle className="h-5 w-5 text-pink-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">Instagram DMs</p>
            <p className="text-xs text-muted-foreground">@fareback.inn</p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      </div>

      {/* How it works link */}
      <Link
        href="/how-it-works"
        className="mb-6 flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <HelpCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">How Fareback Works</p>
          <p className="text-xs text-muted-foreground">
            Step-by-step guide to earning cashback
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>

      {/* FAQ */}
      <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Frequently Asked Questions
      </p>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-snug text-foreground">
                    {item.q}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Response time note */}
      <div className="mt-6 rounded-2xl border border-border/50 bg-muted/30 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          We typically respond within 24–48 hours.
          <br />
          For urgent tracking issues, email is fastest.
        </p>
      </div>
    </PageShell>
  );
}
