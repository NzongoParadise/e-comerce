export const calculatePortugalShipping = (weightKg: number, isExpress: boolean) => {
  const baseWeight = Math.max(weightKg, 0.1);

  let price = 0;
  if (baseWeight <= 0.5) price = 4.9;
  else if (baseWeight <= 1) price = 6.9;
  else if (baseWeight <= 2) price = 8.9;
  else if (baseWeight <= 3) price = 10.9;
  else if (baseWeight <= 5) price = 12.9;
  else if (baseWeight <= 10) price = 15.9;
  else if (baseWeight <= 15) price = 19.9;
  else price = 19.9 + Math.ceil(baseWeight - 15) * 1.9;

  return Number((isExpress ? price * 1.5 : price).toFixed(2));
};

export const estimateCartWeightKg = <T extends { quantity: number }>(items: T[]) =>
  items.reduce((total, item) => total + item.quantity * 0.65, 0);

export const calculateShipping = (options: {
  country: "AO" | "PT";
  deliveryMode: "address" | "pickup" | "business";
  shippingMethod: "standard" | "express" | "pickup";
  weightKg: number;
}) => {
  if (options.deliveryMode === "pickup" || options.shippingMethod === "pickup") return 0;
  if (options.country === "AO") return options.shippingMethod === "express" ? 15000 : 0;
  return calculatePortugalShipping(options.weightKg, options.shippingMethod === "express");
};
