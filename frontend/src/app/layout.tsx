import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

import { CartProvider } from "@/context/CartContext";
import { MarketProvider } from "@/context/MarketContext";
import { FavoritesProvider } from "@/context/FavoritesContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://e-comerce-sepia.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RUBRICA DILIGENTE (SU), LDA – Tecnologia Sem Fronteiras",
    template: "%s | RUBRICA DILIGENTE",
  },
  description: "Computadores, iPhones e soluções tecnológicas para Angola e Portugal. Compre online com entrega rápida e segura.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: siteUrl,
    siteName: "RUBRICA DILIGENTE (SU), LDA",
    title: "RUBRICA DILIGENTE – Tecnologia Sem Fronteiras",
    description: "Tecnologia, equipamentos e soluções para Angola e Portugal.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RUBRICA DILIGENTE – Tecnologia Sem Fronteiras",
    description: "Tecnologia, equipamentos e soluções para Angola e Portugal.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#f5f6fa] text-gray-900">
        <MarketProvider>
          <CartProvider>
            <FavoritesProvider>
              <AppShell>{children}</AppShell>
            </FavoritesProvider>
          </CartProvider>
        </MarketProvider>
      </body>
    </html>
  );
}
