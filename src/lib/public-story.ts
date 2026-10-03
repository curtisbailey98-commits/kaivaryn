/**
 * Public-site narrative for the renovated platform. Describes what the product actually does —
 * every line here maps to shipped code (see docs/SI_RENOVATION.md). No metrics, no customer claims.
 */
export const NINE_RETURNS = [
  { code: "R1", stage: "REALITY", name: "Reality", line: "Reads current revenue or operations records. Too little evidence returns INSUFFICIENT_DATA instead of a guess." },
  { code: "R2", stage: "MEMORY", name: "Memory", line: "Retrieves the prior continuity state, lessons, and recorded outcomes for this organization." },
  { code: "R3", stage: "PREDICTION", name: "Prediction", line: "States what happens if nothing changes, with an explicit confidence that is later checked." },
  { code: "R4", stage: "COUNTERFACTUAL", name: "Counterfactual", line: "Compares intervention paths so the recommendation is a choice, not an assertion." },
  { code: "R5", stage: "CRITIC", name: "Critic", line: "Challenges the conclusion and records contradictions and errors as lessons." },
  { code: "R6", stage: "SELF", name: "Self-model", line: "Notes where the current method is weak or under-sampled." },
  { code: "R7", stage: "CALIBRATION", name: "Calibration", line: "Adjusts confidence against what actually happened in prior cycles." },
  { code: "R8", stage: "META", name: "Meta", line: "Looks for patterns across cycles; promotes a challenger method only on measured evidence." },
  { code: "R9", stage: "WITNESS", name: "Witness", line: "The only stage allowed to sign the next continuity state. The cycle then closes at ZERO_RETURN." },
] as const;

export const PLATFORM_LAYERS = [
  {
    n: "05",
    name: "Executive surfaces",
    body: "Home operating desk, Inbox with briefings, Action Center, Initiatives, and Operate health. Estimates and recorded outcomes are shown side by side, never summed.",
    items: ["Operating desk", "Inbox & briefings", "Action Center", "Initiatives", "Operate health"],
  },
  {
    n: "04",
    name: "Operating layer",
    body: "Command routes every ask into a real action. Playbooks chain steps. Standing orders repeat them. Every execution is a recorded run, and approval gates pause for a person.",
    items: ["Command", "Playbooks", "Standing orders", "Run history", "Approval gates"],
  },
  {
    n: "03",
    name: "Nine-return intelligence",
    body: "A bounded nine-step analysis cycle per product — from what the data shows, through critique and calibration, to a signed record the next cycle starts from.",
    items: ["Nine-step cycle", "Signed record of findings", "Lessons & memory", "Primary / challenger methods"],
  },
  {
    n: "02",
    name: "Detection engines",
    body: "Rule-based detectors for stalled leads, dormant customers, failed payments, approval delays, manual repetition, bottlenecks, and more. Each rule reports when its data is insufficient.",
    items: ["Revenue detectors", "Operations detectors", "Findings with evidence", "Impact scoring"],
  },
  {
    n: "01",
    name: "Data & evidence",
    body: "CSV import and manual entry today. System connectors are scoped per engagement and labeled not connected until they are — never assumed.",
    items: ["CSV import", "Manual entry", "Evidence records", "Connector status"],
  },
] as const;

export const OPERATING_LOOP = [
  { n: "01", name: "Ask", body: "An executive types a question or direction into Command — “brief me”, “analyze billing leakage”, “plan a fix”." },
  { n: "02", name: "Route", body: "Deterministic rules send it to analysis, an answer, a plan, a briefing, a schedule, or a playbook. The routing reason is recorded." },
  { n: "03", name: "Analyze", body: "Detection plus the nine-return cycle on Revenue Recovery, Operations Efficiency, or both." },
  { n: "04", name: "Gate", body: "Plans create an owned task and pause at an approval gate. Nothing outside Kaivaryn is executed on its own." },
  { n: "05", name: "Brief", body: "Digests and recalls land in the Inbox — what changed, what is pending, and what the last analysis concluded." },
  { n: "06", name: "Measure", body: "Cash recovered and realized savings are recorded outcomes, kept separate from pipeline and projected savings." },
] as const;

export const GOVERNANCE_RAILS = [
  ["Tenant isolation", "Every record and every query is scoped to one organization. Cross-tenant access is tested on every build."],
  ["Role-based access", "Viewers can ask and read. Analysts can run analysis and plans. Managers and above approve."],
  ["Human-in-the-loop", "Approval gates pause runs. Approving resumes internal steps only — external actions are performed by your team."],
  ["Deterministic engines", "Routing, detection, and the nine-return cycle are rule-based. No generative model sits in the analysis path."],
  ["Audit trail", "Commands, runs, standing orders, approvals, and playbook changes write audit events."],
  ["Honest states", "Missing data returns INSUFFICIENT_DATA. Missing integrations are labeled. Projected is never shown as realized."],
] as const;
