import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProductCapacities } from "./capacityAnalysis";

test("compares declared RAM capacities using a common unit", () => {
  const analysis = analyzeProductCapacities([
    { id: 1, name: "Portátil A", attributes: [{ name: "Memória RAM", value: "16 GB DDR4" }] },
    { id: 2, name: "Portátil B", attributes: [{ name: "RAM", value: "1 TB" }] },
  ]);

  assert.equal(analysis[0].capacities[0].key, "ram");
  assert.equal(analysis[0].capacities[0].normalizedValue, 16_000);
  assert.equal(analysis[1].capacities[0].normalizedValue, 1_000_000);
});

test("does not compare storage with graphics memory as the same capacity", () => {
  const analysis = analyzeProductCapacities([
    { id: 1, name: "SSD NVMe 1TB Gen4" },
    { id: 2, name: "Placa Gráfica RTX 4060 8GB" },
  ]);

  assert.deepEqual(analysis.map(({ capacities }) => capacities[0].key), ["storage", "graphics-memory"]);
});

test("uses technical attribute context to identify graphics memory", () => {
  const analysis = analyzeProductCapacities([
    { id: 1, name: "Placa Gráfica RTX 4060", attributes: [{ name: "Memória", value: "8 GB GDDR6" }] },
  ]);

  assert.equal(analysis[0].capacities[0].label, "Memória gráfica");
  assert.equal(analysis[0].capacities[0].value, "8 GB GDDR6");
});

test("does not invent capacities when specifications are absent", () => {
  const analysis = analyzeProductCapacities([
    { id: 1, name: "Acessórios TechGlobal" },
    { id: 2, name: "AirPods Pro (2.ª geração)" },
  ]);

  assert.deepEqual(analysis.map(({ capacities }) => capacities), [[], []]);
});
