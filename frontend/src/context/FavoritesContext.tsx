"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type FavoriteProduct = {
  id: number;
  name: string;
  slug: string;
  category: string;
  specs: string;
  priceEUR: number;
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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tg_favorites");
    if (stored) {
      try {
        // Hydrate client-only state after the server render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFavorites(JSON.parse(stored));
      } catch {
        localStorage.removeItem("tg_favorites");
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("tg_favorites", JSON.stringify(favorites));
  }, [favorites, loaded]);

  function toggleFavorite(product: FavoriteProduct) {
    setFavorites((current) => current.some((item) => item.id === product.id)
      ? current.filter((item) => item.id !== product.id)
      : [...current, product]);
  }

  return <FavoritesContext.Provider value={{ favorites, isFavorite: (id) => favorites.some((item) => item.id === id), toggleFavorite }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
}
