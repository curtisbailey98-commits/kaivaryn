/**
 * Simplified integrations: import templates (billing export, 835-style remittance, contracts,
 * AR aging, timesheets), delimited parsing, Google Sheets link normalisation, and the per-org
 * inbound API (key issue/verify/revoke, auth, tenant isolation, dedupe on re-push).
 * Run: npm run test:integrations   (needs a seeded database)
 */
import { PrismaClient } from "@prisma/client";
import { IMPORT_TEMPLATES, getTemplate, parseDelimited, autoMap, previewTemplate, parseMoney } from "../src/lib/integrations/templates";
import { normalizeSheetUrl, fetchSheetCsv } from "../src/lib/integrations/sheets";
import { issueInboundToken, revokeInboundToken, verifyInboundToken, getInboundConnection, INBOUND_PROVIDER } from "../src/lib/integrations/inbound";
import { runTemplateImport } from "../src/lib/integrations/ingest";

const prisma = new PrismaClient();
let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    passed++;
    console.log("OK:", msg);
  }
}

async function pureTests() {
  console.log("--- templates & parsing ---");
  const csv = parseDelimited('Invoice #,Customer,Amount billed,Expected amount\nINV-1,"Smith, Jones & Co","$4,200.00",5100\nINV-2,Harbor,1800,1800\n');
  assert(csv.headers.length === 4 && csv.rows.length === 2 && csv.rows[0]!["Customer"] === "Smith, Jones & Co" && csv.rows[0]!["Amount billed"] === "$4,200.00", "CSV with quoted commas parses");
  const tsv = parseDelimited("Claim #\tPayer\tPaid\nC-1\tAetna\t0\n");
  assert(tsv.delimiter === "\t" && tsv.rows[0]!["Payer"] === "Aetna", "tab-separated paste from Excel/Sheets parses");
  const semi = parseDelimited("Customer;Balance\nAcme;1200\n");
  assert(semi.delimiter === ";" && semi.rows[0]!["Balance"] === "1200", "semicolon-separated parses");
  for (const [raw, want] of [["$4,200.00", 4200], ["(150.25)", -150.25], ["1 200", 1200], ["", null], ["abc", null]] as const) assert(parseMoney(raw) === want, `parseMoney ${JSON.stringify(raw)} → ${want}`);
  for (const t of IMPORT_TEMPLATES) {
    const s = parseDelimited(t.sample);
    const map = autoMap(t, s.headers);
    const req = t.fields.filter((f) => f.required).map((f) => f.key);
    assert(req.every((k) => map[k]), `${t.slug}: sample columns auto-map to every required field`);
    const pv = previewTemplate(t, s.rows, map);
    assert(pv.missingRequired.length === 0 && pv.errors === 0 && pv.willCreate >= 1, `${t.slug}: sample previews cleanly (${pv.willCreate} to create, ${pv.skipped} skipped)`);
  }
  const bill = getTemplate("billing_export")!;
  const bs = parseDelimited(bill.sample);
  const bp = previewTemplate(bill, bs.rows, autoMap(bill, bs.headers));
  assert(bp.willCreate === 1 && bp.skipped === 1 && bp.estimate === 900, "billing export: only underbilled invoices become items; gap is the estimate");
  const rem = getTemplate("payer_remittance")!;
  const rs = parseDelimited(rem.sample);
  const rp = previewTemplate(rem, rs.rows, autoMap(rem, rs.headers));
  assert(rp.willCreate === 2 && rp.skipped === 1, "remittance: denied + underpaid claims become items, paid-as-allowed skipped");
  const r1 = rem.transform({ claim_id: "C-1", payer: "Cigna", paid: "0", allowed: "520", denial_code: "CO-197" }, 2);
  assert("record" in r1 && Number(r1.record.estimatedAmount) === 520 && /Denied/.test(r1.record.title), "remittance: denied claim estimate = allowed amount");
  const r2 = rem.transform({ claim_id: "C-2", payer: "Aetna", paid: "610", allowed: "980", patient_resp: "120" }, 3);
  assert("record" in r2 && Number(r2.record.estimatedAmount) === 250, "remittance: underpayment = allowed − paid − patient responsibility");
  const missing = bill.transform({ invoice_id: "INV-9", customer: "", billed: "1", expected: "2" }, 2);
  assert("error" in missing, "missing required value is reported as a row error");
  assert(getTemplate("nope") === null, "unknown template is rejected");

  console.log("--- Google Sheets links ---");
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const e1 = normalizeSheetUrl(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=42`);
  assert(e1.ok && e1.url === `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=42`, "edit link → CSV export of the same tab");
  const e2 = normalizeSheetUrl(`https://docs.google.com/spreadsheets/d/e/2PACX-abc123/pub?output=csv`);
  assert(e2.ok && e2.url.includes("/pub?") && e2.url.includes("output=csv"), "published-to-web CSV link accepted");
  const e3 = normalizeSheetUrl(`https://docs.google.com/spreadsheets/d/e/2PACX-abc123/pubhtml`);
  assert(e3.ok && e3.url.includes("output=csv"), "published HTML link is converted to CSV output");
  for (const bad of ["https://evil.example/spreadsheets/d/x", "http://docs.google.com/spreadsheets/d/abc", "file:///etc/passwd", "https://docs.google.com.evil.io/spreadsheets/d/abc", "not a url"]) {
    assert(!normalizeSheetUrl(bad).ok, `rejects non-Google / unsafe link ${bad}`);
  }
  const fakeOk = (async () => new Response("Invoice #,Customer\nINV-1,Acme\n", { status: 200, headers: { "content-type": "text/csv" } })) as unknown as typeof fetch;
  assert((await fetchSheetCsv(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, fakeOk)).startsWith("Invoice #"), "fetchSheetCsv returns CSV text");
  const fakeLogin = (async () => new Response("<html>Sign in</html>", { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  let privErr = "";
  try {
    await fetchSheetCsv(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, fakeLogin);
  } catch (e) {
    privErr = (e as Error).message;
  }
  assert(/public|publish|share/i.test(privErr), "private sheet gives a clear ‘publish or share’ message");
  const fakeRedirect = (async () => new Response(null, { status: 302, headers: { location: "https://evil.example/x.csv" } })) as unknown as typeof fetch;
  let redirErr = "";
  try {
    await fetchSheetCsv(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, fakeRedirect);
  } catch (e) {
    redirErr = (e as Error).message;
  }
  assert(redirErr.length > 0, "redirects to non-Google hosts are refused");
}

async function dbTests() {
  console.log("--- inbound API & tenant isolation ---");
  const acme = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  const other = await prisma.organization.findUnique({ where: { slug: "other-co" } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@kaivaryn.com" } });
  if (!acme || !other || !demo) throw new Error("Seed fixtures missing — run the seed first");
  const tag = `itest${Date.now().toString(36)}`;
  const route = await import("../src/app/api/inbound/records/route");
  const post = (auth: string | null, body: string, ct = "application/json", qs = "") =>
    route.POST(new Request(`http://local/api/inbound/records${qs}`, { method: "POST", headers: { ...(auth ? { authorization: auth } : {}), "content-type": ct }, body }));
  const priorConns = await prisma.integrationConnection.findMany({ where: { organizationId: { in: [acme.id, other.id] }, provider: INBOUND_PROVIDER } });
  try {
    const { token: tA, hint } = await issueInboundToken(acme.id, demo.id);
    const { token: tB } = await issueInboundToken(other.id, null);
    assert(/^kvi_/.test(tA) && hint === tA.slice(-4), "inbound key issued with a visible hint only");
    const stored = await prisma.integrationConnection.findUnique({ where: { organizationId_provider: { organizationId: acme.id, provider: INBOUND_PROVIDER } } });
    assert(stored && !stored.configJson!.includes(tA) && stored.configJson!.includes("tokenHash"), "only a hash of the key is stored");
    assert(stored!.status !== "CONNECTED", "a fresh key is not shown as connected before data arrives");
    assert((await verifyInboundToken(`Bearer ${tA}`))?.organizationId === acme.id, "key verifies to its own organization");
    assert((await verifyInboundToken(tA.slice(0, -2) + "xx")) === null, "tampered key rejected");
    assert((await verifyInboundToken(`kvi_${stored!.id}_${"A".repeat(32)}`)) === null, "guessed secret for a real connection rejected");
    assert((await verifyInboundToken("")) === null, "empty key rejected");
    assert(await prisma.auditLog.findFirst({ where: { organizationId: acme.id, action: { in: ["inbound_key.issued", "inbound_key.rotated"] } , entityId: stored!.id } }), "key issue is audit-logged");

    // Route auth
    const body = JSON.stringify({ template: "billing_export", records: [{ invoice_id: `${tag}-1`, customer: "Inbound Test Co", billed: 100, expected: 350 }, { invoice_id: `${tag}-2`, customer: "Inbound Test Co", billed: 500, expected: 500 }] });
    assert((await post(null, body)).status === 401, "no key → 401");
    assert((await post("Bearer kvi_nope_nope", body)).status === 401, "malformed key → 401");
    assert((await post(`Bearer ${tA}`, JSON.stringify({ template: "bogus", records: [{ a: 1 }] }))).status === 400, "unknown template → 400");
    assert((await post(`Bearer ${tA}`, "{not json")).status === 400, "invalid JSON → 400");
    assert((await post(`Bearer ${tA}`, "<xml/>", "application/xml")).status === 415, "unsupported content type → 415");
    const tooMany = JSON.stringify({ template: "billing_export", records: Array.from({ length: 1001 }, () => ({})) });
    assert((await post(`Bearer ${tA}`, tooMany)).status === 413, "more than 1000 records → 413");

    // Tenant isolation: org comes from the key, not from the body
    const sneaky = JSON.stringify({ template: "billing_export", organizationId: other.id, records: [{ invoice_id: `${tag}-1`, customer: "Inbound Test Co", billed: 100, expected: 350 }, { invoice_id: `${tag}-2`, customer: "Inbound Test Co", billed: 500, expected: 500 }] });
    const res = await post(`Bearer ${tA}`, sneaky);
    const j = (await res.json()) as { ok: boolean; created: number; skipped: number; duplicates: number; importJobId: string };
    assert(res.status === 200 && j.ok && j.created === 1 && j.skipped === 1, "valid push creates the underbilled invoice, skips the fully billed one");
    const inA = await prisma.opportunity.findMany({ where: { organizationId: acme.id, sourceId: `inv:${tag}-1` } });
    const inB = await prisma.opportunity.findMany({ where: { sourceId: `inv:${tag}-1`, organizationId: { not: acme.id } } });
    assert(inA.length === 1 && inB.length === 0, "records land only in the key's organization (body organizationId ignored)");
    assert(Number(inA[0]!.estimatedAmount) === 250 && Number(inA[0]!.recoveredAmount ?? 0) === 0, "imported amount is an estimate; nothing recorded as recovered");
    const job = await prisma.importJob.findUnique({ where: { id: j.importJobId } });
    assert(job?.organizationId === acme.id && job.source === "WEBHOOK" && job.template === "billing_export", "import job recorded with source + template in the right org");
    const conn = await getInboundConnection(acme.id);
    assert(conn?.status === "CONNECTED" && conn.lastSyncAt, "connection becomes Connected only after data actually arrived");
    // Dedupe on re-push
    const again = (await (await post(`Bearer ${tA}`, body)).json()) as { created: number; duplicates: number };
    assert(again.created === 0 && again.duplicates === 1, "re-sending the same records creates no duplicates");
    // Other org's key writes to the other org only
    const resB = (await (await post(`Bearer ${tB}`, body)).json()) as { created: number };
    assert(resB.created === 1 && (await prisma.opportunity.count({ where: { organizationId: other.id, sourceId: `inv:${tag}-1` } })) === 1 && (await prisma.opportunity.count({ where: { organizationId: acme.id, sourceId: `inv:${tag}-1` } })) === 1, "each organization's key is isolated");
    // CSV push
    const csvRes = (await (await post(`Bearer ${tA}`, `Claim #,Payer,Allowed,Paid,Reason code\n${tag}-C1,Aetna,400,0,CO-50\n`, "text/csv", "?template=payer_remittance")).json()) as { created: number };
    assert(csvRes.created === 1 && (await prisma.opportunity.count({ where: { organizationId: acme.id, sourceId: `claim:${tag}-C1` } })) === 1, "CSV push with ?template= works");
    // Rotation & revocation
    const { token: tA2 } = await issueInboundToken(acme.id, demo.id);
    assert((await verifyInboundToken(tA)) === null && (await verifyInboundToken(tA2))?.organizationId === acme.id, "rotating the key invalidates the old one");
    await revokeInboundToken(acme.id, demo.id);
    assert((await verifyInboundToken(tA2)) === null && (await post(`Bearer ${tA2}`, body)).status === 401, "revoked key → 401");

    // File/Sheets path goes through the same pipeline, scoped to the org
    const sheet = await runTemplateImport({ organizationId: other.id, userId: null, templateSlug: "timesheets", rows: parseDelimited(getTemplate("timesheets")!.sample).rows.map((r) => ({ ...r })), source: "GOOGLE_SHEETS", fileName: `sheet ${tag}` });
    assert(sheet.received >= 1 && (await prisma.importJob.findUnique({ where: { id: sheet.jobId } }))?.organizationId === other.id, "Sheets/file import writes to the requested org only");
  } finally {
    await prisma.opportunity.deleteMany({ where: { sourceId: { in: [`inv:${tag}-1`, `inv:${tag}-2`, `claim:${tag}-C1`] } } });
    await prisma.importJob.deleteMany({ where: { organizationId: { in: [acme.id, other.id] }, OR: [{ source: "WEBHOOK" }, { fileName: `sheet ${tag}` }], createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
    // restore inbound connections to their prior state
    await prisma.integrationConnection.deleteMany({ where: { organizationId: { in: [acme.id, other.id] }, provider: INBOUND_PROVIDER, id: { notIn: priorConns.map((c) => c.id) } } });
    for (const c of priorConns) await prisma.integrationConnection.update({ where: { id: c.id }, data: { configJson: c.configJson, status: c.status, lastSyncAt: c.lastSyncAt } });
  }
}

async function main() {
  console.log("=== Kaivaryn integrations validation ===");
  await pureTests();
  await dbTests();
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
