import Image from "next/image";
import { Heart, Mail } from "lucide-react";
import FooterNavLink from "@/components/footer-nav-link";

const Footer = () => {
  const instagramUrl =
    process.env.NEXT_PUBLIC_INSTAGRAM_URL ||
    "https://www.instagram.com/fareback.inn/";

  return (
    <footer className="relative overflow-hidden border-t border-border/40 bg-background pt-16 pb-8">
      <div className="absolute top-0 left-1/2 h-[1px] w-[80%] max-w-4xl -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
      <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-[100px]" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 lg:gap-8">
          <div className="space-y-6 md:col-span-12 lg:col-span-6">
            <FooterNavLink
              href="/"
              className="inline-block transition-transform hover:scale-105"
              ariaLabel="Fareback home"
            >
            <Image
              src="/brand-name-dark.svg"
              alt="Fareback"
              width={164}
              height={64}
              className="h-10 w-auto dark:hidden"
            />
            <Image
              src="/brand-name-light.svg"
              alt="Fareback"
              width={164}
              height={64}
              className="hidden h-10 w-auto dark:block"
            />
          </FooterNavLink>

          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            India&apos;s trusted cashback platform. Shop from top brands,
            earn guaranteed rewards, and withdraw seamlessly via UPI.
          </p>

          <div className="flex gap-4 pt-2">
            <a
              href={instagramUrl}
              aria-label="Follow us on Instagram"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7 2C4.239 2 2 4.239 2 7v10c0 2.761 2.239 5 5 5h10c2.761 0 5-2.239 5-5V7c0-2.761-2.239-5-5-5H7Zm5 5.5A4.5 4.5 0 1 0 12 16.5a4.5 4.5 0 0 0 0-9Zm0 2A2.5 2.5 0 1 1 12 14.5a2.5 2.5 0 0 1 0-5Zm5.25-2a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
            <a
              href="mailto:support@fareback.in"
              aria-label="Email Support"
              className="group flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-2 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
            >
              <Mail className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                Support
              </span>
            </a>
          </div>
        </div>

        <div className="md:col-span-6 lg:col-span-3">
          <h3 className="mb-6 text-base font-bold text-foreground">Platform</h3>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>
              <FooterNavLink
                href="/#offers"
                className="group inline-flex items-center transition-colors hover:text-primary"
              >
                <span className="transition-transform group-hover:translate-x-1">Cashback Offers</span>
              </FooterNavLink>
            </li>
            <li>
              <FooterNavLink
                href="/#how-it-works"
                className="group inline-flex items-center transition-colors hover:text-primary"
              >
                <span className="transition-transform group-hover:translate-x-1">How It Works</span>
              </FooterNavLink>
            </li>
            <li>
              <FooterNavLink
                href="/#faq"
                className="group inline-flex items-center transition-colors hover:text-primary"
              >
                <span className="transition-transform group-hover:translate-x-1">FAQs</span>
              </FooterNavLink>
            </li>
          </ul>
        </div>

        <div className="md:col-span-6 lg:col-span-3">
          <h3 className="mb-6 text-base font-bold text-foreground">Legal</h3>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>
              <FooterNavLink
                href="/privacy"
                className="group inline-flex items-center transition-colors hover:text-primary"
              >
                <span className="transition-transform group-hover:translate-x-1">Privacy Policy</span>
              </FooterNavLink>
            </li>
            <li>
              <FooterNavLink
                href="/terms"
                className="group inline-flex items-center transition-colors hover:text-primary"
              >
                <span className="transition-transform group-hover:translate-x-1">Terms &amp; Conditions</span>
              </FooterNavLink>
            </li>
            <li>
              <FooterNavLink
                href="/affiliate-rates"
                className="group inline-flex items-center transition-colors hover:text-primary"
              >
                <span className="transition-transform group-hover:translate-x-1">*Cashback Rates</span>
              </FooterNavLink>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Fareback. All rights reserved.
        </p>
        <p className="flex items-center text-sm text-muted-foreground">
          Built with <Heart className="mx-1.5 h-4 w-4 animate-pulse text-destructive" /> for smart shoppers
        </p>
      </div>
    </div>
    </footer>
  );
};

export default Footer;
