import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const paths = [
    "",
    "/solutions/revenue-recovery",
    "/solutions/operations-efficiency",
    "/restaurants",
    "/spoton",
    "/platform",
    "/how-it-works",
    "/intelligence",
    "/value",
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
