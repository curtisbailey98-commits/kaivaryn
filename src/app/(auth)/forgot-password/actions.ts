"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function requestPasswordReset(formData: FormData): Promise<{ message: string }> {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  if (!email) return { message: "Enter your email." };

  const user = await prisma.user.findUnique({ where: { email } });
  // Always same message to avoid enumeration
  const generic =
    "If an account exists, a reset link was generated. (SMTP awaiting credentials — link logged server-side.)";

  if (!user) return { message: generic };

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60);
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expires },
  });
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const link = `${base}/reset-password?token=${token}`;
  // Stub email: log reset link
  console.info("[password-reset] awaiting SMTP credentials — reset link:", link);
  await writeAudit({
    actorId: user.id,
    action: "password_reset.requested",
    entityType: "User",
    entityId: user.id,
    metadata: { delivery: "logged_awaiting_smtp" },
  });
  return { message: generic };
}
