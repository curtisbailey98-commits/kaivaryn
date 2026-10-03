/**
 * Command router — renovated from 720 SI `routeCommand` (think/observe → Cycles,
 * build/do/ship → Build, status → Operate). Pure + deterministic: keyword rules, no LLM.
 *
 * Kaivaryn business routes:
 *  ANALYZE    → nine-return R1–R9 intelligence cycle on Revenue Recovery and/or Operations Efficiency
 *  ANSWER     → deterministic executive question over tenant data (money glossary aware)
 *  BUILD      → governed action plan (tasks + approval gate). Executives: CHIEF Foundry hand-off for sites/apps
 *  STATUS     → Operate health check (database, engines, schedules, integrations)
 *  DIGEST     → executive briefing snapshot (stored in Inbox)
 *  RECALL     → what Kaivaryn has learned (canonical ZERO_STATE, lessons, memory) — honest if empty
 *  STANDING   → standing order with a cadence ("every day digest")
 *  PLAYBOOK   → run or save a playbook ("run playbook revenue-sweep", "save playbook X :: directive")
 *  REQUEST    → owner action request (task + approval) — Kaivaryn never auto-executes external systems
 *  SEARCH     → tenant search ("find acme")
 *  INITIATIVE → create / list initiatives ("initiative create Q4 billing cleanup")
 *  HELP       → command reference
 */
export type CommandRoute =
  | "ANALYZE"
  | "ANSWER"
  | "BUILD"
  | "STATUS"
  | "DIGEST"
  | "RECALL"
  | "STANDING"
  | "PLAYBOOK"
  | "REQUEST"
  | "SEARCH"
  | "INITIATIVE"
  | "HELP";

export type ProductScope = "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY" | "BOTH";

export type RouteResult = { route: CommandRoute; reason: string; product: ProductScope };

const RR_WORDS = /\b(revenue|billing|bill|invoice|invoic\w*|churn|lead|leads|payment|payments|pipeline|customer|customers|recover\w*|leak\w*|renewal|pricing|underbill\w*|collections?|ar)\b/;
const OE_WORDS = /\b(operations?|ops|process\w*|hours?|manual|bottleneck\w*|efficien\w*|waste|automation|automate|handoff\w*|cycle time|throughput|backlog|sla|friction|rework|staff\w*)\b/;

export function inferProduct(text: string): ProductScope {
  const t = text.toLowerCase();
  const rr = RR_WORDS.test(t);
  const oe = OE_WORDS.test(t);
  if (rr && !oe) return "REVENUE_RECOVERY";
  if (oe && !rr) return "OPERATIONS_EFFICIENCY";
  return "BOTH";
}

export function routeCommand(text: string): RouteResult {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const product = inferProduct(raw);
  const r = (route: CommandRoute, reason: string): RouteResult => ({ route, reason, product });

  if (!t) return r("HELP", "empty");
  if (t === "?" || /^help\b/.test(t) || /\bwhat can you do\b/.test(t)) return r("HELP", "help_keyword");

  // Explicit prefixes first (mirrors SI precedence: project/recipe/request/job before build)
  if (/^(initiative|initiatives|project|projects)\b/.test(t)) return r("INITIATIVE", "initiative_prefix");
  if (/^(playbooks?|recipes?)\b/.test(t) || /^run\s+(playbook|recipe)\b/.test(t) || /\b(save|create)\s+(playbook|recipe)\b/.test(t)) {
    return r("PLAYBOOK", "playbook_keyword");
  }
  if (/^request\b/.test(t)) return r("REQUEST", "request_prefix");
  if (/^(find|search|lookup|look up)\b/.test(t)) return r("SEARCH", "search_prefix");
  if (/\b(every|hourly|daily|weekly|each (morning|day|week|hour))\b/.test(t) || /^(standing|schedule)\b/.test(t)) {
    return r("STANDING", "cadence_keyword");
  }
  if (/\bdigest\b|\bbriefing\b|\bbrief me\b|\bsummar(y|ize|ise)\b|\bwhat changed\b/.test(t)) return r("DIGEST", "digest_keyword");
  if (/\brecall\b|\bremember\b|\bmemory\b|\bwhat (do|did) (you|we|kaivaryn) (know|learn)\w*\b|\blessons?\b/.test(t)) {
    return r("RECALL", "recall_keyword");
  }
  if (/^(status|health)\b|\bsystem (status|health)\b|\bplatform health\b|\bis (everything|kaivaryn) (ok|healthy|up)\b|\bhealth check\b/.test(t)) {
    return r("STATUS", "status_keyword");
  }
  if (/^(build|make|create|ship|implement|fix|deploy|launch|draft|set up|setup|plan|do)\b/.test(t) || /\b(build|ship|deploy) (a|an|the)\b/.test(t)) {
    return r("BUILD", "build_keyword");
  }
  // Questions → deterministic answers over tenant data
  if (/\?$/.test(t) || /^(how much|how many|what|which|who|where|show|list|top|pending|unassigned|give me)\b/.test(t)) {
    return r("ANSWER", "question_shape");
  }
  if (/\b(analy[sz]e|assess|observe|think|diagnose|investigate|review|scan|detect|audit|evaluate|continue|learn)\b/.test(t)) {
    return r("ANALYZE", "analysis_keyword");
  }
  // Free-tier SI default: every directive does something real → analysis cycle
  return r("ANALYZE", "default_analysis");
}

export const COMMAND_EXAMPLES: Array<{ label: string; text: string; route: CommandRoute }> = [
  { label: "Analyze revenue leakage", text: "Analyze revenue leakage in billing and renewals", route: "ANALYZE" },
  { label: "Diagnose operations friction", text: "Diagnose manual handoffs and approval bottlenecks", route: "ANALYZE" },
  { label: "How much have we recovered?", text: "How much revenue have we recovered?", route: "ANSWER" },
  { label: "Morning briefing", text: "Brief me on what changed", route: "DIGEST" },
  { label: "Platform health", text: "status", route: "STATUS" },
  { label: "Daily digest order", text: "Every day send me a digest", route: "STANDING" },
  { label: "Run revenue sweep", text: "run playbook revenue-leakage-sweep", route: "PLAYBOOK" },
  { label: "Plan a fix", text: "Plan a fix for unbilled change orders", route: "BUILD" },
  { label: "What have we learned?", text: "What did Kaivaryn learn?", route: "RECALL" },
  { label: "Request owner action", text: "request: confirm Q3 invoice export from finance", route: "REQUEST" },
];

export const COMMAND_HELP: Array<{ route: CommandRoute; name: string; triggers: string; does: string }> = [
  { route: "ANALYZE", name: "Analyze", triggers: "analyze · assess · diagnose · review · investigate (default)", does: "Runs the nine-step analysis cycle (R1–R9) on Revenue Recovery, Operations Efficiency, or both, and records a verifiable summary of what it found." },
  { route: "ANSWER", name: "Answer", triggers: "how much · what · which · top · questions ending in ?", does: "Rule-based answer from your workspace data. Potential, cash recovered, projected and realized savings stay separate." },
  { route: "BUILD", name: "Plan & build", triggers: "build · plan · fix · set up · launch · draft", does: "Creates a governed action plan: owned tasks plus an approval gate. Nothing external executes until a human approves, and integrations not connected are labeled as blockers." },
  { route: "STATUS", name: "Status", triggers: "status · health · health check", does: "Workspace health check: database latency, analysis freshness, overdue schedules, failed runs, integrations." },
  { route: "DIGEST", name: "Briefing", triggers: "digest · brief me · summary · what changed", does: "Executive briefing snapshot saved to your Inbox." },
  { route: "RECALL", name: "Recall", triggers: "recall · remember · what did Kaivaryn learn", does: "What Kaivaryn has learned from completed analysis cycles — lessons and saved context. Honest if empty." },
  { route: "STANDING", name: "Standing order", triggers: "every hour / day / week …", does: "Schedules a recurring analysis, briefing, health check, or playbook." },
  { route: "PLAYBOOK", name: "Playbook", triggers: "run playbook <slug> · save playbook <name> :: <directive>", does: "Runs a multi-step playbook with recorded run history, or saves a reusable one." },
  { route: "REQUEST", name: "Request", triggers: "request: <what you need>", does: "Records an owner action request (task + approval). Kaivaryn does not perform it on its own." },
  { route: "SEARCH", name: "Find", triggers: "find <term>", does: "Searches opportunities, inefficiencies, customers, and findings in your organization." },
  { route: "INITIATIVE", name: "Initiative", triggers: "initiative create <name> · initiatives", does: "Groups work, runs, and playbooks under a named initiative." },
];
