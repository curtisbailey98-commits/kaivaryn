"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Role } from "@/lib/enums";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  organizationName: z.string().min(1).max(200),
});

export async function registerUser(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName"),
  });
  if (!parsed.success) {
    return { error: "Check name, email, password (10+ chars), and organization." };
  }
  const { name, email, password, organizationName } = parsed.data;
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return { error: "An account with that email already exists." };

  const slugBase = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "org";
  let slug = slugBase;
  let i = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${i++}`;
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: normalized,
      name,
      passwordHash,
      role: Role.VIEWER,
    },
  });
  const org = await prisma.organization.create({
    data: { name: organizationName, slug, isDemo: false },
  });
  await prisma.membership.create({
    data: { organizationId: org.id, userId: user.id, role: Role.OWNER },
  });
  // New orgs get no entitlements until activated — honest default
  await writeAudit({
    organizationId: org.id,
    actorId: user.id,
    action: "user.registered",
    entityType: "User",
    entityId: user.id,
  });
  return { ok: true };
}
