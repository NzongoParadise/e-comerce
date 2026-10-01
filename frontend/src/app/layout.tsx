import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import { CartProvider } from "@/context/CartContext";
import { MarketProvider } from "@/context/MarketContext";
import { FavoritesProvider } from "@/context/FavoritesContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "RUBRICA DILIGENTE (SU), LDA – Tecnologia Sem Fronteiras",
  description: "Computadores, iPhones e soluções tecnológicas para Angola e Portugal. Compre online com entrega rápida e segura.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-[#f5f6fa] text-gray-900">
        <MarketProvider>
          <CartProvider>
            <FavoritesProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </FavoritesProvider>
          </CartProvider>
        </MarketProvider>
      </body>
    </html>
  );
}
