/**
 * Money recovered (proof-of-value) tracker validation.
 * Pure checks always; tenant-isolated DB checks when DATABASE_URL is set (local DB only).
 * Run: npm run test:recovery
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  buildRecoveryTracker,
  classifyStage,
  canConfirmRealized,
  describeRecovery,
  getRecoveryTracker,
  recoveryLedgerToCsv,
  sourceLabelFor,
  type RecoverySourceRow,
  type RecoveryTracker,
} from "../src/lib/recovery/tracker";
import { getCumulativeValueSeries } from "../src/lib/chart-data";
import { effectiveRole } from "../src/lib/rbac";
import { decideWonBackOnCreate, settleWonBackOnCreate } from "../src/lib/recovery/create-gate";

let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) { failed++; console.error("FAIL:", msg); } else { passed++; console.log("OK:", msg); }
}
const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
const root = join(__dirname, "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

/** Every total must equal the sum of the listed items; the timeline + undated must equal won back. */
function reconciles(t: RecoveryTracker, label: string) {
  for (const cat of [t.revenue, t.operations]) {
    const mine = t.items.filter((i) => i.category === cat.category);
    const sum = (f: (i: (typeof mine)[number]) => number) => mine.reduce((s, i) => s + f(i), 0);
    assert(cat.itemCount === mine.length, `${label} ${cat.label}: item count = listed items (${mine.length})`);
    assert(close(cat.found, sum((i) => i.foundAmount)), `${label} ${cat.label}: found = sum of items`);
    assert(close(cat.wonBack, sum((i) => i.realizedAmount)), `${label} ${cat.label}: won back = sum of items`);
    assert(close(cat.wonBack, mine.filter((i) => i.stage === "WON_BACK").reduce((s, i) => s + i.realizedAmount, 0)), `${label} ${cat.label}: won back comes only from WON_BACK items`);
    assert(cat.verified <= cat.wonBack + 0.001, `${label} ${cat.label}: verified ≤ won back`);
    assert(close(cat.byType.reduce((s, b) => s + b.wonBack, 0), cat.wonBack) && close(cat.bySource.reduce((s, b) => s + b.found, 0), cat.found), `${label} ${cat.label}: breakdowns reconcile`);
  }
  const tlCash = t.timeline.reduce((s, p) => s + p.cashRecovered, 0) + t.undated.cashRecovered;
  const tlSav = t.timeline.reduce((s, p) => s + p.realizedSavings, 0) + t.undated.realizedSavings;
  assert(close(tlCash, t.revenue.wonBack) && close(tlSav, t.operations.wonBack), `${label}: timeline + undated = won back`);
  const csv = recoveryLedgerToCsv(t).trim().split("\n");
  assert(csv.length === t.items.length + 1, `${label}: CSV has one row per ledger item`);
}

function row(p: Partial<RecoverySourceRow> & { id: string }): RecoverySourceRow {
  return {
    category: "REVENUE_RECOVERY", title: p.id, status: "IDENTIFIED", foundAmount: 0, realizedAmount: 0, verifiedAmount: 0,
    type: null, source: null, department: null, foundAt: new Date("2026-08-01"), realizedAt: null, ...p,
  };
}

function pure() {
  console.log("--- stages: estimates never become won back ---");
  for (const s of ["IDENTIFIED", "UNDER_REVIEW", "APPROVED", "IN_RECOVERY", "RECOVERED", "VERIFIED", "DISMISSED"]) {
    assert(classifyStage("REVENUE_RECOVERY", s, 0) !== "WON_BACK", `RR ${s} with $0 recorded is not won back`);
  }
  for (const s of ["IDENTIFIED", "IMPLEMENTING", "REALIZED", "VERIFIED", "RESOLVED"]) {
    assert(classifyStage("OPERATIONS_EFFICIENCY", s, 0) !== "WON_BACK", `OE ${s} with $0 recorded is not won back`);
  }
  assert(classifyStage("REVENUE_RECOVERY", "RECOVERED", 0) === "CLOSED_NO_AMOUNT", "status RECOVERED without an amount → closed, no amount (not counted)");
  assert(classifyStage("REVENUE_RECOVERY", "IN_RECOVERY", 500) === "WON_BACK", "a recorded amount counts even if still in recovery");

  const now = new Date(2026, 9, 5);
  const t = buildRecoveryTracker("org-x", [
    row({ id: "a", foundAmount: 100_000 }),
    row({ id: "b", foundAmount: 50_000, status: "APPROVED" }),
    row({ id: "c", foundAmount: 40_000, realizedAmount: 30_000, verifiedAmount: 99_999, status: "VERIFIED", realizedAt: new Date(2026, 8, 12) }),
    row({ id: "d", foundAmount: 20_000, realizedAmount: 5_000, status: "IN_RECOVERY", realizedAt: null }),
    row({ id: "e", foundAmount: 9_000, status: "RECOVERED" }),
    row({ id: "f", foundAmount: 7_000, status: "DISMISSED" }),
    row({ id: "g", category: "OPERATIONS_EFFICIENCY", foundAmount: 60_000, realizedAmount: 12_000, status: "REALIZED", realizedAt: new Date(2026, 9, 1) }),
    row({ id: "h", category: "OPERATIONS_EFFICIENCY", foundAmount: 8_000, status: "IMPLEMENTING" }),
  ], { now });
  assert(t.revenue.found === 226_000, "RR found = sum of all estimates (incl. ruled out, same as dashboard)");
  assert(t.revenue.wonBack === 35_000, "RR won back counts only recorded amounts (30k + 5k), never estimates");
  assert(t.revenue.verified === 30_000, "verified is capped at the recorded amount");
  assert(t.revenue.inProgress === 65_000 && t.revenue.inProgressCount === 2, "in progress = un-won remainder of approved/in-recovery items (50k + 15k)");
  assert(t.revenue.openFound === 100_000 && t.revenue.dismissedFound === 7_000 && t.revenue.closedNoAmountCount === 1, "open / ruled-out / closed-no-amount buckets");
  assert(t.revenue.conversionRate === 15.5, `conversion rate = won ÷ found (${t.revenue.conversionRate}%)`);
  assert(t.operations.wonBack === 12_000 && t.operations.found === 68_000 && t.operations.unit === "per_year", "OE totals kept separate, annual unit");
  assert(!("total" in t) && !("combined" in t), "no combined cash+savings figure exists");
  assert(t.undated.count === 1 && t.undated.cashRecovered === 5_000, "won-back item without a date is kept (undated), not dropped or back-dated");
  assert(t.timeline.find((p) => p.key === "2026-09")?.cashRecovered === 30_000 && t.timeline.find((p) => p.key === "2026-10")?.realizedSavings === 12_000, "timeline buckets by recorded month");
  assert(t.items[0].stage === "WON_BACK", "ledger lists won-back items first");
  assert(t.items.filter((i) => i.stage !== "WON_BACK").every((i) => i.confirmation === null), "only won-back items carry a confirmation");
  reconciles(t, "synthetic");
  const csv = recoveryLedgerToCsv(t);
  assert(/found_estimated_usd/.test(csv) && /won_back_recorded_usd/.test(csv), "CSV labels estimate vs recorded columns");
  assert(describeRecovery(t).headline.includes("(estimates)"), "headline labels found amounts as estimates");

  console.log("--- empty state: zero fabricated numbers ---");
  const empty = buildRecoveryTracker("org-empty", [], { now });
  assert(!empty.hasData && !empty.hasWonBack && empty.items.length === 0, "no rows → no data");
  for (const c of [empty.revenue, empty.operations]) {
    assert(c.found === 0 && c.wonBack === 0 && c.verified === 0 && c.inProgress === 0 && c.conversionRate === 0 && c.byType.length === 0, `${c.label}: every figure is 0`);
  }
  assert(empty.timeline.every((p) => p.cashRecovered === 0 && p.realizedSavings === 0) && empty.undated.count === 0, "empty timeline is all zero");
  const ec = describeRecovery(empty);
  assert(ec.empty && !/[$\d]/.test(ec.headline + ec.detail), "empty-state copy contains no dollar signs or digits");
  assert(recoveryLedgerToCsv(empty).trim().split("\n").length === 1, "empty CSV = header only");

  console.log("--- who can confirm a dollar ---");
  assert(!canConfirmRealized("VIEWER") && !canConfirmRealized("ANALYST") && !canConfirmRealized(null), "viewer / analyst / no role cannot record won-back amounts");
  assert(canConfirmRealized("MANAGER") && canConfirmRealized("ADMIN") && canConfirmRealized("OWNER"), "manager / admin / owner can");
  assert(!canConfirmRealized(effectiveRole("VIEWER", "VIEWER")), "demo view-only membership resolves to read-only");
  const rr = src("src/app/app/revenue/actions.ts");
  const oe = src("src/app/app/operations/actions.ts");
  assert(/export async function recordRecovery[\s\S]{0,200}requirePermission\("record_financial"\)/.test(rr), "recordRecovery write is gated by record_financial");
  assert(/export async function recordSavings[\s\S]{0,200}requirePermission\("record_financial"\)/.test(oe), "recordSavings write is gated by record_financial");
  assert(/evaluateRecoveryGate/.test(rr) && /evaluateRecoveryGate/.test(oe), "amount limits / approval queue still applied on confirm");

  console.log("--- won-back amounts entered at creation ---");
  const lim = { highValueThreshold: 50_000, managerApprovalLimit: 25_000, adminApprovalLimit: 100_000, requireApprovalAbove: 50_000 };
  const d = (amount: number, role: string) => decideWonBackOnCreate({ amount, role, settings: lim, label: "Recovered amount" });
  assert(d(5_000, "ANALYST").mode === "ignored_no_rights" && d(5_000, "VIEWER").mode === "ignored_no_rights", "analyst / viewer: amount at creation is ignored");
  assert(d(0, "ANALYST").mode === "none" && d(0, "OWNER").mode === "none", "no amount → nothing to decide");
  assert(d(10_000, "MANAGER").mode === "recorded" && d(25_000, "MANAGER").mode === "recorded", "manager within $25k limit records");
  const over = d(30_000, "MANAGER");
  assert(over.mode === "blocked_limit" && over.needsRole === "ADMIN", "manager above $25k limit is blocked (needs admin)");
  assert(d(30_000, "ADMIN").mode === "recorded", "admin within limit records");
  assert(d(50_000, "MANAGER").mode === "queued_approval" && d(60_000, "ADMIN").mode === "queued_approval" && d(60_000, "OWNER").mode === "queued_approval", "$50k+ goes to Approvals for every role (org setting)");
  const rrCreate = rr.slice(rr.indexOf("export async function createOpportunity"), rr.indexOf("export async function updateOpportunity"));
  const oeCreate = oe.slice(oe.indexOf("export async function createInefficiency"), oe.indexOf("export async function updateInefficiency"));
  assert(/recoveredAmount: 0,/.test(rrCreate) && /verifiedAmount: 0,/.test(rrCreate) && /settleWonBackOnCreate\(/.test(rrCreate) && /RR_WON_BACK_STATUSES/.test(rrCreate), "createOpportunity never writes a won-back amount/status directly; routes it through the gate");
  assert(/realizedSavings: 0,/.test(oeCreate) && /recoveredAnnual: 0,/.test(oeCreate) && /settleWonBackOnCreate\(/.test(oeCreate) && /OE_WON_BACK_STATUSES/.test(oeCreate), "createInefficiency never writes realized savings/status directly; routes it through the gate");
  const newPage = src("src/app/app/revenue/new/page.tsx");
  assert(/canRecord \? \([\s\S]*name="recoveredAmount"[\s\S]*\) : \(/.test(newPage), "new-opportunity form shows the Recovered amount field only to Manager+");

  console.log("--- read-only, no invented numbers in UI ---");
  const lib = src("src/lib/recovery/tracker.ts");
  assert(!/prisma\.\w+\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(/.test(lib), "tracker never writes to the database");
  assert(!/\bopenai|anthropic|llm\b/i.test(lib), "tracker has no AI/LLM dependency (AI never marks money as won back)");
  for (const f of ["src/app/app/recovery/page.tsx", "src/components/recovery/recovery-card.tsx"]) {
    const s = src(f);
    assert(!/\$\s?\d/.test(s) && !/testimonial|trusted by|logo/i.test(s), `${f}: no hard-coded dollar figures, testimonials or logos`);
  }
  assert(src("src/components/layout/app-shell.tsx").includes('"/app/recovery"'), "nav links to /app/recovery");
  assert(src("src/app/app/page.tsx").includes("<RecoveryCard"), "dashboard shows the recovery card");
  assert(sourceLabelFor("detection:stalled_leads") === "Kaivaryn analysis of your data" && sourceLabelFor(null) === "Added manually" && sourceLabelFor("crm") === "CRM", "plain-English source labels");
}

async function db() {
  if (!process.env.DATABASE_URL) { console.log("--- db: skipped (no DATABASE_URL) ---"); return; }
  if (/render\.com|amazonaws|supabase\.co/i.test(process.env.DATABASE_URL)) { console.error("Refusing to run against a hosted database"); failed++; return; }
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const a = await prisma.organization.create({ data: { name: `RecV A ${stamp}`, slug: `recv-a-${stamp}` } });
  const b = await prisma.organization.create({ data: { name: `RecV B ${stamp}`, slug: `recv-b-${stamp}` } });
  const c = await prisma.organization.create({ data: { name: `RecV C ${stamp}`, slug: `recv-c-${stamp}` } });
  const mgr = await prisma.user.create({ data: { email: `recv-mgr-${stamp}@test.local`, name: "Rita Manager", passwordHash: "x", role: "VIEWER" } });
  const viewer = await prisma.user.create({ data: { email: `recv-view-${stamp}@test.local`, name: "Vic Viewer", passwordHash: "x", role: "VIEWER" } });
  try {
    console.log("--- db: tenant isolation & evidence ---");
    await prisma.membership.create({ data: { organizationId: a.id, userId: mgr.id, role: "MANAGER" } });
    await prisma.membership.create({ data: { organizationId: a.id, userId: viewer.id, role: "VIEWER" } });
    const won = await prisma.opportunity.create({ data: { organizationId: a.id, title: "Short-paid claims", type: "underpayment", source: "claims", status: "VERIFIED", potentialAmount: 40_000, estimatedAmount: 40_000, recoveredAmount: 25_000, verifiedAmount: 25_000, recoveredAt: new Date(), verifiedAt: new Date() } });
    await prisma.opportunity.create({ data: { organizationId: a.id, title: "Estimated only", type: "underbilling", status: "IDENTIFIED", potentialAmount: 90_000, estimatedAmount: 90_000 } });
    await prisma.opportunity.create({ data: { organizationId: a.id, title: "Approved, nothing collected", status: "APPROVED", potentialAmount: 15_000, estimatedAmount: 15_000, approvedAmount: 12_000, inProgressAmount: 5_000 } });
    await prisma.opportunity.create({ data: { organizationId: a.id, title: "Ruled out", status: "DISMISSED", potentialAmount: 3_000, estimatedAmount: 3_000 } });
    const sav = await prisma.inefficiency.create({ data: { organizationId: a.id, title: "Manual invoice keying", type: "manual_process", status: "REALIZED", projectedSavings: 30_000, estimatedWasteAnnual: 30_000, realizedSavings: 18_000, recoveredAnnual: 18_000, resolvedAt: new Date() } });
    await prisma.inefficiency.create({ data: { organizationId: a.id, title: "Projected only", status: "IDENTIFIED", projectedSavings: 22_000, estimatedWasteAnnual: 22_000 } });
    await prisma.statusHistory.create({ data: { organizationId: a.id, entityType: "Opportunity", entityId: won.id, fromStatus: "IN_RECOVERY", toStatus: "VERIFIED", actorId: mgr.id, note: "Recorded recovery 25000" } });
    await prisma.statusHistory.create({ data: { organizationId: a.id, entityType: "Inefficiency", entityId: sav.id, fromStatus: "IMPLEMENTING", toStatus: "REALIZED", actorId: mgr.id, note: "Recorded savings 18000" } });
    await prisma.finding.create({ data: { organizationId: a.id, product: "REVENUE_RECOVERY", opportunityId: won.id, status: "ACCEPTED", impactEstimate: 40_000 } });
    await prisma.evidence.create({ data: { organizationId: a.id, opportunityId: won.id, summary: "Remittance shows short-pay" } });
    // Other tenant — must never leak into A.
    const bOpp = await prisma.opportunity.create({ data: { organizationId: b.id, title: "B secret", status: "RECOVERED", potentialAmount: 777, estimatedAmount: 777, recoveredAmount: 777, recoveredAt: new Date() } });
    // A status-history row in B pointing at A's item id must not be used as A's confirmation.
    await prisma.statusHistory.create({ data: { organizationId: b.id, entityType: "Opportunity", entityId: won.id, toStatus: "VERIFIED", actorId: viewer.id, note: "cross-tenant forgery" } });

    const ta = await getRecoveryTracker(a.id);
    const tb = await getRecoveryTracker(b.id);
    assert(!ta.items.some((i) => i.id === bOpp.id) && ta.revenue.wonBack === 25_000, "org A never sees org B's rows or dollars");
    assert(tb.items.length === 1 && tb.items[0].id === bOpp.id && tb.revenue.wonBack === 777 && tb.operations.itemCount === 0, "org B sees only its own row");
    assert(ta.revenue.found === 148_000 && ta.operations.found === 52_000, "A found totals (estimates)");
    assert(ta.revenue.wonBack === 25_000 && ta.operations.wonBack === 18_000, "A won back = recorded amounts only (estimated 90k / approved 12k not counted)");
    const wi = ta.items.find((i) => i.id === won.id)!;
    assert(wi.confirmation?.byName === "Rita Manager" && wi.confirmation.byRole === "MANAGER" && wi.confirmation.note === "Recorded recovery 25000" && wi.confirmation.kind === "RECORDED", "won-back item shows who recorded it, their role and note (same tenant only)");
    assert(wi.findingIds.length === 1 && wi.evidenceCount === 1 && wi.isVerified, "won-back item links its finding and evidence");
    assert(tb.items[0].confirmation === null, "won-back item with no status record shows 'no record of who entered this amount' (nothing invented)");
    const created = await prisma.opportunity.create({ data: { organizationId: a.id, title: "Entered as recovered", status: "RECOVERED", potentialAmount: 1_000, estimatedAmount: 1_000, recoveredAmount: 1_000, recoveredAt: new Date() } });
    await prisma.statusHistory.create({ data: { organizationId: a.id, entityType: "Opportunity", entityId: created.id, fromStatus: null, toStatus: "RECOVERED", actorId: viewer.id, note: "Added" } });
    const ta2 = await getRecoveryTracker(a.id);
    assert(ta2.items.find((i) => i.id === created.id)?.confirmation?.kind === "ENTERED_AT_CREATION", "amount entered at creation is labelled as such, not as a confirmation");
    await prisma.opportunity.delete({ where: { id: created.id } });
    reconciles(ta, "org A");
    reconciles(tb, "org B");

    console.log("--- db: reconciles with existing dashboard numbers ---");
    for (const [label, orgId, t] of [["org A", a.id, ta], ["org B", b.id, tb]] as const) {
      const [rr, oe, series] = await Promise.all([
        prisma.opportunity.aggregate({ where: { organizationId: orgId }, _sum: { potentialAmount: true, recoveredAmount: true, verifiedAmount: true } }),
        prisma.inefficiency.aggregate({ where: { organizationId: orgId }, _sum: { projectedSavings: true, realizedSavings: true } }),
        getCumulativeValueSeries(orgId),
      ]);
      assert(close(t.revenue.found, rr._sum.potentialAmount ?? 0) && close(t.revenue.wonBack, rr._sum.recoveredAmount ?? 0) && close(t.revenue.verified, rr._sum.verifiedAmount ?? 0), `${label}: RR found / cash recovered / verified match /app dashboard`);
      assert(close(t.operations.found, oe._sum.projectedSavings ?? 0) && close(t.operations.wonBack, oe._sum.realizedSavings ?? 0), `${label}: OE projected / realized match /app dashboard`);
      const last = series.realized.at(-1)!;
      assert(last.cashRecovered === Math.round(t.revenue.wonBack) && last.realizedSavings === Math.round(t.operations.wonBack), `${label}: matches the dashboard "Realized value recorded" chart`);
    }

    console.log("--- db: empty tenant ---");
    const tc = await getRecoveryTracker(c.id);
    assert(!tc.hasData && tc.items.length === 0 && tc.revenue.found === 0 && tc.revenue.wonBack === 0 && tc.operations.found === 0 && tc.operations.wonBack === 0, "empty tenant: no items, every figure 0");
    assert(describeRecovery(tc).empty, "empty tenant gets the explanatory empty state");

    console.log("--- db: viewer cannot confirm ---");
    const vm = await prisma.membership.findFirst({ where: { organizationId: a.id, userId: viewer.id } });
    const mm = await prisma.membership.findFirst({ where: { organizationId: a.id, userId: mgr.id } });
    assert(!canConfirmRealized(effectiveRole(viewer.role, vm!.role)), "viewer member cannot record won-back amounts");
    assert(canConfirmRealized(effectiveRole(mgr.role, mm!.role)), "manager member can");

    console.log("--- db: won-back amount entered at creation ---");
    // Mirrors the create actions: the item is inserted with no won-back amount, then settled.
    const mkOpp = (title: string, potential: number) => prisma.opportunity.create({ data: { organizationId: a.id, title, status: "IDENTIFIED", potentialAmount: potential, estimatedAmount: potential } });
    const o1 = await mkOpp("Analyst entered 5000", 20_000);
    const r1 = await settleWonBackOnCreate({ kind: "opportunity", organizationId: a.id, actorId: viewer.id, role: "ANALYST", entityId: o1.id, amount: 5_000 });
    const o1after = await prisma.opportunity.findUnique({ where: { id: o1.id } });
    assert(r1.mode === "ignored_no_rights" && o1after!.recoveredAmount === 0 && o1after!.status === "IDENTIFIED" && !o1after!.recoveredAt, "analyst create with an amount stores no won-back amount");
    assert((await prisma.approvalRequest.count({ where: { organizationId: a.id, payloadJson: { contains: o1.id } } })) === 0, "analyst amount is not queued for approval either");
    assert((await prisma.auditLog.count({ where: { organizationId: a.id, entityId: o1.id, action: "opportunity.won_back_on_create_rejected" } })) === 1, "ignored amount is audited");
    const i1 = await prisma.inefficiency.create({ data: { organizationId: a.id, title: "Analyst entered savings", status: "IDENTIFIED", projectedSavings: 9_000, estimatedWasteAnnual: 9_000 } });
    const ri1 = await settleWonBackOnCreate({ kind: "inefficiency", organizationId: a.id, actorId: viewer.id, role: "ANALYST", entityId: i1.id, amount: 4_000 });
    const i1after = await prisma.inefficiency.findUnique({ where: { id: i1.id } });
    assert(ri1.mode === "ignored_no_rights" && i1after!.realizedSavings === 0 && i1after!.recoveredAnnual === 0, "analyst createInefficiency with savings stores no realized savings");

    const o2 = await mkOpp("Manager entered 10000", 20_000);
    const r2 = await settleWonBackOnCreate({ kind: "opportunity", organizationId: a.id, actorId: mgr.id, role: "MANAGER", entityId: o2.id, amount: 10_000 });
    const o2after = await prisma.opportunity.findUnique({ where: { id: o2.id } });
    assert(r2.mode === "recorded" && o2after!.recoveredAmount === 10_000 && o2after!.status === "PARTIALLY_RECOVERED" && !!o2after!.recoveredAt, "manager within limit: amount recorded (partially recovered)");
    const t2 = await getRecoveryTracker(a.id);
    const t2i = t2.items.find((i) => i.id === o2.id);
    assert(t2i?.stage === "WON_BACK" && t2i.confirmation?.kind === "RECORDED" && t2i.confirmation.byName === "Rita Manager", "tracker shows it as recorded by the manager");
    const i2 = await prisma.inefficiency.create({ data: { organizationId: a.id, title: "Manager entered savings", status: "IDENTIFIED", projectedSavings: 30_000, estimatedWasteAnnual: 30_000 } });
    const ri2 = await settleWonBackOnCreate({ kind: "inefficiency", organizationId: a.id, actorId: mgr.id, role: "MANAGER", entityId: i2.id, amount: 12_000 });
    const i2after = await prisma.inefficiency.findUnique({ where: { id: i2.id } });
    assert(ri2.mode === "recorded" && i2after!.realizedSavings === 12_000 && i2after!.status === "REALIZED", "manager within limit: realized savings recorded");

    const o3 = await mkOpp("Manager entered 30000", 80_000);
    const r3 = await settleWonBackOnCreate({ kind: "opportunity", organizationId: a.id, actorId: mgr.id, role: "MANAGER", entityId: o3.id, amount: 30_000 });
    assert(r3.mode === "blocked_limit" && (await prisma.opportunity.findUnique({ where: { id: o3.id } }))!.recoveredAmount === 0, "manager above $25k limit: nothing recorded");

    const o4 = await mkOpp("Manager entered 60000", 90_000);
    const r4 = await settleWonBackOnCreate({ kind: "opportunity", organizationId: a.id, actorId: mgr.id, role: "MANAGER", entityId: o4.id, amount: 60_000 });
    const ap = r4.mode === "queued_approval" && r4.approvalId ? await prisma.approvalRequest.findUnique({ where: { id: r4.approvalId } }) : null;
    const payload = ap?.payloadJson ? JSON.parse(ap.payloadJson) : {};
    assert(ap?.type === "HIGH_VALUE_RECOVERY" && ap.status === "PENDING" && ap.organizationId === a.id && payload.opportunityId === o4.id && payload.recoveredAmount === 60_000 && payload.executesExternally === false, "amount above threshold routes to Approvals (HIGH_VALUE_RECOVERY, same payload decideApproval applies)");
    assert((await prisma.opportunity.findUnique({ where: { id: o4.id } }))!.recoveredAmount === 0, "queued amount is not counted as won back until approved");
    const i4 = await prisma.inefficiency.create({ data: { organizationId: a.id, title: "Owner entered big savings", status: "IDENTIFIED", projectedSavings: 200_000, estimatedWasteAnnual: 200_000 } });
    const ri4 = await settleWonBackOnCreate({ kind: "inefficiency", organizationId: a.id, actorId: mgr.id, role: "OWNER", entityId: i4.id, amount: 75_000 });
    const ap4 = ri4.mode === "queued_approval" && ri4.approvalId ? await prisma.approvalRequest.findUnique({ where: { id: ri4.approvalId } }) : null;
    assert(ap4?.type === "HIGH_VALUE_SAVINGS" && (await prisma.inefficiency.findUnique({ where: { id: i4.id } }))!.realizedSavings === 0, "savings above threshold route to Approvals (HIGH_VALUE_SAVINGS), even for owners");
    let crossBlocked = false;
    try { await settleWonBackOnCreate({ kind: "opportunity", organizationId: b.id, actorId: mgr.id, role: "OWNER", entityId: o2.id, amount: 1_000 }); } catch { crossBlocked = true; }
    assert(crossBlocked, "settling an amount on another tenant's item is refused");
    reconciles(await getRecoveryTracker(a.id), "org A after create-path checks");

    const acme = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
    if (acme) {
      console.log("--- db: Acme demo (seeded example data) ---");
      const t = await getRecoveryTracker(acme.id);
      reconciles(t, "acme");
      const rr = await prisma.opportunity.aggregate({ where: { organizationId: acme.id }, _sum: { potentialAmount: true, recoveredAmount: true } });
      assert(acme.isDemo, "Acme is flagged isDemo (page shows the example-data note)");
      assert(close(t.revenue.found, rr._sum.potentialAmount ?? 0) && close(t.revenue.wonBack, rr._sum.recoveredAmount ?? 0), "acme: matches dashboard");
      console.log(`  acme: RR found ${t.revenue.found} won ${t.revenue.wonBack} (${t.revenue.wonBackCount} items, ${t.revenue.verified} verified) · OE found ${t.operations.found}/yr realized ${t.operations.wonBack}/yr (${t.operations.wonBackCount} items)`);
      const demoUser = await prisma.user.findUnique({ where: { email: "demo@kaivaryn.com" }, include: { memberships: { where: { organizationId: acme.id } } } });
      if (demoUser?.memberships[0]) assert(!canConfirmRealized(effectiveRole(demoUser.role, demoUser.memberships[0].role)), "demo@kaivaryn.com is read-only on the tracker");
    }
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [mgr.id, viewer.id] } } });
    await prisma.$disconnect();
  }
}

(async () => {
  pure();
  await db();
  console.log(`\nrecovery-validation: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
