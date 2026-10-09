"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type B2BPriceRule = {
  id: number;
  minQuantity: number;
  unitPrice: number;
  currency: string;
};

export type B2BCartItem = {
  id: string;
  productId: number;
  name: string;
  slug: string;
  imageUrl?: string;
  quantity: number;
  stock: number;
  priceEUR: number;
  priceKZ: number;
  b2bPriceRules: B2BPriceRule[];
};

type B2BCartContextValue = {
  items: B2BCartItem[];
  isLoaded: boolean;
  addToCart: (item: B2BCartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
};

const STORAGE_KEY = "tg_b2b_cart";
const B2BCartContext = createContext<B2BCartContextValue | undefined>(undefined);

function normalizeItem(item: B2BCartItem): B2BCartItem {
  return {
    ...item,
    quantity: Math.max(1, Math.min(Math.floor(item.quantity), Math.max(1, item.stock))),
    b2bPriceRules: [...item.b2bPriceRules].sort((a, b) => a.minQuantity - b.minQuantity),
  };
}

export function getB2BUnitPrice(item: B2BCartItem, quantity: number, market: "AO" | "PT") {
  const currency = market === "PT" ? "EUR" : "AOA";
  const applicable = item.b2bPriceRules
    .filter((rule) => rule.currency === currency && rule.minQuantity <= quantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0];

  return applicable?.unitPrice ?? (market === "PT" ? item.priceEUR : item.priceKZ);
}

export function B2BCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<B2BCartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as B2BCartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((item) => item && Number.isInteger(item.productId)).map(normalizeItem));
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, isLoaded]);

  function addToCart(newItem: B2BCartItem) {
    setItems((current) => {
      const item = normalizeItem(newItem);
      const existing = current.find((entry) => entry.id === item.id);
      if (!existing) return [...current, item];
      return current.map((entry) =>
        entry.id === item.id
          ? normalizeItem({ ...entry, ...item, quantity: Math.min(entry.quantity + item.quantity, item.stock) })
          : entry
      );
    });
  }

  function removeFromCart(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? normalizeItem({ ...item, quantity }) : item
      )
    );
  }

  function clearCart() {
    setItems([]);
  }

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return (
    <B2BCartContext.Provider value={{ items, isLoaded, addToCart, removeFromCart, updateQuantity, clearCart, cartCount }}>
      {children}
    </B2BCartContext.Provider>
  );
}

export function useB2BCart() {
  const context = useContext(B2BCartContext);
  if (!context) throw new Error("useB2BCart must be used within B2BCartProvider");
  return context;
}
