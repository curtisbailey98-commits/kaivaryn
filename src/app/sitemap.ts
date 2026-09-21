import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const paths = [
    "",
    "/solutions/revenue-recovery",
    "/solutions/operations-efficiency",
    "/how-it-works",
    "/intelligence",
    "/pricing",
    "/demo",
    "/company",
    "/contact",
  ];
  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
}
