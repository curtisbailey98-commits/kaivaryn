/**
 * Restaurant POS onboarding + per-system integration guides.
 * Pure checks (no DB) plus tenant-isolated setup-store checks when DATABASE_URL is set.
 * Run: npm run test:restaurant
 */
import { PrismaClient } from "@prisma/client";
import { ALL_SYSTEMS, GENERAL_GROUPS } from "../src/lib/integrations/catalog";
import { getGuide, allGuideKeys, vendorSpecificKeys } from "../src/lib/integrations/guides";
import { sanitizeIntake, isSecretFieldId } from "../src/lib/integrations/guides/intake";
import { RESTAURANT_GROUPS, isPos } from "../src/lib/industry/restaurant";
import { resolveSystemStates } from "../src/lib/industry/states";
import { RESTAURANT_PLAYBOOKS } from "../src/lib/industry/restaurant-playbooks";
import { RESTAURANT_VOICE_PRESETS } from "../src/lib/industry/restaurant-voice";
import { generateConfig } from "../src/lib/voice/generator";
import { saveSystemSetup, getSystemSetup } from "../src/lib/integrations/setup-store";

let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) { failed++; console.error("FAIL:", msg); } else { passed++; console.log("OK:", msg); }
}

function pure() {
  console.log("--- catalog & guides ---");
  const keys = allGuideKeys();
  assert(keys.length === ALL_SYSTEMS.length && keys.length >= 60, `catalog has ${keys.length} systems`);
  const pos = RESTAURANT_GROUPS[0]!.options;
  assert(pos.length >= 10 && pos.every((o) => isPos(o.key)), "10+ POS options, all recognised as POS");
  let missing = 0;
  for (const k of keys) {
    const g = getGuide(k);
    if (!g || g.steps.length < 2 || g.intakeFields.length < 1 || g.checklist.length < 3 || !g.sourceUrl) { missing++; console.error("  incomplete guide:", k); }
  }
  assert(missing === 0, "every onboarding option (general + restaurant) resolves to a full guide with steps, intake, checklist, source");
  for (const g of GENERAL_GROUPS) for (const [k] of g.options) assert(getGuide(k) !== null, `general option ${k} has a guide`);
  for (const o of pos) {
    const g = getGuide(o.key)!;
    assert(o.key === "pos_other" || g.vendorSpecific, `${o.name}: vendor-specific POS guide`);
  }
  assert(vendorSpecificKeys().length >= 60, `vendor-specific guides: ${vendorSpecificKeys().length}`);
  const allText = keys.map((k) => JSON.stringify(getGuide(k))).join("\n").toLowerCase();
  assert(!/certified partner|official partner|marketplace app is live|we are a .* partner/.test(allText), "no guide claims a partnership or live marketplace app");
  assert(getGuide("not_a_system") === null, "unknown key returns null");

  console.log("--- intake never stores secrets ---");
  const g = getGuide("pos_toast")!;
  const first = g.intakeFields.find((f) => f.type === "text")!;
  const clean = sanitizeIntake(g.intakeFields, { [first.id]: "Main St location", password: "hunter2", api_key: "sk_live_123", bogus: "x" });
  assert(clean.values[first.id] === "Main St location", "known intake field kept");
  assert(!("password" in clean.values) && !("api_key" in clean.values) && !("bogus" in clean.values), "secret and unknown fields dropped");
  assert(isSecretFieldId("client_secret") && isSecretFieldId("apiKey") && !isSecretFieldId("location_count"), "secret field id detection");
  const sneaky = sanitizeIntake(g.intakeFields, { [first.id]: "sk_live_abcdefghijklmnop1234" });
  assert(!sneaky.values[first.id], "secret-looking value rejected even in an allowed field");

  console.log("--- honest states ---");
  const st = resolveSystemStates(["pos_toast", "doordash"], []);
  assert(st.get("pos_toast") === "selected" && st.get("doordash") === "selected", "selected systems stay 'selected' with no connection row");
  const st2 = resolveSystemStates(["pos_toast"], [{ provider: "pos_toast", status: "CONNECTED" }]);
  assert(st2.get("pos_toast") === "connected" || st2.get("pos_toast") === "verified", "only a real connection row advances state");

  console.log("--- playbooks & voice presets ---");
  assert(RESTAURANT_PLAYBOOKS.length >= 10 && new Set(RESTAURANT_PLAYBOOKS.map((p) => p.slug)).size === RESTAURANT_PLAYBOOKS.length, "restaurant playbook slugs unique");
  assert(RESTAURANT_PLAYBOOKS.every((p) => p.example.startsWith("Illustrative")), "playbook examples are labelled illustrative");
  const base = { agentName: "Ava", companyName: "Test Bistro", whatCompanyDoes: "Neighborhood bistro", whoCalls: ["guests"], whatToHandle: ["faq"], alwaysHuman: [], hours: "", tone: "warm_professional", canSchedule: "request_only" as const, systems: [], needsApproval: ["refunds"] };
  const plain = generateConfig(base);
  const rest = generateConfig({ ...base, restaurantPresets: RESTAURANT_VOICE_PRESETS.map((p) => p.id) });
  assert(rest.responsibilities.length > plain.responsibilities.length, "restaurant presets add responsibilities");
  assert(rest.escalationRules.some((e) => /allerg/i.test(e)), "allergen handoff rule added");
  assert(JSON.stringify(rest.allowedTools) === JSON.stringify(plain.allowedTools), "presets never raise action levels");
  assert(rest.name !== "Viki", "client agent is never named Viki");
}

async function db() {
  if (!process.env.DATABASE_URL) { console.log("--- setup store: skipped (no DATABASE_URL) ---"); return; }
  console.log("--- setup store (tenant isolated) ---");
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const a = await prisma.organization.create({ data: { name: `RV A ${stamp}`, slug: `rv-a-${stamp}` } });
  const b = await prisma.organization.create({ data: { name: `RV B ${stamp}`, slug: `rv-b-${stamp}` } });
  try {
    const g = getGuide("pos_square")!;
    const fid = g.intakeFields.find((f) => f.type === "text")!.id;
    const denied = await saveSystemSetup({ organizationId: a.id, userId: "u1", role: "VIEWER", key: "pos_square", intake: { [fid]: "x" } });
    assert(!denied.ok, "viewer cannot save system setup");
    const ok = await saveSystemSetup({ organizationId: a.id, userId: "u1", role: "OWNER", key: "pos_square", intake: { [fid]: "2 locations", token: "abc" }, checklist: ["prereqs", "ladder", "fake"] });
    assert(ok.ok, "owner saves setup");
    const mapA = await getSystemSetup(a.id);
    assert(mapA.pos_square?.intake[fid] === "2 locations" && !("token" in (mapA.pos_square?.intake || {})), "intake persisted without secrets");
    assert(JSON.stringify(mapA.pos_square?.checklist) === JSON.stringify(["prereqs", "ladder"]), "checklist filtered to known ids");
    const mapB = await getSystemSetup(b.id);
    assert(!mapB.pos_square, "other tenant sees nothing");
    const conns = await prisma.integrationConnection.count({ where: { organizationId: a.id } });
    assert(conns === 0, "saving setup never creates a connection");
    const unknown = await saveSystemSetup({ organizationId: a.id, userId: "u1", role: "OWNER", key: "nope", intake: {} });
    assert(!unknown.ok, "unknown system rejected");
  } finally {
    await prisma.orgSettings.deleteMany({ where: { organizationId: { in: [a.id, b.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await prisma.$disconnect();
  }
}

(async () => {
  pure();
  await db();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
