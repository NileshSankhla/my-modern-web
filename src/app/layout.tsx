import type { Metadata ,Viewport} from "next"; 
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // This prevents annoying input zoom on mobile devices
  userScalable: false, // Additional protection against pinch-to-zoom
};
import "./globals.css";
import Providers from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter } from "next/font/google";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-sans",
});

const getMetadataBase = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    return new URL("https://fareback.in");
  }

  try {
    return new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`);
  } catch {
    return new URL("https://fareback.in");
  }
};

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  other: {
    "verify-admitad": "0900cdc72f",
  },
  title: {
    default: "Fareback",
    template: "%s | Fareback",
  },
  description:
    "Fareback helps users shop via affiliate offers, withdraw cashback, and convert Amazon rewards into gift cards.",
  keywords: ["cashback", "affiliate", "wallet", "UPI", "shopping", "amazon rewards"],
  authors: [{ name: "Fareback" }],
  alternates: {
    canonical: "/",
  },
  // 1. ADDED: PWA and iOS Install Metadata
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fareback",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Fareback",
    description:
      "Shop through Fareback partner cards, track eligibility, and request withdrawals to UPI.",
    siteName: "Fareback",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fareback",
    description:
      "Affiliate cashback and Amazon gift-card rewards made simple with manual wallet and conversion management.",
  },
  icons: {
    icon: [
      {
        url: "/favicon-black.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/favicon-black.svg",
    shortcut: [
      {
        url: "/favicon-black.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

// 2. REMOVED: `await cookies()` to allow Static Site Generation (SSG)
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    // 3. IMPORTANT: suppressHydrationWarning is required on <html> for next-themes
    <html lang="en" suppressHydrationWarning className={`scroll-smooth ${inter.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
};

export default RootLayout;