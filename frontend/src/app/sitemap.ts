import type { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://e-comerce-sepia.vercel.app").replace(/\/$/, "");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Array<{ slug: string; updatedAt: Date }> = [];
  let categories: Array<{ slug: string }> = [];

  try {
    [products, categories] = await Promise.all([
      prisma.product.findMany({ select: { slug: true, updatedAt: true }, where: { stock: { gt: 0 } } }),
      prisma.category.findMany({ select: { slug: true } }),
    ]);
  } catch (error) {
    console.warn("Failed to load sitemap entries from the database; falling back to static routes.", error);
  }

  const now = new Date();
  const staticRoutes = ["", "/products", "/categories", "/promotions", "/b2b", "/info/about", "/info/contact", "/info/support", "/info/how-to-buy", "/info/payments", "/info/shipping", "/info/returns", "/info/warranty"];

  return [
    ...staticRoutes.map((path) => ({ url: siteUrl + path, lastModified: now, changeFrequency: path === "" || path === "/promotions" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : 0.6 })),
    ...categories.map((category) => ({ url: siteUrl + "/products?category=" + category.slug, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((product) => ({ url: siteUrl + "/products/" + product.slug, lastModified: product.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}