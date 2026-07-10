import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fareback Finance | Rewards Ledger & Treasury Console",
  description: "Fareback finance manager treasury console for managing rewards, withdrawals, and wallet balances.",
};

export default function FinanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force light mode for finance panel regardless of user's global theme preference.
  // We use inline CSS vars to override next-themes dark class on <html>.
  return (
    <div
      className="light"
      style={{
        colorScheme: "light",
        // Background tokens
        ["--background" as string]: "0 0% 100%",
        ["--foreground" as string]: "240 10% 3.9%",
        ["--card" as string]: "0 0% 100%",
        ["--card-foreground" as string]: "240 10% 3.9%",
        ["--popover" as string]: "0 0% 100%",
        ["--popover-foreground" as string]: "240 10% 3.9%",
        // Fareback brand primary: emerald
        ["--primary" as string]: "160 84% 39%",        // emerald-600
        ["--primary-foreground" as string]: "0 0% 100%",
        ["--secondary" as string]: "240 4.8% 95.9%",
        ["--secondary-foreground" as string]: "240 5.9% 10%",
        ["--muted" as string]: "240 4.8% 95.9%",
        ["--muted-foreground" as string]: "240 3.8% 46.1%",
        ["--accent" as string]: "240 4.8% 95.9%",
        ["--accent-foreground" as string]: "240 5.9% 10%",
        ["--destructive" as string]: "0 84.2% 60.2%",
        ["--destructive-foreground" as string]: "210 40% 98%",
        ["--border" as string]: "240 5.9% 90%",
        ["--input" as string]: "240 5.9% 90%",
        // Ring matches emerald primary
        ["--ring" as string]: "160 84% 39%",
        ["--radius" as string]: "0.5rem",
      }}
      data-theme="light"
    >
      {children}
    </div>
  );
}
