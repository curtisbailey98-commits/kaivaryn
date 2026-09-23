"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Role } from "@/lib/enums";
import { findPaidAcquisitionForEmail, provisionPaidAcquisitionAccount } from "@/lib/acquisition";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  organizationName: z.string().min(1).max(200),
});

async function uniqueSlug(organizationName: string) {
  const slugBase = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "org";
  let slug = slugBase;
  let i = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) slug = `${slugBase}-${i++}`;
  return slug;
}

export async function registerUser(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName"),
  });
  if (!parsed.success) return { error: "Check name, email, password (10+ chars), and organization." };

  const { name, email, password, organizationName } = parsed.data;
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return { error: "An account with that email already exists." };

  // If Stripe has already verified this buyer, reuse the provisioned client workspace instead
  // of making them start over with an empty organization.
  const paidAccount = await findPaidAcquisitionForEmail(normalized);
  let paidOrgId = paidAccount?.onboardingOrganizationId || null;
  if (paidAccount && !paidOrgId) paidOrgId = await provisionPaidAcquisitionAccount(paidAccount.id);

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: { email: normalized, name, passwordHash, role: Role.VIEWER },
  });

  let orgId = paidOrgId;
  if (!orgId) {
    const slug = await uniqueSlug(organizationName);
    const org = await prisma.organization.create({ data: { name: organizationName, slug, isDemo: false } });
    orgId = org.id;
  }

  await prisma.membership.create({ data: { organizationId: orgId, userId: user.id, role: Role.OWNER } });

  if (paidAccount) {
    // Re-run idempotent provisioning now that the user exists so onboarding progress is attached.
    await provisionPaidAcquisitionAccount(paidAccount.id);
  }

  await writeAudit({
    organizationId: orgId,
    actorId: user.id,
    action: paidAccount ? "user.registered_from_verified_payment" : "user.registered",
    entityType: "User",
    entityId: user.id,
    metadata: paidAccount ? { acquisitionAccountId: paidAccount.id } : undefined,
  });
  return { ok: true };
}
