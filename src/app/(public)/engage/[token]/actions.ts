"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addAcquisitionActivity, buildCheckoutLink } from "@/lib/acquisition";

export async function startPostDemoCheckout(token: string) {
  const account = await prisma.acquisitionAccount.findUnique({ where: { checkoutToken: token } });
  if (!account || !account.checkoutReadyAt || account.paymentStatus === "PAID") redirect(`/engage/${token}`);
  const checkout = await buildCheckoutLink(account.id);
  if (!checkout) redirect(`/engage/${token}`);
  await prisma.acquisitionAccount.update({ where: { id: account.id }, data: { paymentStatus: "PENDING" } });
  await addAcquisitionActivity(account.id, "CHECKOUT_STARTED", "Post-demo Stripe checkout opened.");
  redirect(checkout);
}
