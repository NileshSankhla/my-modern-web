import Link from "next/link";
import { ArrowLeft, User, ShoppingBag, ShoppingCart, DollarSign, Wallet } from "lucide-react";

const steps = [
  {
    icon: User,
    title: "Sign Up",
    description: "Create your free Fareback account in 10 seconds.",
  },
  {
    icon: ShoppingBag,
    title: "Choose Store",
    description: "Pick your favorite store from Fareback.",
  },
  {
    icon: ShoppingCart,
    title: "Shop As Usual",
    description: "Shop normally, we track your order without any extra step.",
  },
  {
    icon: DollarSign,
    title: "Earn Cashback",
    description: "Get cashback in your Fareback account.",
    highlight: true,
  },
  {
    icon: Wallet,
    title: "Withdraw",
    description: "Transfer your cashback directly to your UPI.",
    highlight: true,
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-background px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">How It Works</h1>
      </div>

      <p className="mb-8 text-sm font-medium text-muted-foreground">
        5 simple steps to earn cashback
      </p>

      {/* Vertical Stepper */}
      <div className="relative pl-6">
        {/* Dashed Line */}
        <div className="absolute left-[39px] top-6 bottom-8 w-[2px] border-l-2 border-dashed border-primary/30" />

        <div className="flex flex-col gap-10">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isHighlight = step.highlight;

            return (
              <div key={index} className="relative flex gap-6">
                <div
                  className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-sm ${
                    isHighlight ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isHighlight ? (
                    <span className="text-2xl font-bold">{index + 1}</span>
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <div className="flex flex-col justify-center pt-1">
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
