"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

export type FavoriteProduct = {
  id: number;
  name: string;
  slug: string;
  category: string;
  specs: string;
  priceEUR: number;
  priceKZ?: number;
  stock?: number;
  oldPriceEUR?: number;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
};

type FavoritesContextValue = {
  favorites: FavoriteProduct[];
  isFavorite: (id: number) => boolean;
  toggleFavorite: (product: FavoriteProduct) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

function normalizeFavorites(value: unknown): FavoriteProduct[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<number, FavoriteProduct>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<FavoriteProduct>;
    if (!Number.isInteger(candidate.id) || !candidate.name || !candidate.slug) continue;
    byId.set(candidate.id!, {
      id: candidate.id!,
      name: String(candidate.name),
      slug: String(candidate.slug),
      category: String(candidate.category || "Geral"),
      specs: String(candidate.specs || ""),
      priceEUR: Number.isFinite(Number(candidate.priceEUR)) ? Number(candidate.priceEUR) : 0,
      ...(Number.isFinite(Number(candidate.priceKZ)) ? { priceKZ: Number(candidate.priceKZ) } : {}),
      ...(Number.isFinite(Number(candidate.stock)) ? { stock: Math.max(0, Math.floor(Number(candidate.stock))) } : {}),
      ...(Number.isFinite(Number(candidate.oldPriceEUR)) ? { oldPriceEUR: Number(candidate.oldPriceEUR) } : {}),
      ...(candidate.imageUrl ? { imageUrl: String(candidate.imageUrl) } : {}),
      ...(Number.isFinite(Number(candidate.rating)) ? { rating: Number(candidate.rating) } : {}),
      ...(Number.isFinite(Number(candidate.reviews)) ? { reviews: Number(candidate.reviews) } : {}),
    });
  }
  return [...byId.values()];
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      let localFavorites: FavoriteProduct[] = [];
      try {
        const stored = localStorage.getItem("tg_favorites");
        localFavorites = stored ? normalizeFavorites(JSON.parse(stored)) : [];
      } catch {
        localStorage.removeItem("tg_favorites");
      }

      const token = localStorage.getItem("jwt_token");
      if (token) {
        try {
          const response = await fetchWithAuth("/api/favorites", { cache: "no-store" });
          const remoteFavorites = normalizeFavorites(response.data);
          // Remote catalogue values are authoritative for IDs already present on the server.
          const merged = normalizeFavorites([...localFavorites, ...remoteFavorites]);
          if (!active) return;

          setFavorites(merged);
          localStorage.setItem("tg_favorites", JSON.stringify(merged));

          const remoteIds = new Set(remoteFavorites.map((item) => item.id));
          await Promise.allSettled(
            localFavorites
              .filter((item) => !remoteIds.has(item.id))
              .map((item) => fetchWithAuth("/api/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: item.id }),
              }))
          );
          if (active) setLoaded(true);
          return;
        } catch {
          // Keep local favorites available if the API is temporarily unavailable.
        }
      }

      if (!active) return;
      setFavorites(localFavorites);
      localStorage.setItem("tg_favorites", JSON.stringify(localFavorites));
      setLoaded(true);
    }

    void hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("tg_favorites", JSON.stringify(favorites));
  }, [favorites, loaded]);

  function toggleFavorite(product: FavoriteProduct) {
    const isRemoving = favorites.some((item) => item.id === product.id);
    setFavorites((current) => isRemoving
      ? current.filter((item) => item.id !== product.id)
      : [...current, product]);

    if (!loaded || !localStorage.getItem("jwt_token")) return;

    void fetchWithAuth(
      isRemoving ? "/api/favorites?productId=" + encodeURIComponent(product.id) : "/api/favorites",
      isRemoving
        ? { method: "DELETE" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id }),
          },
    ).catch(() => undefined);
  }

  return (
    <FavoritesContext.Provider value={{
      favorites,
      isFavorite: (id) => favorites.some((item) => item.id === id),
      toggleFavorite,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
}
