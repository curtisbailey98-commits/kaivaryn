import { NextResponse } from "next/server";
import { verifyInboundToken } from "@/lib/integrations/inbound";
import { runTemplateImport } from "@/lib/integrations/ingest";
import { getTemplate, parseDelimited, IMPORT_TEMPLATES } from "@/lib/integrations/templates";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_RECORDS = 1000;

function err(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, message, ...extra }, { status });
}

function toStringRecord(r: unknown): Record<string, string> | null {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    if (v == null) out[k] = "";
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

/**
 * Inbound records API. Authorization: Bearer <organization inbound key> (issued on Integrations).
 * Body (JSON): { "template": "billing_export", "records": [ { "invoice_id": "INV-1", ... } ] }
 * or CSV text with ?template=<slug>. The organization comes from the key — never from the body.
 */
export async function POST(req: Request) {
  const auth = await verifyInboundToken(req.headers.get("authorization"));
  if (!auth) return err(401, "unauthorized", "Missing or invalid inbound key. Issue one on Integrations → Inbound API.");

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return err(413, "too_large", "Request body is larger than 2 MB.");
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return err(413, "too_large", "Request body is larger than 2 MB.");

  const url = new URL(req.url);
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  let templateSlug = url.searchParams.get("template") || "";
  let rows: Array<Record<string, string>> = [];

  if (ct.includes("application/json") || /^\s*[{[]/.test(raw)) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return err(400, "invalid_json", "Body is not valid JSON.");
    }
    const b = (Array.isArray(body) ? { records: body } : body) as { template?: unknown; records?: unknown };
    if (typeof b.template === "string") templateSlug = b.template;
    if (!Array.isArray(b.records)) return err(400, "invalid_body", "Send { \"template\": \"…\", \"records\": [ … ] }.");
    if (b.records.length > MAX_RECORDS) return err(413, "too_many_records", `Send at most ${MAX_RECORDS} records per request.`);
    rows = b.records.map(toStringRecord).filter((r): r is Record<string, string> => r !== null);
  } else if (ct.includes("text/csv") || ct.includes("text/plain") || ct.includes("text/tab-separated-values")) {
    rows = parseDelimited(raw).rows;
    if (rows.length > MAX_RECORDS) return err(413, "too_many_records", `Send at most ${MAX_RECORDS} rows per request.`);
  } else {
    return err(415, "unsupported_type", "Use Content-Type: application/json or text/csv.");
  }

  if (!getTemplate(templateSlug)) {
    return err(400, "unknown_template", `Unknown or missing template “${templateSlug}”.`, { templates: IMPORT_TEMPLATES.map((t) => t.slug) });
  }
  if (!rows.length) return err(400, "no_records", "No records found in the request.");

  try {
    const r = await runTemplateImport({ organizationId: auth.organizationId, userId: null, templateSlug, rows, source: "WEBHOOK", fileName: `API push · ${templateSlug}` });
    return NextResponse.json({ ok: true, importJobId: r.jobId, template: r.template, received: r.received, created: r.created, skipped: r.skipped, duplicates: r.duplicates, errors: r.errors.slice(0, 20) });
  } catch (e) {
    return err(400, "import_failed", e instanceof Error ? e.message : "Import failed");
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST JSON { template, records[] } or CSV (?template=) with Authorization: Bearer <inbound key>.",
    templates: IMPORT_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, fields: t.fields.map((f) => ({ key: f.key, required: Boolean(f.required) })) })),
  });
}
