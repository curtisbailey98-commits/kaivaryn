import { getPricingConfig, centsToDollars } from "@/lib/pricing";

/** Public price teaser. Falls back to the seeded PricingConfig values if the database is briefly unavailable. */
export async function getPublicPriceTeaser(): Promise<{ seats: number; intro: number; standard: number }> {
  try {
    const c = await getPricingConfig();
    return { seats: c.introductorySeats, intro: centsToDollars(c.introductoryPriceCents), standard: centsToDollars(c.standardPriceCents) };
  } catch {
    return { seats: 10, intro: 10_000, standard: 20_000 };
  }
}
