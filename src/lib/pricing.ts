import { prisma } from "./prisma";
import { STRIPE_PAYMENT_LINK_FALLBACK } from "./constants";

export async function getPricingConfig() {
  let config = await prisma.pricingConfig.findUnique({ where: { key: "default" } });
  if (!config) {
    config = await prisma.pricingConfig.create({
      data: {
        key: "default",
        introductorySeats: 10,
        introductoryPriceCents: 1_000_000,
        standardPriceCents: 2_000_000,
        currency: "USD",
        stripePaymentLink:
          process.env.STRIPE_PAYMENT_LINK || STRIPE_PAYMENT_LINK_FALLBACK,
        zoomMeetingUrl: process.env.ZOOM_MEETING_URL || "https://scheduler.zoom.us/curtis-bailey/kaivaryn-executive-demo",
      },
    });
  }
  if (!config.zoomMeetingUrl) {
    config = await prisma.pricingConfig.update({
      where: { key: "default" },
      data: { zoomMeetingUrl: process.env.ZOOM_MEETING_URL || "https://scheduler.zoom.us/curtis-bailey/kaivaryn-executive-demo" },
    });
  }
  return config;
}

export function centsToDollars(cents: number) {
  return cents / 100;
}
