"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Market = "AO" | "PT";

type MarketContextType = {
  market: Market;
  setMarket: (m: Market) => void;
  /** Currency symbol: "Kz" | "€" */
  currency: string;
  /** Format a EUR price according to the active market */
  formatPrice: (eur: number) => string;
  /** Convert EUR → KZ (approximate rate) */
  eurToKz: (eur: number) => number;
};

const KZ_RATE = 965; // 1 EUR ≈ 965 Kz

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarketState] = useState<Market>("AO");

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("market") as Market | null;
    if (stored === "AO" || stored === "PT") {
      // Hydrate client-only state after the server render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarketState(stored);
    }
  }, []);

  function setMarket(m: Market) {
    setMarketState(m);
    localStorage.setItem("market", m);
  }

  const currency = market === "AO" ? "Kz" : "€";

  function eurToKz(eur: number) {
    return Math.round(eur * KZ_RATE);
  }

  function formatPrice(eur: number): string {
    if (market === "PT") {
      return `€ ${eur.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`;
    }
    return `Kz ${eurToKz(eur).toLocaleString("pt-AO")}`;
  }

  return (
    <MarketContext.Provider value={{ market, setMarket, currency, formatPrice, eurToKz }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within a MarketProvider");
  return ctx;
}
