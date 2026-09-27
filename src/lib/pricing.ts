import { prisma } from "./prisma";
import { STRIPE_PAYMENT_LINK_FALLBACK, ZOOM_SCHEDULER_URL } from "./constants";

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
        zoomMeetingUrl: process.env.ZOOM_MEETING_URL || ZOOM_SCHEDULER_URL,
      },
    });
  }
  if (!config.zoomMeetingUrl) {
    config = await prisma.pricingConfig.update({
      where: { key: "default" },
      data: { zoomMeetingUrl: process.env.ZOOM_MEETING_URL || ZOOM_SCHEDULER_URL },
    });
  }
  return config;
}

export function centsToDollars(cents: number) {
  return cents / 100;
}

/** Prefer DB config, then env, then Kaivaryn scheduler constant. */
export function resolveZoomSchedulerUrl(zoomMeetingUrl?: string | null) {
  const fromDb = zoomMeetingUrl?.trim();
  if (fromDb) return fromDb;
  return process.env.ZOOM_MEETING_URL || ZOOM_SCHEDULER_URL;
}
