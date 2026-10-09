/**
 * SpotOn sales-export importer + SpotOn demo workspace validation.
 * Pure checks always; tenant-isolated DB checks when DATABASE_URL is set (local DB only — never production).
 * Run: npm run test:spoton
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { autoMapSpotOn, mapSpotOnRows, parseSpotOnCsv, parseSpotOnDate, SPOTON_SAMPLE_CSV, SPOTON_SOURCE, SPOTON_TEMPLATE_HEADERS } from "../src/lib/integrations/spoton/export-format";
import { detectSpotOnSignals, buildSpotOnSummary, spotOnTotals, type SpotOnRow } from "../src/lib/integrations/spoton/summary";
import { buildSpotOnDemoDays, spotOnDemoCsv } from "../src/lib/integrations/spoton/demo-data";

let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) { failed++; console.error("FAIL:", msg); } else { passed++; console.log("OK:", msg); }
}
const root = join(__dirname, "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");
const DAY = 86_400_000;
const toRows = (m: ReturnType<typeof mapSpotOnRows>): SpotOnRow[] => m.rows.map((r) => ({ type: r.type, status: r.status, amount: r.amount, occurredAt: r.occurredAt, locationId: r.locationId, detailJson: JSON.stringify(r.detail) }));

// ── Pure: parsing & mapping ────────────────────────────────────────────────
{
  assert(parseSpotOnDate("2026-10-01")?.toISOString() === "2026-10-01T12:00:00.000Z", "ISO date → noon UTC");
  assert(parseSpotOnDate("10/1/26")?.toISOString().slice(0, 10) === "2026-10-01", "M/D/YY date");
  assert(parseSpotOnDate("13/40/2026") === null, "invalid date rejected");
  assert(parseSpotOnDate("2026-02-30") === null, "impossible date rejected");

  const m = mapSpotOnRows(parseSpotOnCsv(SPOTON_SAMPLE_CSV).rows);
  assert(m.missingRequired.length === 0 && m.granularity === "day", "sample CSV maps as a daily export");
  assert(SPOTON_TEMPLATE_HEADERS.every((h) => Object.values(m.mapping).includes(h)), "every template header is matched");
  assert(m.rows.filter((r) => r.type === "ORDER").length === 3 && m.rows.filter((r) => r.type === "REFUND").length === 2, "3 day rows + 2 refund rows (one day had $0 refunds)");
  const d1 = m.rows[0]!;
  assert(d1.amount === 7858.55 && d1.source === SPOTON_SOURCE && d1.sourceId.startsWith("day:spoton:main-st-sample:2026-09-28"), "net sales + stable day id");
  const det = d1.detail as Record<string, number>;
  assert(det.gross === 8142.5 && det.voids === 96.4 && det.comps === 61 && det.orderCount === 214, "detail keeps sales, voids, comps, orders");

  // Header variants SpotOn reports may use
  const alt = autoMapSpotOn(["Business Date", "Order Count", "Guest Count", "Gross Sales", "Void Amount", "Discount Total", "Refund Amount", "Tax", "Net Sales ($)"]);
  assert(alt.date === "Business Date" && alt.orders === "Order Count" && alt.sales === "Gross Sales" && alt.voids === "Void Amount" && alt.netSales === "Net Sales ($)", "flexible header matching (synonyms + contains)");
  const chk = mapSpotOnRows(parseSpotOnCsv("Order #,Closed At,Server,Gross Sales,Discounts,Refunds,Net Sales\n1001,2026-10-01 19:42,Ana,52.00,5.00,0,47.00\n1002,2026-10-01 20:10,Ben,40.00,0,40.00,0").rows);
  assert(chk.granularity === "check" && chk.rows.filter((r) => r.type === "ORDER").length === 2, "check-level export: one row per check");
  assert((chk.rows[0]!.detail as Record<string, unknown>).employee === "Ana" && (chk.rows[0]!.detail as Record<string, number>).orderCount === 1, "check-level keeps employee, orderCount 1");

  const bad = mapSpotOnRows(parseSpotOnCsv("Foo,Bar\n1,2").rows);
  assert(bad.missingRequired.includes("Date") && bad.rows.length === 0, "missing Date / money columns → nothing mapped");
  const mixed = mapSpotOnRows(parseSpotOnCsv("Date,Net Sales\n2026-10-01,100\nnot a date,50\n2026-10-02,abc\nTotal,150\n2026-10-01,100").rows);
  assert(mixed.rows.length === 1 && mixed.errors.length === 2 && mixed.skipped.length === 2, "bad date + bad amount are errors; totals row + duplicate day skipped");
  const derived = mapSpotOnRows(parseSpotOnCsv("Date,Sales,Discounts,Comps,Refunds\n2026-10-01,1000,20,10,5").rows);
  assert(derived.rows[0]!.amount === 965, "net sales derived when the export has no Net Sales column");
  const paren = mapSpotOnRows(parseSpotOnCsv('Date,Net Sales,Refunds\n2026-10-01,"$1,200.50",(45.00)').rows);
  assert(paren.rows[0]!.amount === 1200.5 && paren.rows[1]!.amount === 45, "currency formatting + negative-in-parentheses refunds");
}

// ── Pure: demo data + signals ───────────────────────────────────────────────
{
  const now = new Date("2026-10-07T16:00:00Z");
  const a = spotOnDemoCsv(buildSpotOnDemoDays(now));
  const b = spotOnDemoCsv(buildSpotOnDemoDays(now));
  assert(a === b, "demo data is deterministic");
  const m = mapSpotOnRows(parseSpotOnCsv(a).rows);
  assert(m.errors.length === 0 && m.rows.filter((r) => r.type === "ORDER").length === 90, "demo CSV imports 90 days cleanly through the SpotOn mapper");
  const rows = toRows(m);
  const latest = rows.reduce((x, r) => (r.occurredAt > x ? r.occurredAt : x), rows[0]!.occurredAt);
  const anchor = new Date(latest.getTime() + 12 * 3_600_000);
  const sig = detectSpotOnSignals(rows, anchor);
  const cd = sig.signals.find((s) => s.ruleId === "spoton_comps_discounts");
  const vd = sig.signals.find((s) => s.ruleId === "spoton_voids");
  assert(!sig.insufficient && cd && vd, "demo data fires comps/discounts and voids signals");
  assert(!sig.signals.find((s) => s.ruleId === "spoton_refunds"), "no refund signal (refunds stay at the usual rate)");
  if (cd && sig.recent && sig.base) {
    const rate = (x: number, of: number) => x / of;
    const expect = Math.round((rate(sig.recent.discounts + sig.recent.comps, sig.recent.grossSales) - rate(sig.base.discounts + sig.base.comps, sig.base.grossSales)) * sig.recent.grossSales);
    assert(cd.estimate === expect && Number.isInteger(cd.estimate), `comps estimate reconciles to (recent rate − baseline rate) × recent sales, whole dollars (${cd.estimate})`);
    assert(cd.description.includes("estimate, not money recovered"), "signal copy says it's an estimate");
  }
  const short = rows.filter((r) => r.occurredAt > new Date(anchor.getTime() - 40 * DAY));
  assert(detectSpotOnSignals(short, anchor).signals.length === 0, "no signals with < 90 days of history");
  const sum = buildSpotOnSummary(rows, anchor);
  const t = spotOnTotals(rows, new Date(anchor.getTime() - 30 * DAY), new Date(anchor.getTime() + 1));
  assert(sum.totals.netSales === t.netSales && sum.byDay.reduce((s, d) => s + d.orders, 0) === t.orders, "summary totals = sum of daily rows");
  assert(Math.abs(sum.averageCheck - t.netSales / t.orders) < 0.01, "average check = net sales ÷ orders");
}

// ── Source checks: honesty + rules ──────────────────────────────────────────
{
  const card = src("src/components/integrations/spoton-card.tsx");
  assert(!/>\s*Connected\s*</.test(card) && card.includes("Direct SpotOn connection: not available yet"), "SpotOn card never claims a live connection");
  assert(card.includes("Sales imported from SpotOn export"), "imported state says import, not connection");
  const page = src("src/app/(public)/spoton/page.tsx");
  assert(page.includes("not affiliated with") && page.includes("Kaivaryn is not a SpotOn integration partner today"), "SpotOn page: independence + no SpotOn-partner claim");
  assert(!/\$\d/.test(page) && !/%/.test(page.replace(/className="[^"]*"/g, "")), "SpotOn page: no invented prices, stats, or percentages");
  assert(page.includes('href="/pricing"') && !/logo|\.svg|\.png/i.test(page), "SpotOn page links existing pricing; no logos");
  assert(!/Larry|in-house AI|partner call|referral/i.test(page), "SpotOn page does not imply a deal with anyone");
  assert(page.includes("Book a demo"), "SpotOn page CTA is a demo, not a partner call");
  assert(page.includes('href="/kaivaryn-for-spoton.pdf" download') && page.includes("Download the one-pager (PDF)"), "SpotOn page offers the one-pager PDF as a download");
  {
    const pdf = readFileSync(join(process.cwd(), "public/kaivaryn-for-spoton.pdf"));
    const text = pdf.toString("latin1");
    assert(pdf.subarray(0, 5).toString() === "%PDF-" && !/\/JavaScript|\/Launch|\/EmbeddedFile/.test(text), "public one-pager is a plain PDF (no scripts or attachments)");
  }
  const cfg = src("next.config.mjs");
  assert(cfg.includes('source: "/partners/spoton"') && cfg.includes('destination: "/spoton"'), "old /partners/spoton URL redirects to /spoton");
  const seed = src("prisma/seed-spoton-demo.ts");
  assert(seed.includes("process.env.SPOTON_DEMO_PASSWORD") && !/SpotOn-[A-Za-z0-9]{10,}/.test(seed), "demo password only from env (never committed)");
  assert(seed.includes("isDemo: true") && seed.includes("runSpotOnImport"), "demo org is flagged isDemo and imports through the real SpotOn importer");
  const imp = src("src/lib/integrations/spoton/import.ts");
  assert(!/recoveredAmount|realizedSavings|verifiedAmount/.test(imp), "importer never writes recovered / realized amounts");
  const integ = src("src/app/app/integrations/page.tsx");
  assert(integ.includes("spotOnSelected && !systems.selected.includes(\"pos_square\")"), "SpotOn restaurants are not shown a Square card unless Square is selected or linked");
}

// ── DB (local only) ─────────────────────────────────────────────────────────
async function db() {
  const url = process.env.DATABASE_URL || "";
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) { console.log("SKIP: DB checks (DATABASE_URL not a local database)"); return; }
  const prisma = new PrismaClient();
  const { runSpotOnImport } = await import("../src/lib/integrations/spoton/import");
  const { runDetectionEngines } = await import("../src/lib/detection");
  const slugA = `spoton-test-a-${Date.now()}`;
  const slugB = `spoton-test-b-${Date.now()}`;
  const A = await prisma.organization.create({ data: { name: "SpotOn test A", slug: slugA } });
  const B = await prisma.organization.create({ data: { name: "SpotOn test B", slug: slugB } });
  try {
    const csv = spotOnDemoCsv(buildSpotOnDemoDays(new Date()));
    const r1 = await runSpotOnImport({ organizationId: A.id, userId: null, text: csv, fileName: "test.csv" });
    assert(r1.created === 180 && r1.errors.length === 0, `first import creates 90 day rows + 90 refund rows (${r1.created})`);
    const r2 = await runSpotOnImport({ organizationId: A.id, userId: null, text: csv, fileName: "test.csv" });
    assert(r2.created === 0 && r2.updated === 0 && r2.unchanged === 180, "re-import is idempotent (no duplicates)");
    assert((await prisma.transaction.count({ where: { organizationId: A.id } })) === 180, "row count unchanged after re-import");
    assert((await prisma.transaction.count({ where: { organizationId: B.id } })) === 0, "other tenant untouched");
    const job = await prisma.importJob.findUnique({ where: { id: r1.jobId } });
    assert(job?.status === "SUCCEEDED" && job.template === "spoton_sales_export", "import job recorded with SpotOn template");
    const d = await runDetectionEngines(A.id);
    assert(d.rulesFired.includes("spoton_comps_discounts") && d.rulesFired.includes("spoton_voids"), "detection turns imported SpotOn sales into estimates");
    const opps = await prisma.opportunity.findMany({ where: { organizationId: A.id } });
    assert(opps.length >= 2 && opps.every((o) => o.recoveredAmount === 0 && o.verifiedAmount === 0), "estimates only — nothing counted as recovered");
    await runDetectionEngines(A.id);
    assert((await prisma.opportunity.count({ where: { organizationId: A.id } })) === opps.length, "re-running detection doesn't stack duplicates");
    const bad = await runSpotOnImport({ organizationId: B.id, userId: null, text: "Foo,Bar\n1,2", fileName: "bad.csv" });
    assert(bad.created === 0 && bad.missingRequired.length > 0 && (await prisma.importJob.findUnique({ where: { id: bad.jobId } }))?.status === "FAILED", "wrong file → FAILED job, nothing written");

    const demo = await prisma.organization.findUnique({ where: { slug: "spoton-demo" } });
    if (demo) {
      assert(demo.isDemo, "seeded SpotOn demo org is isDemo");
      const rows = await prisma.transaction.count({ where: { organizationId: demo.id, source: SPOTON_SOURCE } });
      assert(rows === 180, `demo has 90 days of SpotOn rows (${rows})`);
      const won = await prisma.opportunity.findMany({ where: { organizationId: demo.id, recoveredAmount: { gt: 0 } } });
      for (const o of won) {
        const h = await prisma.statusHistory.findFirst({ where: { organizationId: demo.id, entityType: "Opportunity", entityId: o.id, toStatus: { in: ["RECOVERED", "PARTIALLY_RECOVERED", "VERIFIED"] }, actorId: { not: null } } });
        assert(h, `won-back "${o.title}" has a named recorder in history`);
      }
      const squareRows = await prisma.transaction.count({ where: { organizationId: demo.id, source: "square" } });
      assert(squareRows === 0, "demo has no Square data");
    } else console.log("SKIP: spoton-demo org not seeded locally");
  } finally {
    await prisma.organization.delete({ where: { id: A.id } }).catch(() => undefined);
    await prisma.organization.delete({ where: { id: B.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

db().then(() => {
  console.log(`\nSpotOn validation: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
