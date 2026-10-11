"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import StorefrontMobileNav from "@/components/layout/StorefrontMobileNav";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  clearAnalyticsVisitorId,
  getAnalyticsConsentSnapshot,
  subscribeToAnalyticsConsent,
  trackStorefrontEvent,
} from "@/lib/analytics";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const analyticsEnabled = useSyncExternalStore(subscribeToAnalyticsConsent, getAnalyticsConsentSnapshot, () => false);
  const lastTrackedPath = useRef("");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isB2B = pathname === "/b2b" || pathname.startsWith("/b2b/");
  const isPrivatePage = /^\/(account|admin|login|register|forgot-password|reset-password|auth)(\/|$)/.test(pathname)
    || /^\/b2b\/(conta|cotacoes|empresa|encomendas|financeiro|suporte|utilizadores)(\/|$)/.test(pathname);

  useEffect(() => {
    if (!analyticsEnabled) {
      clearAnalyticsVisitorId();
      lastTrackedPath.current = "";
      return;
    }
    if (isPrivatePage || lastTrackedPath.current === pathname) return;

    lastTrackedPath.current = pathname;
    trackStorefrontEvent("PAGE_VIEW", { path: pathname });
  }, [analyticsEnabled, isPrivatePage, pathname]);

  if (isAdmin || isB2B) {
    return <>{children}</>;
  }

  return (
    <div className="storefront-public min-h-screen bg-[#f4f6f5]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <StorefrontMobileNav />
    </div>
  );
}
