/**
 * Prompted automations — turn a plain-English instruction into a standing-order draft.
 * Deterministic and rule-based (no model call). Every part of the prompt is either recognized
 * (and shown back), recorded as an explicit assumption, or listed as "not understood".
 * Nothing is silently guessed.
 */
import type { ScheduleSpec } from "./schedule";
import { DAY_NAMES, DEFAULT_TIMEZONE, describeSchedule, isValidTimezone } from "./schedule";

import type { ProductScope } from "./router";

export type MetricKey = "OPEN_RR_ESTIMATE" | "OPEN_OE_ESTIMATE" | "CRITICAL_ITEMS" | "PENDING_APPROVALS" | "FAILED_RUNS_24H";

export const METRIC_LABEL: Record<MetricKey, string> = {
  OPEN_RR_ESTIMATE: "Open revenue leakage (estimated potential)",
  OPEN_OE_ESTIMATE: "Open operations waste (projected savings)",
  CRITICAL_ITEMS: "Open critical items",
  PENDING_APPROVALS: "Pending approvals",
  FAILED_RUNS_24H: "Failed runs in the last 24 hours",
};

export const METRIC_IS_MONEY: Record<MetricKey, boolean> = {
  OPEN_RR_ESTIMATE: true,
  OPEN_OE_ESTIMATE: true,
  CRITICAL_ITEMS: false,
  PENDING_APPROVALS: false,
  FAILED_RUNS_24H: false,
};

export type AutomationCondition = { metric: MetricKey; op: "gt" | "lt"; amount: number };

export type AutomationActionKind = "ANALYZE" | "DIGEST" | "STATUS" | "DETECT" | "RECALL" | "PLAYBOOK" | "WATCH";

export type AutomationAction = {
  kind: AutomationActionKind;
  product?: ProductScope;
  playbookSlug?: string;
  playbookName?: string;
};

export type DraftPiece = { text: string; meaning: string };

export type AutomationDraft = {
  prompt: string;
  schedule: ScheduleSpec | null;
  timezone: string;
  actions: AutomationAction[];
  condition: AutomationCondition | null;
  delivery: "INBOX";
  deliveryNote: string | null;
  recognized: DraftPiece[];
  assumptions: string[];
  unparsed: string[];
  problems: string[];
  ok: boolean;
};

export type PlaybookRef = { slug: string; name: string };

export const ACTION_LABEL: Record<AutomationActionKind, string> = {
  ANALYZE: "Nine-step analysis",
  DIGEST: "Executive briefing to your Inbox",
  STATUS: "Health check",
  DETECT: "Detection sweep",
  RECALL: "Recall of what Kaivaryn has learned",
  PLAYBOOK: "Playbook",
  WATCH: "Threshold check",
};

export function productLabel(p: ProductScope | undefined) {
  return p === "REVENUE_RECOVERY" ? "Revenue Recovery" : p === "OPERATIONS_EFFICIENCY" ? "Operations Efficiency" : "Revenue Recovery + Operations Efficiency";
}

export function describeAction(a: AutomationAction): string {
  if (a.kind === "PLAYBOOK") return `Run playbook “${a.playbookName ?? a.playbookSlug}”`;
  if (a.kind === "ANALYZE") return `${ACTION_LABEL.ANALYZE} · ${productLabel(a.product)}`;
  return ACTION_LABEL[a.kind];
}

export function formatMoneyShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function describeCondition(c: AutomationCondition): string {
  const amt = METRIC_IS_MONEY[c.metric] ? formatMoneyShort(c.amount) : String(c.amount);
  return `Alert me if ${METRIC_LABEL[c.metric].toLowerCase()} is ${c.op === "gt" ? "over" : "under"} ${amt}`;
}

// ———————————————————————————— parsing helpers ————————————————————————————

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

const DAY_TOKENS: Array<[RegExp, number]> = [
  [/^sun(day)?s?$/, 0],
  [/^mon(day)?s?$/, 1],
  [/^tue(s|sday)?s?$/, 2],
  [/^wed(s|nesday)?s?$/, 3],
  [/^thu(r|rs|rsday)?s?$/, 4],
  [/^fri(day)?s?$/, 5],
  [/^sat(urday)?s?$/, 6],
];
const DAY_RE = "(?:sun(?:day)?s?|mon(?:day)?s?|tue(?:s|sday)?s?|wed(?:s|nesday)?s?|thu(?:r|rs|rsday)?s?|fri(?:day)?s?|sat(?:urday)?s?)";

function dayIndex(tok: string): number | null {
  const t = tok.toLowerCase().replace(/[^a-z]/g, "");
  for (const [re, i] of DAY_TOKENS) if (re.test(t)) return i;
  return null;
}

/** "$50k" · "50,000" · "$1.2m" · "50 thousand" → number */
export function parseAmount(raw: string): number | null {
  const t = raw.toLowerCase().replace(/[\s$,]/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)(k|thousand|m|mm|million|b|bn|billion)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = !m[2] ? 1 : /^(k|thousand)$/.test(m[2]) ? 1_000 : /^(m|mm|million)$/.test(m[2]) ? 1_000_000 : 1_000_000_000;
  return Math.round(n * mult * 100) / 100;
}

const TZ_ALIASES: Array<[RegExp, string, string]> = [
  [/\b(?:eastern(?:\s+time)?|e[sd]?t)\b/, "America/New_York", "Eastern time"],
  [/\b(?:central(?:\s+time)?|c[sd]t|ct)\b/, "America/Chicago", "Central time"],
  [/\b(?:mountain(?:\s+time)?|m[sd]t|mt)\b/, "America/Denver", "Mountain time"],
  [/\b(?:pacific(?:\s+time)?|p[sd]t|pt)\b/, "America/Los_Angeles", "Pacific time"],
  [/\b(?:utc|gmt|zulu)\b/, "UTC", "UTC"],
];

const STOPWORDS = new Set(
  "a an the and or but to me my us our we i you it its please kaivaryn every each at on in of for with then also by from about into so that this these those just can could would will should want like need let lets let's set setup up schedule scheduled create make start begin automation automate automatically standing order orders run runs running do give send sent sending get have keep my me be is are am time times o'clock oclock clock recurring regularly please thanks thank there here new results result report reports update updates a.m p.m around approx approximately sharp exactly always every-day".split(
    /\s+/,
  ),
);

type Ctx = { work: string; recognized: DraftPiece[]; assumptions: string[]; problems: string[]; warnings: string[] };

/** Consume the first match of `re` in the working string, record what it meant, and blank it out. */
function take(c: Ctx, reIn: RegExp, meaning: string | ((m: RegExpMatchArray) => string)): RegExpMatchArray | null {
  if (reIn.global) {
    // Consume every occurrence; record the meaning once.
    const single = new RegExp(reIn.source, reIn.flags.replace("g", ""));
    let first: RegExpMatchArray | null = null;
    for (let i = 0; i < 20; i++) {
      const m = take(c, single, first ? "" : meaning);
      if (!m) break;
      first = first ?? m;
    }
    return first;
  }
  const re = reIn;
  const m = c.work.match(re);
  if (!m || m.index == null) return null;
  const text = m[0].trim();
  c.work = c.work.slice(0, m.index) + " ".repeat(m[0].length) + c.work.slice(m.index + m[0].length);
  const mean = typeof meaning === "function" ? meaning(m) : meaning;
  if (text && mean) c.recognized.push({ text, meaning: mean });
  return m;
}

function normalize(raw: string) {
  return (" " + raw + " ")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\ba\.m\.?/g, "am")
    .replace(/\bp\.m\.?/g, "pm")
    .replace(/\s+/g, " ");
}

export function looksLikeAutomation(text: string): boolean {
  const t = normalize(text);
  return (
    /\b(every|each|hourly|daily|weekly|monthly|nightly|weekdays?|everyday|business days?)\b/.test(t) ||
    /\b(first|1st|last|\d{1,2}(st|nd|rd|th))\s+(day\s+)?of\s+(the|each|every)\s+month\b/.test(t) ||
    new RegExp(`\\bon\\s+${DAY_RE}\\b`).test(t) ||
    /^\s*(standing|schedule|automate|automation)\b/.test(t)
  );
}

// ———————————————————————————— main parser ————————————————————————————

export function parseAutomationPrompt(rawPrompt: string, opts?: { timezone?: string | null; playbooks?: PlaybookRef[] }): AutomationDraft {
  const prompt = String(rawPrompt || "").trim().slice(0, 600);
  const c: Ctx = { work: normalize(prompt), recognized: [], assumptions: [], problems: [], warnings: [] };
  const playbooks = opts?.playbooks ?? [];
  let deliveryNote: string | null = null;

  // Leading framing words ("schedule:", "automation:") carry no meaning.
  c.work = c.work.replace(/^\s*(standing order|standing|schedule|automation|automate)\s*:?\s*/, " ");

  // 1 ——— Timezone ———
  let timezone = isValidTimezone(opts?.timezone) ? (opts!.timezone as string) : DEFAULT_TIMEZONE;
  let tzFromPrompt = false;
  const iana = c.work.match(/\b([a-z]+\/[a-z_]+(?:\/[a-z_]+)?)\b/);
  if (iana) {
    const candidate = prompt.match(new RegExp(iana[1]!.replace("/", "\\/"), "i"))?.[0] ?? iana[1]!;
    const fixed = candidate.split("/").map((s) => s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("_")).join("/");
    if (isValidTimezone(fixed)) {
      take(c, new RegExp(`\\b(?:in\\s+)?${iana[1]!.replace("/", "\\/")}\\b`), `Time zone ${fixed}`);
      timezone = fixed;
      tzFromPrompt = true;
    }
  }
  if (!tzFromPrompt) {
    for (const [re, tz, label] of TZ_ALIASES) {
      const withPrefix = new RegExp(`(?:\\(|\\bin\\s+)?${re.source}(?:\\s+time)?\\)?`);
      if (re.test(c.work) && take(c, withPrefix, `Time zone: ${label} (${tz})`)) {
        timezone = tz;
        tzFromPrompt = true;
        break;
      }
    }
  }
  if (!tzFromPrompt) c.assumptions.push(`Time zone not stated — using ${timezone}.`);

  // 2 ——— Condition / threshold ———
  let condition: AutomationCondition | null = null;
  const condRe =
    /\b(?:and\s+)?(?:(?:alert|notify|tell|warn|ping|flag|email|text|message)\s+(?:me|us|the team)\s+)?(?:only\s+)?(?:if|when|whenever|once)\s+(?:the\s+|our\s+|total\s+|any\s+)?([a-z][a-z \-']{1,60}?)\s+(?:is\s+|are\s+|goes\s+|gets\s+|hits\s+|reaches\s+|rises\s+|climbs\s+|drops\s+|falls\s+)?(over|above|exceeds?|exceeding|more than|greater than|higher than|at least|>=|>|under|below|less than|lower than|<=|<)\s+(\$?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mm|bn|b|thousand|million|billion)?)\b/;
  const cm = c.work.match(condRe);
  if (cm) {
    const subject = cm[1]!.trim();
    const amount = parseAmount(cm[3]!);
    const op: "gt" | "lt" = /under|below|less|lower|</.test(cm[2]!) ? "lt" : "gt";
    let metric: MetricKey | null = null;
    if (/^(?:it|it's|its|it is|that|this|they|the total|total|the number|the amount)$/.test(subject)) {
      const sc = productScopeIn(c.work.replace(cm[0], " "));
      if (sc.matched && sc.product === "REVENUE_RECOVERY") metric = "OPEN_RR_ESTIMATE";
      else if (sc.matched && sc.product === "OPERATIONS_EFFICIENCY") metric = "OPEN_OE_ESTIMATE";
    } else if (/leak|revenue|recover|underbill|billing|potential|at risk|money|cash|opportunit|denial|underpay|unbilled|collections?/.test(subject)) metric = "OPEN_RR_ESTIMATE";
    else if (/waste|savings|operations|ops|ineffic|manual|hours|labor|cost/.test(subject)) metric = "OPEN_OE_ESTIMATE";
    else if (/critical|urgent/.test(subject)) metric = "CRITICAL_ITEMS";
    else if (/approval/.test(subject)) metric = "PENDING_APPROVALS";
    else if (/fail/.test(subject)) metric = "FAILED_RUNS_24H";
    if (metric && amount != null) {
      condition = { metric, op, amount };
      take(c, condRe, `Condition: ${describeCondition(condition)}`);
    } else {
      take(c, condRe, "");
      c.problems.push(`I couldn't tell what to measure in “${cm[0].trim()}”. Pick a threshold below, or leave it off.`);
    }
  } else {
    const anyCrit = /\b(?:and\s+)?(?:(?:alert|notify|tell|warn|flag)\s+(?:me|us)\s+)?(?:if|when|whenever)\s+(?:there\s+(?:are|is)\s+)?(?:any|new)\s+(critical|urgent)\s+(?:items?|issues?|findings?|problems?)\b/;
    if (anyCrit.test(c.work)) {
      condition = { metric: "CRITICAL_ITEMS", op: "gt", amount: 0 };
      take(c, anyCrit, "Condition: alert me if there are any open critical items");
    } else {
      const anyApprovals = /\b(?:and\s+)?(?:(?:alert|notify|tell)\s+(?:me|us)\s+)?(?:if|when)\s+(?:there\s+(?:are|is)\s+)?(?:any\s+)?(?:pending|waiting)\s+approvals?\b/;
      if (anyApprovals.test(c.work)) {
        condition = { metric: "PENDING_APPROVALS", op: "gt", amount: 0 };
        take(c, anyApprovals, "Condition: alert me if any approvals are pending");
      }
    }
  }

  // 3 ——— Delivery ———
  if (take(c, /\b(?:and\s+)?(?:e-?mail(?:ed)?|send it by e-?mail|by e-?mail|via e-?mail|to my e-?mail)(?:\s+(?:it|me|them|the results|to me))?\b/, "Delivery requested: email")) {
    deliveryNote = "Email delivery isn't set up on this workspace yet, so results go to your Kaivaryn Inbox instead.";
  }
  if (take(c, /\b(?:and\s+)?(?:text|sms|slack|teams)(?:\s+(?:it|me|us|the team))?\b/, "Delivery requested: text/Slack")) {
    deliveryNote = "Text and Slack delivery aren't connected, so results go to your Kaivaryn Inbox instead.";
  }
  take(c, /\b(?:to|in|into)\s+(?:my|the)\s+inbox\b/, "Delivery: Inbox");
  take(c, /\b(?:alert|notify|tell|ping|remind)\s+(?:me|us|the team)\b/, "Delivery: Inbox notification");

  // 4 ——— Schedule ———
  let schedule: ScheduleSpec | null = null;
  let timeImplied: { hour: number; minute: number; why: string } | null = null;

  const unsupported: Array<[RegExp, string]> = [
    [/\bevery\s+(?:\d+|few|couple(?: of)?)\s+(?:min(?:ute)?s?)\b|\bevery\s+minute\b/, "Minute-level schedules aren't supported — the scheduler checks about every 15 minutes. Use hourly or a time of day."],
    [/\bevery\s+other\s+(?:day|week|month|monday|tuesday|wednesday|thursday|friday)\b|\bbi-?weekly\b|\bfortnightly\b/, "“Every other …” schedules aren't supported yet. Use weekly and pause when needed."],
    [/\b(?:first|last|second|third)\s+(?:business|working)\s+day\b/, "Business-day-of-month schedules aren't supported. Use a calendar day like “the 1st of every month”."],
    [new RegExp(`\\b(?:first|second|third|fourth|last)\\s+${DAY_RE}\\s+of\\s+(?:the|each|every)\\s+month\\b`), "“First Monday of the month” style schedules aren't supported yet. Use a calendar day like “the 1st of every month”."],
    [/\b(?:quarterly|every\s+quarter|annually|yearly|every\s+year)\b/, "Quarterly and yearly schedules aren't supported yet. Use monthly."],
  ];
  for (const [re, msg] of unsupported) {
    if (re.test(c.work)) {
      take(c, re, "");
      c.problems.push(msg);
    }
  }

  // Hourly / every N hours
  const everyN = c.work.match(/\bevery\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hours?\b/);
  if (everyN) {
    const n = Number(everyN[1]) || NUM_WORDS[everyN[1]!] || 1;
    if (n >= 1 && n <= 12) {
      take(c, /\bevery\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hours?\b/, `Schedule: every ${n} hour${n === 1 ? "" : "s"}`);
      schedule = { cadence: "HOURLY", everyHours: n, minute: 0, hour: 0 };
    } else {
      take(c, /\bevery\s+\d{1,2}\s+hours?\b/, "");
      c.problems.push("Hourly intervals can be 1 to 12 hours.");
    }
  } else if (take(c, /\b(?:hourly|every\s+hour|each\s+hour|once\s+an\s+hour|on\s+the\s+hour)\b/, "Schedule: every hour")) {
    schedule = { cadence: "HOURLY", everyHours: 1, minute: 0, hour: 0 };
  }

  // Monthly
  if (!schedule) {
    const monthRe = /\b(?:on\s+)?(?:the\s+)?(first|1st|last|\d{1,2}(?:st|nd|rd|th)?)(?:\s+day)?\s+of\s+(?:the|each|every|a)\s+month\b/;
    const mm = c.work.match(monthRe);
    if (mm) {
      const tok = mm[1]!;
      const dom = tok === "first" || tok === "1st" ? 1 : tok === "last" ? -1 : Number(tok.replace(/\D/g, ""));
      if (dom === -1 || (dom >= 1 && dom <= 31)) {
        take(c, monthRe, `Schedule: ${dom === -1 ? "last day" : `day ${dom}`} of every month`);
        schedule = { cadence: "MONTHLY", dayOfMonth: dom, hour: 8, minute: 0 };
        if (dom > 28) c.assumptions.push(`Months without a day ${dom} run on their last day.`);
      }
    } else {
      const monthEach = /\b(?:monthly|every\s+month|each\s+month|once\s+a\s+month)(?:\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?)?\b/;
      const me = c.work.match(monthEach);
      if (me) {
        const dom = me[1] ? Math.min(31, Math.max(1, Number(me[1]))) : 1;
        take(c, monthEach, me[1] ? `Schedule: day ${dom} of every month` : "Schedule: monthly");
        schedule = { cadence: "MONTHLY", dayOfMonth: dom, hour: 8, minute: 0 };
        if (!me[1]) c.assumptions.push("No day of the month given — using the 1st.");
      }
    }
  }

  // Weekdays / weekends
  if (!schedule) {
    const wkRe = /\b(?:every\s+|each\s+|on\s+)?(?:weekdays?|work\s?days?|business\s+days?|monday\s*(?:through|thru|to|-)\s*friday|mon\s*(?:through|thru|to|-)\s*fri)\b/;
    if (take(c, wkRe, "Schedule: every weekday (Mon–Fri)")) {
      schedule = { cadence: "WEEKDAYS", hour: 8, minute: 0 };
    } else if (take(c, /\b(?:every\s+|on\s+)?weekends?\b/, "Schedule: Saturdays and Sundays")) {
      schedule = { cadence: "WEEKLY", daysOfWeek: [0, 6], hour: 8, minute: 0 };
    }
  }

  // Specific days ("every Monday and Thursday", "on mon, wed, fri")
  if (!schedule) {
    const listRe = new RegExp(`\\b(?:(?:every|each|on)\\s+)?${DAY_RE}(?:\\s*(?:,|and|&|\\+|/)\\s*(?:on\\s+)?${DAY_RE})*\\b`);
    const dm = c.work.match(listRe);
    if (dm) {
      const days = Array.from(new Set(dm[0].split(/[^a-z]+/).map(dayIndex).filter((d): d is number => d != null))).sort();
      if (days.length) {
        take(c, listRe, `Schedule: every ${days.map((d) => DAY_NAMES[d]).join(", ")}`);
        // "weekly" next to a day name is redundant
        take(c, /\b(?:weekly|every\s+week|each\s+week|once\s+a\s+week)\b/, "Schedule: weekly");
        schedule = { cadence: "WEEKLY", daysOfWeek: days, hour: 8, minute: 0 };
      }
    }
  }

  if (!schedule && take(c, /\b(?:weekly|every\s+week|each\s+week|once\s+a\s+week)\b/, "Schedule: weekly")) {
    schedule = { cadence: "WEEKLY", daysOfWeek: [1], hour: 8, minute: 0 };
    c.assumptions.push("No day given for a weekly schedule — using Monday.");
  }

  // Daily (with time-of-day words)
  if (!schedule) {
    const dailyRe = /\b(?:daily|every\s?day|each\s+day|once\s+a\s+day|every\s+(morning|afternoon|evening|night)|each\s+(morning|afternoon|evening|night)|nightly)\b/;
    const dd = c.work.match(dailyRe);
    if (dd) {
      const part = dd[1] || dd[2] || (/nightly/.test(dd[0]) ? "night" : null);
      take(c, dailyRe, "Schedule: every day");
      schedule = { cadence: "DAILY", hour: 8, minute: 0 };
      if (part) timeImplied = partOfDay(part);
    }
  }

  // 5 ——— Time of day ———
  if (schedule) {
    let time: { hour: number; minute: number } | null = null;
    const explicit = /\b(?:at\s+|@\s*|by\s+|around\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/;
    const at24 = /\b(?:at|@|by|around)\s+(\d{1,2}):(\d{2})\b/;
    const atBare = /\b(?:at|@|by|around)\s+(\d{1,2})(?!\s*(?:st|nd|rd|th|%|k\b|hours?|minutes?|days?))\b/;
    const em = c.work.match(explicit);
    if (em) {
      let h = Number(em[1]) % 12;
      if (em[3] === "pm") h += 12;
      const mi = Number(em[2] ?? 0);
      if (Number(em[1]) >= 1 && Number(em[1]) <= 12 && mi < 60) {
        time = { hour: h, minute: mi };
        take(c, explicit, `Time: ${fmt(h, mi)}`);
      }
    } else if (c.work.match(at24)) {
      const m = c.work.match(at24)!;
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (h <= 23 && mi <= 59) {
        time = { hour: h, minute: mi };
        take(c, at24, `Time: ${fmt(h, mi)}`);
        if (h >= 1 && h <= 11) c.assumptions.push(`Read “${m[1]}:${m[2]}” as ${fmt(h, mi)} (24-hour clock).`);
      }
    } else if (c.work.match(atBare) && schedule.cadence !== "HOURLY") {
      const m = c.work.match(atBare)!;
      const n = Number(m[1]);
      if (n >= 0 && n <= 23) {
        const h = n >= 13 || n === 0 ? n : n === 12 ? 12 : n >= 7 ? n : n + 12;
        time = { hour: h, minute: 0 };
        take(c, atBare, `Time: ${fmt(h, 0)}`);
        if (n >= 1 && n <= 12) c.assumptions.push(`Read “at ${n}” as ${fmt(h, 0)} (no am/pm given).`);
      }
    }
    if (!time) {
      const named: Array<[RegExp, number, number, string]> = [
        [/\b(?:at\s+)?(?:noon|midday|lunchtime)\b/, 12, 0, "noon"],
        [/\b(?:at\s+)?midnight\b/, 0, 0, "midnight"],
        [/\b(?:at\s+)?(?:end\s+of\s+(?:the\s+)?(?:day|business)|eod|close\s+of\s+business|cob)\b/, 17, 0, "end of day"],
        [/\b(?:at\s+)?(?:start\s+of\s+(?:the\s+)?day|first\s+thing(?:\s+in\s+the\s+morning)?)\b/, 8, 0, "start of day"],
      ];
      for (const [re, h, mi, label] of named) {
        if (take(c, re, `Time: ${fmt(h, mi)} (${label})`)) {
          time = { hour: h, minute: mi };
          if (label === "end of day" || label === "start of day") c.assumptions.push(`Read “${label}” as ${fmt(h, mi)}.`);
          break;
        }
      }
    }
    if (!time) {
      const pod = c.work.match(/\b(?:in\s+the\s+|each\s+|every\s+)?(morning|afternoon|evening|night)s?\b/);
      if (pod) {
        timeImplied = partOfDay(pod[1]!);
        take(c, /\b(?:in\s+the\s+|each\s+|every\s+)?(morning|afternoon|evening|night)s?\b/, "");
      }
    }
    if (schedule.cadence === "HOURLY") {
      const past = c.work.match(/\b(?:at\s+)?(?::(\d{2})|(\d{1,2})\s+(?:minutes\s+)?past(?:\s+the\s+hour)?)\b/);
      if (past) {
        const mi = Number(past[1] ?? past[2]);
        if (mi >= 0 && mi <= 59) {
          schedule.minute = mi;
          take(c, /\b(?:at\s+)?(?::(\d{2})|(\d{1,2})\s+(?:minutes\s+)?past(?:\s+the\s+hour)?)\b/, `Minute: :${String(mi).padStart(2, "0")} past the hour`);
        }
      } else if (time) {
        schedule.minute = time.minute;
      }
    } else if (time) {
      schedule.hour = time.hour;
      schedule.minute = time.minute;
    } else if (timeImplied) {
      schedule.hour = timeImplied.hour;
      schedule.minute = timeImplied.minute;
      c.assumptions.push(`Read “${timeImplied.why}” as ${fmt(timeImplied.hour, timeImplied.minute)}.`);
    } else {
      c.assumptions.push(`No time given — using ${fmt(schedule.hour, schedule.minute)}.`);
    }
  } else {
    // A time with no recurrence is not a schedule — say so instead of guessing "daily".
    const lone = c.work.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:tomorrow|tonight|today|next\s+week|in\s+\d+\s+(?:min(?:ute)?s?|hours?|days?))\b/);
    if (lone) c.problems.push(`“${lone[0].trim()}” sets a time but not how often. Add “every day”, “every Monday”, “weekdays”, “hourly”, or “the 1st of every month”.`);
  }
  if (!schedule && !c.problems.some((p) => /schedules? aren't supported|how often|Hourly intervals/.test(p))) {
    c.problems.push("I couldn't find how often to run this. Try “every Monday at 8am”, “daily at 7”, “every weekday at 9”, “hourly”, or “first of the month”.");
  }

  // 6 ——— Actions ———
  const found: Array<{ at: number; action: AutomationAction; meaning: string }> = [];
  const record = (re: RegExp, action: AutomationAction | ((m: RegExpMatchArray) => AutomationAction | null), meaning?: (a: AutomationAction) => string) => {
    for (;;) {
      const m = c.work.match(re);
      if (!m || m.index == null) return;
      const a = typeof action === "function" ? action(m) : action;
      const at = m.index;
      take(c, re, a ? (meaning ? meaning(a) : `Action: ${describeAction(a)}`) : "");
      if (a) found.push({ at, action: a, meaning: "" });
      if (!re.global) return;
    }
  };

  // Playbooks by explicit "playbook <name>"
  const pbRe = /\b(?:run\s+|execute\s+|kick\s+off\s+)?(?:the\s+|my\s+|our\s+)?playbook\s+["']?([a-z0-9][a-z0-9 \-]{1,60}?)["']?(?=\s*$|\s*[,.;]|\s+(?:every|each|on|at|daily|weekly|monthly|hourly|and|then|if|when)\b)/;
  const pbm = c.work.match(pbRe);
  if (pbm) {
    const name = pbm[1]!.trim();
    const pb = matchPlaybook(name, playbooks);
    if (pb) record(pbRe, { kind: "PLAYBOOK", playbookSlug: pb.slug, playbookName: pb.name });
    else {
      take(c, pbRe, "");
      c.problems.push(`No playbook named “${name}” in this workspace${playbooks.length ? ` — available: ${playbooks.map((p) => p.name).join(", ")}` : ""}.`);
    }
  }
  // Playbooks by name ("revenue leakage sweep", custom names)
  const aliases: Array<[RegExp, string]> = [
    [/\b(?:the\s+)?(?:revenue\s+(?:leakage\s+)?sweep|leakage\s+sweep|revenue\s+leak(?:age)?\s+sweep)\b/, "revenue-leakage-sweep"],
    [/\b(?:the\s+)?(?:operations?\s+(?:friction\s+)?sweep|ops\s+sweep|friction\s+sweep)\b/, "operations-friction-sweep"],
    [/\b(?:the\s+)?(?:executive\s+(?:weekly\s+)?review|weekly\s+(?:executive\s+)?review)\b/, "executive-weekly-review"],
    [/\b(?:the\s+)?high[- ]value\s+(?:recovery\s+)?(?:governance|review)\b/, "high-value-recovery-governance"],
    [/\b(?:the\s+)?automation\s+candidates?(?:\s+review)?\b/, "automation-candidate-review"],
  ];
  for (const [re, slug] of aliases) {
    const pb = playbooks.find((p) => p.slug === slug) ?? (playbooks.length ? null : { slug, name: slug.replace(/-/g, " ").replace(/^\w/, (x) => x.toUpperCase()) });
    if (pb && re.test(c.work)) record(re, { kind: "PLAYBOOK", playbookSlug: pb.slug, playbookName: pb.name });
  }
  for (const pb of playbooks) {
    if (pb.name.length < 6) continue;
    const re = new RegExp(`\\b(?:run\\s+)?(?:the\\s+)?${escapeRe(pb.name.toLowerCase())}\\b`);
    if (re.test(c.work)) record(re, { kind: "PLAYBOOK", playbookSlug: pb.slug, playbookName: pb.name });
  }

  record(/\b(?:(?:send|give|email|deliver)\s+(?:me\s+|us\s+)?)?(?:an?\s+|the\s+|my\s+)?(?:(?:executive|morning|daily|weekly|monthly|evening)\s+)?(?:briefing|brief(?!\s+me)|digest|summary|recap|rundown|snapshot|what\s+changed|status\s+report|report)\b|\bbrief\s+(?:me|us)\b|\bsummari[sz]e\b|\bcatch\s+me\s+up\b|\b(?:update|keep)\s+me\s+(?:posted|updated|informed|in\s+the\s+loop)?\b/, { kind: "DIGEST" });
  record(/\b(?:run\s+)?(?:an?\s+|the\s+)?(?:platform\s+|system\s+|workspace\s+)?(?:health\s*checks?|health|uptime\s+check|system\s+check|status\s+check)\b/, { kind: "STATUS" });
  record(/\b(?:run\s+)?(?:the\s+)?(?:detection(?:\s+(?:sweep|run|engines?))?|detect(?:ion)?\s+rules|re-?scan|rescan|scan\s+for\s+(?:new\s+)?(?:leakage|issues|items))\b/, { kind: "DETECT" });
  record(/\b(?:recall|what\s+(?:did\s+)?(?:we|kaivaryn)\s+(?:have\s+)?learn(?:ed|t)?|lessons\s+learned)\b/, { kind: "RECALL" });

  // Analysis — product from the words around it.
  const analyzeRe = /\b(?:run\s+)?(?:an?\s+|the\s+|full\s+)?(?:analy[sz]e|analysis|analyses|nine[- ]step(?:\s+analysis)?|intelligence\s+cycle|cycle|assess(?:ment)?|diagnose|investigate|audit|review|deep\s+dive)\b/;
  const watchRe = /\b(?:check|monitor|watch|track|keep\s+an\s+eye\s+on|look\s+at)\b/;
  const scope = productScopeIn(c.work);
  if (analyzeRe.test(c.work)) {
    record(analyzeRe, { kind: "ANALYZE", product: scope.product });
    if (scope.matched) for (const re of scope.consume) take(c, re, `Scope: ${productLabel(scope.product)}`);
    else c.assumptions.push("No area named for the analysis — covering Revenue Recovery and Operations Efficiency.");
  } else if (watchRe.test(c.work)) {
    if (condition) {
      record(watchRe, { kind: "WATCH" }, () => "Action: threshold check");
      if (scope.matched) for (const re of scope.consume) take(c, re, "");
    } else if (scope.matched) {
      record(watchRe, { kind: "ANALYZE", product: scope.product });
      for (const re of scope.consume) take(c, re, `Scope: ${productLabel(scope.product)}`);
      c.assumptions.push(`Read “check ${scope.words.join("/")}” as a nine-step analysis of ${productLabel(scope.product)}.`);
    }
  } else if (scope.matched && found.length === 0 && !condition) {
    // e.g. "every Monday revenue leakage" — the area is clear, the verb isn't.
    found.push({ at: 0, action: { kind: "ANALYZE", product: scope.product }, meaning: "" });
    for (const re of scope.consume) take(c, re, `Action: ${describeAction({ kind: "ANALYZE", product: scope.product })}`);
    c.assumptions.push(`No action verb — reading it as a nine-step analysis of ${productLabel(scope.product)}.`);
  } else if (scope.matched) {
    for (const re of scope.consume) take(c, re, "");
  }

  if (!found.length && condition) found.push({ at: 0, action: { kind: "WATCH" }, meaning: "" });

  const actions = dedupeActions(found.sort((a, b) => a.at - b.at).map((f) => f.action)).slice(0, 4);
  if (!actions.length && !c.problems.some((p) => /playbook named/.test(p))) {
    c.problems.push("I couldn't tell what to do on that schedule. Try “send me a briefing”, “analyze revenue leakage”, “run a health check”, “run the revenue sweep”, or add a threshold like “alert me if leakage is over $50k”.");
  }

  // 7 ——— What's left ———
  const unparsed = c.work
    .replace(/[^a-z0-9$%'\- ]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['\-]+|['\-]+$/g, ""))
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w) && w.length > 1);

  const draft: AutomationDraft = {
    prompt,
    schedule,
    timezone,
    actions,
    condition,
    delivery: "INBOX",
    deliveryNote,
    recognized: c.recognized.filter((r) => r.meaning),
    assumptions: c.assumptions,
    unparsed: Array.from(new Set(unparsed)).slice(0, 12),
    problems: c.problems,
    ok: Boolean(schedule && actions.length && c.problems.length === 0),
  };
  return draft;
}

function fmt(h: number, m: number) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function partOfDay(part: string): { hour: number; minute: number; why: string } {
  switch (part) {
    case "afternoon":
      return { hour: 13, minute: 0, why: "afternoon" };
    case "evening":
      return { hour: 18, minute: 0, why: "evening" };
    case "night":
      return { hour: 21, minute: 0, why: "night" };
    default:
      return { hour: 8, minute: 0, why: "morning" };
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchPlaybook(name: string, playbooks: PlaybookRef[]): PlaybookRef | null {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (
    playbooks.find((p) => p.slug === slug) ??
    playbooks.find((p) => p.name.toLowerCase() === name.toLowerCase()) ??
    playbooks.find((p) => p.slug.startsWith(slug) || p.name.toLowerCase().startsWith(name.toLowerCase())) ??
    null
  );
}

const RR_SCOPE: RegExp[] = [/\b(?:revenue\s+recovery|rr)\b/, /\b(?:revenue|billing|bills?|invoic\w*|leak\w*|churn|payments?|payer\w*|claims?|denials?|underbill\w*|underpay\w*|collections?|receivables?|pricing|contracts?|renewals?|recover\w*)\b/];
const OE_SCOPE: RegExp[] = [/\b(?:operations\s+efficiency|oe)\b/, /\b(?:operations?|ops|process\w*|manual|bottleneck\w*|efficien\w*|waste|handoffs?|cycle\s+time|throughput|backlog|sla|staffing|timesheets?|labor)\b/];
const BOTH_SCOPE = /\b(?:both|everything|all\s+areas|rr\s+(?:and|&|\+)\s+oe|oe\s+(?:and|&|\+)\s+rr|revenue\s+(?:and|&)\s+operations|operations\s+(?:and|&)\s+revenue)\b/;

function productScopeIn(work: string): { product: ProductScope; matched: boolean; consume: RegExp[]; words: string[] } {
  if (BOTH_SCOPE.test(work)) return { product: "BOTH", matched: true, consume: [new RegExp(BOTH_SCOPE.source, "g")], words: [work.match(BOTH_SCOPE)![0]] };
  const rrHits = RR_SCOPE.filter((re) => re.test(work));
  const oeHits = OE_SCOPE.filter((re) => re.test(work));
  const words = [...rrHits, ...oeHits].map((re) => work.match(re)![0]);
  const consume = [...rrHits, ...oeHits].map((re) => new RegExp(re.source, "g"));
  if (rrHits.length && !oeHits.length) return { product: "REVENUE_RECOVERY", matched: true, consume, words };
  if (oeHits.length && !rrHits.length) return { product: "OPERATIONS_EFFICIENCY", matched: true, consume, words };
  if (rrHits.length && oeHits.length) return { product: "BOTH", matched: true, consume, words };
  return { product: "BOTH", matched: false, consume: [], words: [] };
}

function dedupeActions(list: AutomationAction[]): AutomationAction[] {
  const seen = new Set<string>();
  const out: AutomationAction[] = [];
  for (const a of list) {
    const key = `${a.kind}:${a.product ?? ""}:${a.playbookSlug ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  // A WATCH next to a real action is redundant: the condition check runs after any action.
  return out.length > 1 ? out.filter((a) => a.kind !== "WATCH") : out;
}

/** Title for a draft: "Executive briefing · Every Monday at 8:00 AM ET". */
export function draftTitle(d: Pick<AutomationDraft, "actions" | "condition" | "schedule" | "timezone">): string {
  const what = d.actions.length
    ? d.actions
        .map((a) => (a.kind === "PLAYBOOK" ? a.playbookName ?? "Playbook" : a.kind === "ANALYZE" ? `Analysis · ${a.product === "REVENUE_RECOVERY" ? "RR" : a.product === "OPERATIONS_EFFICIENCY" ? "OE" : "RR + OE"}` : a.kind === "DIGEST" ? "Executive briefing" : a.kind === "WATCH" ? (d.condition ? `Watch · ${METRIC_LABEL[d.condition.metric].split(" (")[0]}` : "Threshold check") : ACTION_LABEL[a.kind]))
        .join(" + ")
    : "Automation";
  return d.schedule ? `${what} · ${describeSchedule(d.schedule, d.timezone)}` : what;
}
