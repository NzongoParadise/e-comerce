import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://e-comerce-sepia.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/account/", "/api/"] }],
    sitemap: siteUrl + "/sitemap.xml",
    host: siteUrl,
  };
}