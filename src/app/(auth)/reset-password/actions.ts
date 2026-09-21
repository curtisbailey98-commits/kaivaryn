"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function resetPassword(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (!token || password.length < 10) {
    return { error: "Invalid token or password too short." };
  }
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expires < new Date()) {
    return { error: "This reset link is invalid or expired." };
  }
  const passwordHash = await hash(password, 12);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  });
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  await writeAudit({
    actorId: record.userId,
    action: "password_reset.completed",
    entityType: "User",
    entityId: record.userId,
  });
  return { ok: true };
}
