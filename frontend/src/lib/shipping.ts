const DEFAULT_PRODUCT_WEIGHT_GRAMS = 650;
const VOLUMETRIC_DIVISOR_CM3_PER_KG = 5000;

export type ShippingPhysicalItem = { quantity: number; weightGrams?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null };
const positive = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export const calculateVolumetricWeightKg = (item: ShippingPhysicalItem) => {
  const lengthCm = positive(item.lengthCm); const widthCm = positive(item.widthCm); const heightCm = positive(item.heightCm);
  if (!lengthCm || !widthCm || !heightCm) return 0;
  return (lengthCm * widthCm * heightCm) / VOLUMETRIC_DIVISOR_CM3_PER_KG;
};
export const calculateChargeableWeightKg = (item: ShippingPhysicalItem) => Math.max((positive(item.weightGrams) ?? DEFAULT_PRODUCT_WEIGHT_GRAMS) / 1000, calculateVolumetricWeightKg(item));
export const estimateCartWeightKg = <T extends ShippingPhysicalItem>(items: T[]) => items.reduce((total, item) => total + item.quantity * calculateChargeableWeightKg(item), 0);

export const calculatePortugalShipping = (weightKg: number, isExpress: boolean) => {
  const baseWeight = Math.max(weightKg, 0.1); let price = 0;
  if (baseWeight <= 0.5) price = 4.9; else if (baseWeight <= 1) price = 6.9; else if (baseWeight <= 2) price = 8.9; else if (baseWeight <= 3) price = 10.9; else if (baseWeight <= 5) price = 12.9; else if (baseWeight <= 10) price = 15.9; else if (baseWeight <= 15) price = 19.9; else price = 19.9 + Math.ceil(baseWeight - 15) * 1.9;
  return Number((isExpress ? price * 1.5 : price).toFixed(2));
};
export const calculateShipping = (options: { country: "AO" | "PT"; deliveryMode: "address" | "pickup" | "business"; shippingMethod: "standard" | "express" | "pickup"; weightKg: number }) => {
  if (options.deliveryMode === "pickup" || options.shippingMethod === "pickup") return 0;
  if (options.country === "AO") return options.shippingMethod === "express" ? 15000 : 0;
  return calculatePortugalShipping(options.weightKg, options.shippingMethod === "express");
};
export const SHIPPING_RULES = { volumetricDivisorCm3PerKg: VOLUMETRIC_DIVISOR_CM3_PER_KG, defaultProductWeightGrams: DEFAULT_PRODUCT_WEIGHT_GRAMS } as const;
