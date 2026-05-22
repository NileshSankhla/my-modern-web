"use client";

import { useState, useEffect, useCallback, type TouchEvent } from "react";
import {
  ArrowRight,
  HandCoins,
  Radar,
  ShoppingBag,
  Store,
  UserPlus,
} from "lucide-react";

interface HeroCarouselProps {
  favoritePlatform: string;
}

const HeroCarousel = ({ favoritePlatform }: HeroCarouselProps) => {
  const slides = [
    {
      title: "Create Your Free Account",
      description: "Sign in securely with Google in one click. No passwords to remember.",
      icon: UserPlus,
    },
    {
      title: "Choose Your Store",
      description: `Click on ${favoritePlatform} or any partner store to activate your secure tracking session.`,
      icon: Store,
    },
    {
      title: "Shop As Usual",
      description: "Ensure your cart is empty before clicking. Add items and checkout normally on the merchant's site.",
      icon: ShoppingBag,
    },
    {
      title: "Seamless Tracking",
      description: "Your purchase is automatically tracked within 48 hours and appears in your earning dashboard.",
      icon: Radar,
    },
    {
      title: "Withdraw Your Cash",
      description: "Once the merchant approves the cashback, withdraw it instantly directly to your bank via UPI.",
      icon: HandCoins,
    },
  ];

  const [current, setCurrent] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const interval = setInterval(next, 8000);
    return () => clearInterval(interval);
  }, [next]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = touchStartX - touchEndX;
    const swipeThreshold = 40;

    if (delta > swipeThreshold) {
      next();
    } else if (delta < -swipeThreshold) {
      prev();
    }

    setTouchStartX(null);
  };

  const CurrentIcon = slides[current].icon;

  return (
    <section id="how-it-works" className="relative overflow-hidden border-b border-border/40 bg-muted/5 py-24">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              How Fareback Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">Five simple steps to start earning real cash.</p>
          </div>

          <div
            className="relative overflow-hidden rounded-3xl border border-border/50 bg-background/60 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary/40 via-amber-500/40 to-primary/40" />

            <div className="px-6 py-12 sm:px-16 sm:py-16">
              <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 shadow-[0_0_30px_hsl(var(--primary)/0.2)] sm:h-32 sm:w-32">
                  <CurrentIcon
                    className="h-10 w-10 animate-in zoom-in text-primary duration-500 sm:h-14 sm:w-14"
                    key={current}
                  />
                </div>

                <div className="min-h-[140px] flex-1 text-center md:text-left">
                  <div className="mb-4 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Step {current + 1} of {slides.length}
                  </div>
                  <h3
                    className="mb-3 text-2xl font-extrabold text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 sm:text-3xl"
                    key={`title-${current}`}
                  >
                    {slides[current].title}
                  </h3>
                  <p
                    className="text-lg leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-700"
                    key={`desc-${current}`}
                  >
                    {slides[current].description}
                  </p>
                </div>
              </div>

              <div className="mt-12 flex items-center justify-between border-t border-border/40 pt-8">
                <div className="flex w-full max-w-xs gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i === current ? "w-1/2 bg-primary" : "w-1/6 bg-border hover:bg-border/70"
                      }`}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="hidden gap-3 sm:flex">
                  <button
                    onClick={prev}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    aria-label="Previous step"
                  >
                    <ArrowRight className="h-5 w-5 rotate-180" />
                  </button>
                  <button
                    onClick={next}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    aria-label="Next step"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
