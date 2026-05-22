import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Cashback Rates Information",
  description: "Understanding cashback rates and how affiliate commissions work at Fareback.",
};

const AffiliateRatesPage = () => (
  <div className="container mx-auto max-w-4xl px-4 py-16">
    <div className="mb-8">
      <h1 className="text-4xl font-bold tracking-tight">Cashback Rates Information</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Understanding how cashback percentages work and what affects your earnings
      </p>
    </div>

    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>How Cashback Rates Are Determined</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            The cashback percentages displayed on our platform are based on affiliate commission rates
            we receive from our merchant partners. These rates can vary based on product categories,
            promotional periods, and partnership agreements.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variable Cashback Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Please note that the actual cashback credited to your wallet may differ from the displayed
            percentage due to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Different commission rates for specific product categories</li>
            <li>Promotional or sale items may have reduced commission rates</li>
            <li>Use of external coupons or discount codes not provided by Fareback</li>
            <li>Seasonal variations in merchant commission structures</li>
            <li>Product returns or cancellations after initial tracking</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission Tracking Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Affiliate commissions are confirmed by merchants after their standard cancellation and
            return periods. This typically ranges from 7 to 90 days depending on the merchant&apos;s
            policy. Your cashback becomes available for withdrawal only after commission confirmation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maximizing Your Cashback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            To ensure you receive the highest possible cashback:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Always start with an empty shopping cart before clicking through Fareback</li>
            <li>Complete your purchase in the same browser session</li>
            <li>Avoid using ad blockers or private browsing modes</li>
            <li>Keep your purchase within the merchant&apos;s terms and conditions</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transparency Commitment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            We are committed to providing transparent information about cashback rates. The rates
            displayed represent the maximum potential cashback based on current affiliate agreements.
            We regularly update our rates to reflect changes from merchant partners.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Your actual cashback amount will be visible in your earning history within 48 hours of
            purchase tracking, giving you complete clarity on your rewards.
          </p>
        </CardContent>
      </Card>
    </div>

    <div className="mt-12 rounded-lg border border-border/60 bg-muted/20 p-6 text-center">
      <p className="text-sm text-muted-foreground mb-4">
        Have questions about affiliate rates or cashback calculations?
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/#faq"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 text-base font-semibold transition-all hover:bg-accent"
        >
          View FAQs
        </Link>
        <a
          href="mailto:support@fareback.in"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
        >
          Contact Support
        </a>
      </div>
    </div>
  </div>
);

export default AffiliateRatesPage;
