import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import MobileNav from "@/components/mobile-nav";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();


  return (
    <div id="booster_root" className="relative flex min-h-screen flex-col">
      <Navbar />
      {/* pb-16 on mobile to account for the fixed bottom nav bar */}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      {/* Footer: only on desktop */}
      <div className="hidden md:block">
        <Footer />
      </div>
      {/* Mobile bottom nav: only on mobile */}
      {user && (
        <div className="block md:hidden">
          <MobileNav />
        </div>
      )}
    </div>
  );
}
