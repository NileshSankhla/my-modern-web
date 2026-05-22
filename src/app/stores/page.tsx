import Link from "next/link";
import Image from "next/image";
import { Search, Store } from "lucide-react";
import { getAllMerchants, SUPPORTED_MERCHANT_NAMES, COMING_SOON_MERCHANT_NAMES } from "@/lib/data/merchants";

const Categories = ["All", "Fashion", "Electronics", "Travel", "Food"];

export default async function StoresPage() {
  let merchantList: any[] = [];
  try {
    merchantList = await getAllMerchants();
  } catch (error) {
    console.error("Failed to fetch merchants:", error);
  }

  const visibleMerchantList = merchantList.filter((merchant) =>
    SUPPORTED_MERCHANT_NAMES.has(merchant.name.trim().toLowerCase())
  );

  return (
    <div className="flex min-h-[100dvh] w-full flex-col space-y-6 overflow-x-hidden bg-background px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">All Stores</h1>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for stores"
          className="w-full rounded-2xl border border-border/50 bg-card py-4 pl-12 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {Categories.map((cat, i) => (
          <button
            key={cat}
            className={`flex-shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Store List */}
      <div className="flex flex-col gap-3">
        {visibleMerchantList.map((merchant) => {
          const merchantNameKey = merchant.name.trim().toLowerCase();
          const isComingSoon = COMING_SOON_MERCHANT_NAMES.has(merchantNameKey);
          const merchantHref = isComingSoon
            ? `/coming-soon/${merchantNameKey}`
            : `/merchants?merchantId=${merchant.id}`;

          return (
            <div key={merchant.id} className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-2">
                  {merchant.logoUrl ? (
                    <Image src={merchant.logoUrl} alt={merchant.name} width={32} height={32} className="object-contain" />
                  ) : (
                    <Store className="h-6 w-6 text-black" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold">{merchant.name}</h3>
                  <p className="text-xs font-medium text-primary">Upto {merchant.cashbackRate} Cashback</p>
                </div>
              </div>
              <Link
                href={merchantHref}
                className="rounded-xl bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Shop Now
              </Link>
            </div>
          );
        })}

        {visibleMerchantList.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No stores available right now.
          </div>
        )}
      </div>
    </div>
  );
}
