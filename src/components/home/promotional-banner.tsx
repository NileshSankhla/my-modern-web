import Image from "next/image";
import { Sparkles } from "lucide-react";

interface PromotionalBannerProps {
  href: string;
}

export default function PromotionalBanner({ href }: PromotionalBannerProps) {
  return (
    <div className="w-full max-w-5xl mx-auto mt-16 px-4">
      <a
        href={href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="group relative block overflow-hidden rounded-2xl md:rounded-3xl border border-border/50 hover:border-orange-500/40 transition-all duration-500 shadow-xl hover:shadow-orange-500/20 bg-muted"
      >
        <div className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest shadow-lg">
          <Sparkles className="w-4 h-4 text-warning" />
          Featured Offer
        </div>

        <div className="relative w-full aspect-[16/9] md:aspect-[2.3/1] overflow-hidden">
          <Image
            src="/Promotionimage1.PNG"
            alt="Amazon 50-90% Off Fashion - Flat 4% Cashback"
            fill
            sizes="(max-width: 768px) 100vw, 1024px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            priority
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      </a>
    </div>
  );
}
