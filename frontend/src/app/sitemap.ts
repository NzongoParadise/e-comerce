import type { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://e-comerce-sepia.vercel.app").replace(/\/$/, "");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ select: { slug: true, updatedAt: true }, where: { stock: { gt: 0 } } }),
    prisma.category.findMany({ select: { slug: true } }),
  ]);

  const now = new Date();
  const staticRoutes = ["", "/products", "/categories", "/promotions", "/b2b", "/info/about", "/info/contact", "/info/support", "/info/how-to-buy", "/info/payments", "/info/shipping", "/info/returns", "/info/warranty"];

  return [
    ...staticRoutes.map((path) => ({ url: siteUrl + path, lastModified: now, changeFrequency: path === "" || path === "/promotions" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : 0.6 })),
    ...categories.map((category) => ({ url: siteUrl + "/products?category=" + category.slug, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((product) => ({ url: siteUrl + "/products/" + product.slug, lastModified: product.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}