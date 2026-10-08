"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import StorefrontMobileNav from "@/components/layout/StorefrontMobileNav";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isB2B = pathname === "/b2b" || pathname.startsWith("/b2b/");

  if (isAdmin || isB2B) {
    return <>{children}</>;
  }

  return (
    <div className="storefront-public min-h-screen bg-[#f7f8f8]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <StorefrontMobileNav />
    </div>
  );
}
