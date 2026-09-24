import { NextResponse } from "next/server";
import { z } from "zod";
import { addIntentSignal, findOrCreateAcquisitionAccount, getAcquisitionDirective, scoreAcquisitionAccount } from "@/lib/acquisition";

export const runtime = "nodejs";

const schema = z.object({
  company: z.string().min(1).max(200),
  domain: z.string().max(250).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  companySize: z.string().max(80).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  contact: z.object({
    name: z.string().max(120).optional().nullable(),
    email: z.string().email().optional().nullable(),
    title: z.string().max(120).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
  }).optional(),
  signal: z.object({
    type: z.string().min(1).max(120),
    category: z.string().min(1).max(120),
    source: z.string().min(1).max(200),
    sourceUrl: z.string().url().max(1000).optional().nullable(),
    evidence: z.string().max(5000).optional().nullable(),
    strength: z.number().min(0).max(100).default(50),
    confidence: z.number().min(0).max(100).default(50),
    occurredAt: z.string().datetime().optional(),
  }),
  selectedProduct: z.string().max(120).optional().nullable(),
});

function authorized(request: Request) {
  const expected = process.env.ACQUISITION_INGEST_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  const header = request.headers.get("x-acquisition-token");
  return auth === `Bearer ${expected}` || header === expected;
}

export async function POST(request: Request) {
  if (!process.env.ACQUISITION_INGEST_TOKEN) {
    return NextResponse.json({ error: "Acquisition ingestion is not configured." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const account = await findOrCreateAcquisitionAccount({
    company: input.company,
    domain: input.domain,
    website: input.website,
    industry: input.industry,
    companySize: input.companySize,
    location: input.location,
    source: input.signal.source,
    primaryName: input.contact?.name,
    primaryEmail: input.contact?.email,
    primaryTitle: input.contact?.title,
    phone: input.contact?.phone,
    selectedProduct: input.selectedProduct,
  });
  const signal = await addIntentSignal({
    accountId: account.id,
    ...input.signal,
    occurredAt: input.signal.occurredAt ? new Date(input.signal.occurredAt) : undefined,
  });
  const qualification = await scoreAcquisitionAccount(account.id);
  const nextBestAction = await getAcquisitionDirective(account.id);
  return NextResponse.json({ ok: true, accountId: account.id, signalId: signal.id, qualification, nextBestAction });
}
