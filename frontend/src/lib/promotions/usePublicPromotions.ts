"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import type { PublicPromotion } from "./pricing";

let promotionRequest: Promise<PublicPromotion[]> | undefined;

function loadPromotions() {
  promotionRequest ??= fetchWithAuth("/api/promotions/active")
    .then((response) => response.data as PublicPromotion[])
    .catch((error: unknown) => {
      promotionRequest = undefined;
      throw error;
    });
  return promotionRequest;
}

export function usePublicPromotions() {
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);

  useEffect(() => {
    let active = true;
    void loadPromotions()
      .then((result) => {
        if (active) setPromotions(result);
      })
      .catch(() => {
        if (active) setPromotions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return promotions;
}
