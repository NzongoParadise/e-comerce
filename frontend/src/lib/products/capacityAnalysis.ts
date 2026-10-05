export type ProductCapacityAttribute = {
  name: string;
  value: string;
};

export type ProductCapacity = {
  id: number;
  name: string;
  attributes?: ProductCapacityAttribute[];
};

export type DetectedCapacity = {
  key: string;
  label: string;
  value: string;
  normalizedValue: number;
};

export type ProductCapacityAnalysis<T extends ProductCapacity = ProductCapacity> = {
  product: T;
  capacities: DetectedCapacity[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function capacityGroup(name: string, context: string) {
  const normalizedName = normalize(name);
  const normalizedContext = normalize(context);

  if (/\b(ram|memoria ram)\b/.test(normalizedName)) return { key: "ram", label: "Memória RAM" };
  if (/\b(vram|memoria grafica|memoria de video)\b/.test(normalizedName)) return { key: "graphics-memory", label: "Memória gráfica" };
  if (/\b(armazenamento|storage|disco)\b/.test(normalizedName)) return { key: "storage", label: "Armazenamento" };
  if (/\bmemoria\b/.test(normalizedName) && /\b(gddr|gpu|placa grafica|graphics|video)\b/.test(normalizedContext)) {
    return { key: "graphics-memory", label: "Memória gráfica" };
  }
  if (/\bmemoria\b/.test(normalizedName)) return { key: "memory", label: "Memória" };

  if (/\b(gddr|gpu|placa grafica|graphics|video|rtx|radeon)\b/.test(normalizedContext)) {
    return { key: "graphics-memory", label: "Memória gráfica" };
  }
  if (/\b(ram)\b/.test(normalizedContext)) return { key: "ram", label: "Memória RAM" };
  if (/\b(ssd|nvme|hdd|armazenamento|storage|disco)\b/.test(normalizedContext)) {
    return { key: "storage", label: "Armazenamento" };
  }
  return null;
}

function capacityInMegabytes(value: string) {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|KB)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const unit = match[2].toUpperCase();
  const multiplier = unit === "TB" ? 1_000_000 : unit === "GB" ? 1_000 : unit === "MB" ? 1 : 0.001;
  return Number.isFinite(amount) ? amount * multiplier : null;
}

export function analyzeProductCapacities<T extends ProductCapacity>(products: T[]): ProductCapacityAnalysis<T>[] {
  return products.map((product) => {
    const capacities: DetectedCapacity[] = [];
    const context = product.name;

    for (const attribute of product.attributes ?? []) {
      const group = capacityGroup(attribute.name, context);
      const normalizedValue = capacityInMegabytes(attribute.value);
      if (!group || normalizedValue === null) continue;
      if (capacities.some((capacity) => capacity.key === group.key)) continue;
      capacities.push({ ...group, value: attribute.value, normalizedValue });
    }

    const text = [product.name, ...(product.attributes ?? []).map(({ value }) => value)].join(" ");
    const capacityPattern = /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|KB)\b/gi;
    for (const match of text.matchAll(capacityPattern)) {
      const value = match[0];
      const before = text.slice(Math.max(0, (match.index ?? 0) - 48), match.index);
      const after = text.slice((match.index ?? 0) + value.length, (match.index ?? 0) + value.length + 32);
      const group = capacityGroup(`${before} ${after}`, context);
      const normalizedValue = capacityInMegabytes(value);
      if (!group || normalizedValue === null || capacities.some((capacity) => capacity.key === group.key)) continue;
      capacities.push({ ...group, value, normalizedValue });
    }

    return { product, capacities };
  });
}
