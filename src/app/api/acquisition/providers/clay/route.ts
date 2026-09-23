import { NextResponse } from "next/server";
import { addIntentSignal, authorityScore, findOrCreateAcquisitionAccount, scoreAcquisitionAccount } from "@/lib/acquisition";
import { prisma } from "@/lib/prisma";
import { clayWebhookSchema, mapClayCompany, mapClayContact, mapClaySignal } from "@/lib/providers/clay";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.CLAY_WEBHOOK_SECRET;
  if (!expected) return false;
  const bearer = request.headers.get("authorization");
  const header = request.headers.get("x-clay-webhook-secret");
  return bearer === `Bearer ${expected}` || header === expected;
}

export async function POST(request: Request) {
  if (!process.env.CLAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Clay provider adapter is not configured." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = clayWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid Clay payload", details: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const company = mapClayCompany(input);
  const contact = mapClayContact(input);
  const signal = mapClaySignal(input);

  const account = await findOrCreateAcquisitionAccount({
    ...company,
    source: "CLAY",
    primaryName: contact?.name,
    primaryEmail: contact?.email,
    primaryTitle: contact?.title,
    phone: contact?.phone,
  });

  if (company.estimatedRevenue != null) {
    await prisma.acquisitionAccount.update({
      where: { id: account.id },
      data: { estimatedRevenue: company.estimatedRevenue },
    });
  }

  if (contact) {
    const existing = contact.email
      ? await prisma.acquisitionContact.findFirst({ where: { accountId: account.id, email: contact.email } })
      : null;
    if (existing) {
      await prisma.acquisitionContact.update({
        where: { id: existing.id },
        data: {
          name: contact.name || existing.name,
          title: contact.title || existing.title,
          phone: contact.phone || existing.phone,
          publicProfile: contact.publicProfile || existing.publicProfile,
          authorityScore: Math.max(existing.authorityScore, authorityScore(contact.title)),
          verified: Boolean(contact.verified || existing.verified),
          source: "CLAY",
        },
      });
    } else {
      await prisma.acquisitionContact.create({
        data: {
          accountId: account.id,
          name: contact.name || null,
          email: contact.email || null,
          title: contact.title || null,
          phone: contact.phone || null,
          publicProfile: contact.publicProfile || null,
          authorityScore: authorityScore(contact.title),
          verified: Boolean(contact.verified),
          source: "CLAY",
          isPrimary: Boolean(contact.email && contact.email === account.primaryEmail),
        },
      });
    }
  }

  const intent = await addIntentSignal({
    accountId: account.id,
    type: signal.type,
    category: signal.category,
    source: signal.source,
    sourceUrl: signal.sourceUrl,
    evidence: signal.evidence,
    strength: signal.strength,
    confidence: signal.confidence,
    occurredAt: signal.occurredAt,
  });
  const qualification = await scoreAcquisitionAccount(account.id);

  return NextResponse.json({
    ok: true,
    provider: "CLAY",
    accountId: account.id,
    signalId: intent.id,
    qualification,
  });
}
