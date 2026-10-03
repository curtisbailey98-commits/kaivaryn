/**
 * Prompted automations: deterministic prompt parser, schedule maths (DST, month-end),
 * createAutomation (roles, tenant isolation, audit), threshold alerts, and scheduler tick
 * idempotency + token auth (route handler called directly).
 * Run: npm run test:automations   (needs a seeded database)
 */
import { PrismaClient } from "@prisma/client";
import {
  parseAutomationPrompt,
  looksLikeAutomation,
  parseAmount,
  computeNextRun,
  nextRuns,
  describeSchedule,
  zonedParts,
  createAutomation,
  createAutomationFromPrompt,
  previewAutomationPrompt,
  runDueStandingOrders,
  runStandingOrder,
  platformTick,
  setStandingOrderEnabled,
  deleteStandingOrder,
  executeCommand,
  routeCommand,
  type OpCtx,
  type ScheduleSpec,
} from "../src/lib/operate";

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
async function expectCode(fn: () => Promise<unknown>, code: string, msg: string) {
  try {
    await fn();
    assert(false, `${msg} (expected ${code}, no error)`);
  } catch (e) {
    const c = (e as { code?: string }).code;
    assert(c === code, `${msg} (got ${c ?? (e as Error).message})`);
  }
}

const PB = [
  { slug: "revenue-leakage-sweep", name: "Revenue leakage sweep" },
  { slug: "operations-friction-sweep", name: "Operations friction sweep" },
  { slug: "executive-weekly-review", name: "Executive weekly review" },
  { slug: "platform-health-check", name: "Platform health check" },
];
const NY = "America/New_York";
const at = (iso: string) => new Date(iso);
const local = (d: Date, tz = NY) => {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

function parserTests() {
  console.log("--- parser ---");
  type Case = { p: string; cadence?: ScheduleSpec["cadence"]; hour?: number; minute?: number; dow?: number[]; dom?: number; every?: number; actions?: string[]; product?: string; playbook?: string; metric?: string; amount?: number; tz?: string; ok?: boolean; problem?: RegExp; unparsed?: string[]; assumption?: RegExp; deliveryNote?: boolean };
  const cases: Case[] = [
    { p: "Every Monday at 8am send me a briefing", cadence: "WEEKLY", hour: 8, minute: 0, dow: [1], actions: ["DIGEST"], ok: true },
    { p: "daily at 7 run a health check", cadence: "DAILY", hour: 7, actions: ["STATUS"], assumption: /7:00 AM/ },
    { p: "every weekday at 9 analyze revenue leakage", cadence: "WEEKDAYS", hour: 9, actions: ["ANALYZE"], product: "REVENUE_RECOVERY" },
    { p: "hourly health check", cadence: "HOURLY", every: 1, actions: ["STATUS"] },
    { p: "first of the month run the revenue sweep", cadence: "MONTHLY", dom: 1, hour: 8, actions: ["PLAYBOOK"], playbook: "revenue-leakage-sweep", assumption: /8:00 AM/ },
    { p: "Every Monday at 8am check revenue leakage and alert me if it's over $50k", cadence: "WEEKLY", dow: [1], metric: "OPEN_RR_ESTIMATE", amount: 50000 },
    { p: "alert me if leakage over $50k every weekday at 8", cadence: "WEEKDAYS", hour: 8, metric: "OPEN_RR_ESTIMATE", amount: 50000 },
    { p: "every friday at 4:30pm PT analyze operations and email me", cadence: "WEEKLY", dow: [5], hour: 16, minute: 30, tz: "America/Los_Angeles", actions: ["ANALYZE"], product: "OPERATIONS_EFFICIENCY", deliveryNote: true },
    { p: "each morning brief me", cadence: "DAILY", hour: 8, actions: ["DIGEST"] },
    { p: "every 2 hours run detection", cadence: "HOURLY", every: 2, actions: ["DETECT"] },
    { p: "weekly executive review", cadence: "WEEKLY", dow: [1], playbook: "executive-weekly-review", assumption: /Monday/ },
    { p: "On the 15th of every month at noon run playbook operations-friction-sweep", cadence: "MONTHLY", dom: 15, hour: 12, playbook: "operations-friction-sweep" },
    { p: "every mon, wed and fri at 7:15 am analyze billing then send me a digest", cadence: "WEEKLY", dow: [1, 3, 5], hour: 7, minute: 15, actions: ["ANALYZE", "DIGEST"] },
    { p: "Every Monday analyze RR and OE", cadence: "WEEKLY", product: "BOTH" },
    { p: "monthly briefing", cadence: "MONTHLY", dom: 1, actions: ["DIGEST"] },
    { p: "every weekday at end of day tell me if there are any critical items", cadence: "WEEKDAYS", hour: 17, metric: "CRITICAL_ITEMS", amount: 0 },
    { p: "last day of the month at 5pm send me a digest", cadence: "MONTHLY", dom: -1, hour: 17, actions: ["DIGEST"] },
    { p: "every day at 6:45 pm run the operations sweep", cadence: "DAILY", hour: 18, minute: 45, playbook: "operations-friction-sweep" },
    { p: "Every Tuesday and Thursday at 10am run detection", cadence: "WEEKLY", dow: [2, 4], hour: 10, actions: ["DETECT"] },
    { p: "daily at 07:30 analyze both", cadence: "DAILY", hour: 7, minute: 30, product: "BOTH" },
    { p: "every weekday at 9am Central check operations efficiency", cadence: "WEEKDAYS", tz: "America/Chicago", product: "OPERATIONS_EFFICIENCY" },
    // Problems must be shown, not guessed
    { p: "tomorrow at 9am send a briefing", ok: false, problem: /how often/ },
    { p: "every 5 minutes health check", ok: false, problem: /Minute-level/ },
    { p: "every day at 6pm do the flux capacitor thing", ok: false, problem: /couldn't tell what to do/, unparsed: ["flux", "capacitor"] },
    { p: "run playbook nonexistent every day", ok: false, problem: /No playbook named/ },
  ];
  for (const c of cases) {
    const d = parseAutomationPrompt(c.p, { playbooks: PB });
    const label = `“${c.p}”`;
    if (c.ok !== undefined) assert(d.ok === c.ok, `${label} ok=${c.ok}`);
    else assert(d.ok, `${label} parses cleanly (${d.problems.join("; ")})`);
    if (c.cadence) assert(d.schedule?.cadence === c.cadence, `${label} cadence ${c.cadence} (got ${d.schedule?.cadence})`);
    if (c.hour !== undefined) assert(d.schedule?.hour === c.hour, `${label} hour ${c.hour} (got ${d.schedule?.hour})`);
    if (c.minute !== undefined) assert(d.schedule?.minute === c.minute, `${label} minute ${c.minute}`);
    if (c.dow) assert(JSON.stringify(d.schedule?.daysOfWeek) === JSON.stringify(c.dow), `${label} days ${c.dow.join(",")} (got ${d.schedule?.daysOfWeek})`);
    if (c.dom !== undefined) assert(d.schedule?.dayOfMonth === c.dom, `${label} day of month ${c.dom}`);
    if (c.every !== undefined) assert((d.schedule?.everyHours ?? 1) === c.every, `${label} every ${c.every}h`);
    if (c.actions) assert(JSON.stringify(d.actions.map((a) => a.kind)) === JSON.stringify(c.actions), `${label} actions ${c.actions.join("+")} (got ${d.actions.map((a) => a.kind).join("+")})`);
    if (c.product) assert(d.actions.some((a) => a.product === c.product), `${label} product ${c.product}`);
    if (c.playbook) assert(d.actions.some((a) => a.playbookSlug === c.playbook), `${label} playbook ${c.playbook}`);
    if (c.metric) assert(d.condition?.metric === c.metric && d.condition.amount === c.amount, `${label} threshold ${c.metric} > ${c.amount}`);
    if (c.tz) assert(d.timezone === c.tz, `${label} time zone ${c.tz} (got ${d.timezone})`);
    else if (c.ok !== false) assert(d.timezone === NY && d.assumptions.some((a) => /Time zone/.test(a)), `${label} defaults to America/New_York and says so`);
    if (c.problem) assert(d.problems.some((x) => c.problem!.test(x)), `${label} explains problem ${c.problem}`);
    if (c.unparsed) assert(c.unparsed.every((w) => d.unparsed.includes(w)), `${label} surfaces unparsed words ${c.unparsed.join(",")}`);
    if (c.assumption) assert(d.assumptions.some((x) => c.assumption!.test(x)), `${label} states assumption ${c.assumption}`);
    if (c.deliveryNote) assert(d.delivery === "INBOX" && /Inbox/.test(d.deliveryNote ?? ""), `${label} email request falls back to Inbox with a note`);
    assert(d.delivery === "INBOX", `${label} delivery is Inbox`);
  }
  // Org/user timezone default is honoured
  const chi = parseAutomationPrompt("daily at 8am send me a briefing", { timezone: "America/Chicago", playbooks: PB });
  assert(chi.timezone === "America/Chicago", "workspace time zone used when prompt has none");
  // Detection of automation intent (router)
  assert(looksLikeAutomation("Every Monday at 8am send me a briefing"), "looksLikeAutomation: weekly briefing");
  assert(looksLikeAutomation("daily at 7 run a health check"), "looksLikeAutomation: daily health check");
  assert(!looksLikeAutomation("what is our revenue leakage"), "looksLikeAutomation: plain question is not an automation");
  assert(routeCommand("every weekday at 9 analyze revenue leakage").route === "STANDING", "router sends scheduled prompt to Automation");
  assert(routeCommand("analyze revenue leakage").route !== "STANDING", "router keeps one-off analysis as analysis");
  // Amounts
  for (const [raw, want] of [["$50k", 50000], ["50,000", 50000], ["$1.2m", 1200000], ["250 thousand", 250000], ["$75K", 75000]] as const) assert(parseAmount(raw) === want, `parseAmount ${raw} → ${want}`);
  // Deterministic
  const a = JSON.stringify(parseAutomationPrompt("every weekday at 9 analyze revenue leakage", { playbooks: PB }));
  const b = JSON.stringify(parseAutomationPrompt("every weekday at 9 analyze revenue leakage", { playbooks: PB }));
  assert(a === b, "parser is deterministic");
}

function scheduleTests() {
  console.log("--- schedule maths ---");
  const fri = at("2026-10-02T22:41:00-04:00"); // Fri 10:41 PM ET
  const weekly: ScheduleSpec = { cadence: "WEEKLY", daysOfWeek: [1], hour: 8, minute: 0 };
  assert(local(computeNextRun(weekly, NY, fri)) === "2026-10-05 08:00", "Mon 8am weekly from Fri night → Mon Oct 5 08:00 ET");
  const daily: ScheduleSpec = { cadence: "DAILY", hour: 7, minute: 0 };
  assert(local(computeNextRun(daily, NY, fri)) === "2026-10-03 07:00", "daily 7am → next morning");
  assert(local(computeNextRun(daily, NY, at("2026-10-03T06:59:00-04:00"))) === "2026-10-03 07:00", "daily 7am same day when before 7");
  assert(local(computeNextRun(daily, NY, at("2026-10-03T07:00:00-04:00"))) === "2026-10-04 07:00", "daily strictly after now (no double fire at the boundary)");
  const wd: ScheduleSpec = { cadence: "WEEKDAYS", hour: 9, minute: 0 };
  assert(local(computeNextRun(wd, NY, fri)) === "2026-10-05 09:00", "weekdays skips the weekend");
  const hourly: ScheduleSpec = { cadence: "HOURLY", everyHours: 1, hour: 0, minute: 0 };
  assert(local(computeNextRun(hourly, NY, fri)) === "2026-10-02 23:00", "hourly → top of next hour");
  const two: ScheduleSpec = { cadence: "HOURLY", everyHours: 2, hour: 0, minute: 0 };
  assert(local(computeNextRun(two, NY, fri)) === "2026-10-03 00:00", "every 2 hours aligned to even hours");
  const eom: ScheduleSpec = { cadence: "MONTHLY", dayOfMonth: -1, hour: 17, minute: 0 };
  assert(local(computeNextRun(eom, NY, at("2027-02-10T12:00:00-05:00"))) === "2027-02-28 17:00", "last day of month in February");
  const d31: ScheduleSpec = { cadence: "MONTHLY", dayOfMonth: 31, hour: 9, minute: 0 };
  assert(local(computeNextRun(d31, NY, at("2026-11-01T12:00:00-04:00"))) === "2026-11-30 09:00", "31st clamps to Nov 30");
  const first: ScheduleSpec = { cadence: "MONTHLY", dayOfMonth: 1, hour: 8, minute: 0 };
  assert(local(computeNextRun(first, NY, fri)) === "2026-11-01 08:00", "1st of month → Nov 1");
  // DST: Nov 1 2026 US fall-back; 8am ET stays 8am local across the change
  const nov = nextRuns(daily, NY, at("2026-10-31T12:00:00-04:00"), 3).map((d) => local(d));
  assert(JSON.stringify(nov) === JSON.stringify(["2026-11-01 07:00", "2026-11-02 07:00", "2026-11-03 07:00"]), `DST fall-back keeps local time (${nov.join(", ")})`);
  const mar = computeNextRun(daily, NY, at("2027-03-13T12:00:00-05:00"));
  assert(local(mar) === "2027-03-14 07:00" && mar.toISOString() === "2027-03-14T11:00:00.000Z", "DST spring-forward: 7am EDT = 11:00Z");
  const pt = computeNextRun({ cadence: "DAILY", hour: 9, minute: 0 }, "America/Los_Angeles", fri);
  assert(local(pt, "America/Los_Angeles") === "2026-10-03 09:00", "Pacific schedule uses Pacific clock");
  assert(/Every Monday at 8:00 AM/.test(describeSchedule(weekly, NY)), "describeSchedule reads naturally");
}

async function dbTests() {
  console.log("--- automations in the database ---");
  const acme = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  const other = await prisma.organization.findUnique({ where: { slug: "other-co" } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@kaivaryn.com" } });
  const viewer = await prisma.user.findUnique({ where: { email: "viewer@acme-demo.kaivaryn.com" } });
  const otherUser = await prisma.user.findUnique({ where: { email: "analyst@other-co.test" } });
  if (!acme || !other || !demo || !viewer || !otherUser) throw new Error("Seed fixtures missing — run the seed first");
  const A: OpCtx = { organizationId: acme.id, userId: demo.id, role: "ANALYST" };
  const AV: OpCtx = { organizationId: acme.id, userId: viewer.id, role: "VIEWER" };
  const B: OpCtx = { organizationId: other.id, userId: otherUser.id, role: "ANALYST" };
  const created: string[] = [];
  const ticks: string[] = [];
  try {
    // Preview is read-only
    const before = await prisma.opStandingOrder.count({ where: { organizationId: acme.id } });
    const pv = await previewAutomationPrompt(A, "every weekday at 9 analyze revenue leakage");
    assert(pv.draft.ok && pv.nextRuns.length === 3, "preview returns a parsed draft and next 3 runs");
    assert((await prisma.opStandingOrder.count({ where: { organizationId: acme.id } })) === before, "preview saves nothing");
    // Command returns a confirmation preview, not a saved order
    const cmd = await executeCommand(A, "Every Monday at 8am send me a briefing");
    assert(cmd.route === "STANDING" && /Here's what I'll set up/.test(cmd.message) && (cmd.data as { automationPreview?: unknown })?.automationPreview, "Command answers with “Here's what I'll set up” preview");
    assert((await prisma.opStandingOrder.count({ where: { organizationId: acme.id } })) === before, "Command preview saves nothing until confirmed");

    // Create from prompt
    const o = await createAutomationFromPrompt(A, "Every Monday at 8am check revenue leakage and alert me if it's over $1k");
    created.push(o.id);
    assert(o.organizationId === acme.id && o.cadence === "WEEKLY" && o.timezone === NY && o.delivery === "INBOX", "prompt creates a weekly Inbox automation in the caller's org");
    assert(o.prompt?.includes("alert me") && JSON.parse(o.conditionJson!).amount === 1000, "original prompt + threshold stored");
    const np = zonedParts(o.nextRunAt!, NY);
    assert(np.hour === 8 && np.minute === 0 && o.nextRunAt!.getTime() > Date.now(), "next run is a future Monday 8:00 AM ET");
    const audit = await prisma.auditLog.findFirst({ where: { organizationId: acme.id, action: "standing_order.created", entityId: o.id } });
    assert(audit && audit.actorId === demo.id, "creation is audit-logged with the actor");
    await expectCode(() => createAutomationFromPrompt(A, "every 5 minutes health check"), "prompt_unparsed", "unparseable prompt is refused (not guessed)");
    await expectCode(() => createAutomationFromPrompt(AV, "daily at 7 run a health check"), "forbidden", "VIEWER cannot create automations");
    await expectCode(() => createAutomation(A, { schedule: { cadence: "DAILY", hour: 7, minute: 0 }, actions: [] }), "action_missing", "form without an action is refused");
    await expectCode(() => createAutomation(A, { schedule: { cadence: "NEVER" }, actions: [{ kind: "STATUS" }] }), "schedule_invalid", "invalid schedule is refused");
    // Tenant isolation
    assert((await deleteStandingOrder(B, o.id)) === 0, "other tenant cannot delete the automation");
    await expectCode(() => setStandingOrderEnabled(B, o.id, false), "not_found", "other tenant cannot pause the automation");
    await expectCode(() => runStandingOrder(B, o.id), "not_found", "other tenant cannot run the automation");
    // Playbook resolved per tenant (inlined steps) via explicit form spec
    const pbo = await createAutomation(A, { schedule: { cadence: "MONTHLY", dayOfMonth: 1, hour: 8, minute: 0 }, timezone: "America/Chicago", actions: [{ kind: "PLAYBOOK", playbookSlug: "revenue-leakage-sweep" }], prompt: null });
    created.push(pbo.id);
    assert(pbo.timezone === "America/Chicago" && JSON.parse(pbo.actionJson!).steps.length >= 1, "form spec creates a monthly playbook automation with inlined steps");

    // Threshold check alerts the creator (leakage over $1k on seeded data)
    const nBefore = await prisma.notification.count({ where: { organizationId: acme.id, userId: demo.id, title: { startsWith: "Alert ·" } } });
    const ran = await runStandingOrder(A, o.id);
    assert(ran.lastStatus === "SUCCEEDED" && ran.runCount === 1, "threshold automation runs");
    const nAfter = await prisma.notification.count({ where: { organizationId: acme.id, userId: demo.id, title: { startsWith: "Alert ·" } } });
    assert(nAfter === nBefore + 1, "threshold met → one Inbox alert for the creator");
    const quiet = await createAutomation(A, { schedule: { cadence: "DAILY", hour: 7, minute: 0 }, actions: [{ kind: "WATCH" }], condition: { metric: "OPEN_RR_ESTIMATE", op: "gt", amount: 1e12 } });
    created.push(quiet.id);
    await runStandingOrder(A, quiet.id);
    assert((await prisma.notification.count({ where: { organizationId: acme.id, userId: demo.id, title: { startsWith: "Alert ·" } } })) === nAfter, "threshold not met → no alert");

    // Idempotency: two overlapping “run due” passes never double-run an order (compare-and-set claim)
    const due = await createAutomationFromPrompt(A, "daily at 7 run a health check");
    created.push(due.id);
    await prisma.opStandingOrder.update({ where: { id: due.id }, data: { nextRunAt: new Date(Date.now() - 60_000) } });
    const [r1, r2] = await Promise.all([runDueStandingOrders(A, { trigger: "RUN_DUE" }), runDueStandingOrders(A, { trigger: "RUN_DUE" })]);
    const hits = [...r1, ...r2].filter((r) => r.id === due.id).length;
    const after = await prisma.opStandingOrder.findUnique({ where: { id: due.id } });
    assert(hits === 1 && after!.runCount === 1, `overlapping run-due passes run the order exactly once (hits=${hits}, runCount=${after!.runCount})`);
    assert(after!.nextRunAt!.getTime() > Date.now(), "claimed order is rescheduled into the future");
    const again = await runDueStandingOrders(A, { trigger: "RUN_DUE" });
    assert(!again.some((r) => r.id === due.id), "a second pass right after finds nothing due");
    await expectCode(() => runDueStandingOrders(AV), "forbidden", "VIEWER cannot run due automations");
    // Paused orders never run
    await prisma.opStandingOrder.update({ where: { id: due.id }, data: { nextRunAt: new Date(Date.now() - 60_000) } });
    await setStandingOrderEnabled(A, due.id, false);
    assert(!(await runDueStandingOrders(A, { trigger: "RUN_DUE" })).some((r) => r.id === due.id), "paused automation is skipped");

    // Platform tick: same tick key never executes twice; trigger recorded as TICK
    await setStandingOrderEnabled(A, due.id, true);
    await prisma.opStandingOrder.update({ where: { id: due.id }, data: { nextRunAt: new Date(Date.now() - 60_000) } });
    const key = `test-${Date.now().toString(36)}`;
    ticks.push(key, `${key}-b`);
    const [t1, t2] = await Promise.all([platformTick({ tickKey: key, source: "test" }), platformTick({ tickKey: key, source: "test" })]);
    assert([t1, t2].filter((t) => !t.replay).length === 1 && t1.tickId === t2.tickId, "concurrent ticks with the same key → one execution, one replay");
    const t3 = await platformTick({ tickKey: key, source: "test" });
    assert(t3.replay && t3.status === "SUCCEEDED", "retry with the same key replays the recorded result");
    const ticked = await prisma.opStandingOrder.findUnique({ where: { id: due.id } });
    assert(ticked!.runCount === 2 && JSON.parse(ticked!.lastResultJson!).trigger === "TICK", "tick ran the due order once, recorded as automatic");
    const t4 = await platformTick({ tickKey: `${key}-b`, source: "test" });
    const unchanged = await prisma.opStandingOrder.findUnique({ where: { id: due.id } });
    assert(!t4.replay && unchanged!.runCount === 2, "a new tick right after does not re-run the same order");
    const rec = await prisma.opSchedulerTick.findUnique({ where: { tickKey: key } });
    assert(rec?.status === "SUCCEEDED" && rec.source === "test" && rec.finishedAt, "tick is recorded for health reporting");

    // Route auth (handler called directly)
    const route = await import("../src/app/api/operate/tick/route");
    const saved = process.env.OPERATE_TICK_TOKEN;
    process.env.OPERATE_TICK_TOKEN = "unit-test-token-0123456789abcdef";
    try {
      const call = (auth: string, k?: string) => route.POST(new Request("http://local/api/operate/tick", { method: "POST", headers: { authorization: auth, ...(k ? { "x-tick-key": k, "x-tick-source": "test" } : {}) } }));
      assert((await call("Bearer wrong-token-wrong-token")).status === 401, "tick route: wrong token → 401");
      assert((await call("Bearer ")).status === 401, "tick route: empty bearer → 401");
      assert((await call("Bearer unit-test-token-0123456789abcdeX")).status === 401, "tick route: same-length wrong token → 401");
      const rk = `${key}-route`;
      ticks.push(rk);
      const ok = await call("Bearer unit-test-token-0123456789abcdef", rk);
      const body = (await ok.json()) as { mode: string; replay: boolean };
      assert(ok.status === 200 && body.mode === "platform" && body.replay === false, "tick route: valid token → 200 platform tick");
      const rp = (await (await call("Bearer unit-test-token-0123456789abcdef", rk)).json()) as { replay: boolean };
      assert(rp.replay === true, "tick route: same X-Tick-Key replays");
      process.env.OPERATE_TICK_TOKEN = "short";
      assert((await call("Bearer short")).status === 401, "tick route: weak/unset server token never authorizes");
    } finally {
      if (saved === undefined) delete process.env.OPERATE_TICK_TOKEN;
      else process.env.OPERATE_TICK_TOKEN = saved;
    }

    // Delete writes audit
    const del = created.pop()!;
    assert((await deleteStandingOrder(A, del)) === 1, "owner tenant deletes the automation");
    assert(await prisma.auditLog.findFirst({ where: { organizationId: acme.id, action: "standing_order.deleted", entityId: del } }), "deletion is audit-logged");
  } finally {
    await prisma.opStandingOrder.deleteMany({ where: { id: { in: created } } });
    await prisma.opSchedulerTick.deleteMany({ where: { tickKey: { in: ticks } } });
  }
}

async function main() {
  console.log("=== Kaivaryn prompted automations validation ===");
  parserTests();
  scheduleTests();
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
