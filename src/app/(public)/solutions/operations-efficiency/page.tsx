import type { Metadata } from "next";
import { SolutionPage, type SolutionContent } from "@/components/public/solution-page";

export const metadata: Metadata = {
  title: "Operations Efficiency",
  description:
    "Find the manual work, bottlenecks, rework, and delays that add labor and operating cost — put a dollar value on each, assign the fix, and track realized savings separately from projections.",
};

const content: SolutionContent = {
  tone: "emerald",
  kicker: "Operations Efficiency",
  title: "Stop paying for work that shouldn't exist.",
  lede:
    "Every operation carries friction it has learned to live with: re-keying data, chasing approvals, rebuilding the same report. Kaivaryn puts a cost on it, ranks what to fix first, and tracks savings until they are realized.",
  problem: {
    heading: "Friction becomes “how we work” — and it is expensive.",
    intro:
      "Wasted effort rarely looks like waste. It looks like busy, capable people doing work the business should no longer need.",
    items: [
      ["Nobody prices the friction", "Manual steps, handoffs, and rework are absorbed as overhead, so they never compete for attention or budget."],
      ["Bottlenecks repeat", "The same queues back up every month. Fixes are informal and the cause stays in place."],
      ["Savings get promised, not proven", "Automation business cases report projected savings as if they were real, with no record of what landed."],
    ],
  },
  finds: {
    heading: "Where the time and cost are going.",
    items: [
      ["Unnecessary manual work", "Repetitive steps — reconciliations, re-keying, report assembly — that consume skilled hours every week."],
      ["Recurring bottlenecks", "Queues and approvals that age past their deadlines, department by department."],
      ["Rework and duplication", "The same data entered twice, and work redone because the first pass was wrong."],
      ["Delays and handoffs", "Lag between teams that slows delivery and cash."],
      ["Automation candidates", "Work that is ready to automate, scored on evidence and impact — not on enthusiasm."],
      ["Wasted labor, in dollars", "Hours and annual cost for each issue, so operations competes on the same terms as revenue."],
    ],
  },
  financial: {
    heading: "Recovered capacity is operating margin.",
    body:
      "Every hour spent on avoidable work is labor you pay for twice: once for the work, and again for what your team didn’t do instead. Removing it lowers operating cost and frees capacity for growth.",
    points: [
      "Annual cost of each bottleneck, in dollars and hours",
      "Projected savings you can plan around",
      "Realized savings you can defend",
    ],
  },
  executiveView: {
    heading: "Where the waste is, what it costs, and whether the fix worked.",
    body:
      "Kaivaryn ranks the highest-cost bottlenecks and shows your team what to fix first. Projected and realized savings are always shown separately.",
    metrics: [
      { label: "Projected savings", note: "What fixing the issues should save each year. Clearly labeled as a projection." },
      { label: "Wasted hours and cost", note: "Weekly hours and annual cost tied up in each bottleneck." },
      { label: "Automation candidates", note: "Work that is ready to automate, ranked by readiness and value." },
      { label: "Realized savings", note: "Savings your team has recorded after the fix was made. Never inferred.", realized: true },
    ],
    columns: ["Annual cost", "Hours / week", "Status", "Owner", "Next action", "Approval"],
  },
  nextAction: {
    heading: "Each bottleneck gets an owner, a fix, and an approval path.",
    steps: [
      ["Assign an owner", "One accountable person per issue, with the evidence and cost attached."],
      ["Agree the fix", "Process change, automation, or policy — recorded on the item with its projected savings."],
      ["Approve before change", "Automation and high-value savings claims wait for an explicit decision."],
      ["Your team executes", "Kaivaryn does not change your systems or run automation on its own."],
    ],
  },
  verification: {
    heading: "Projected is not the same as realized.",
    body:
      "Savings count only when your team records them after the change is made. Projected and realized savings sit side by side, so the open gap is always visible.",
    stages: [
      ["Identified", "Cost and hours estimated from the evidence."],
      ["Analyzing", "Owner assigned and the fix agreed."],
      ["Implementing", "Approved change underway."],
      ["Realized → verified", "Savings recorded, then confirmed."],
    ],
    rule: "Realized savings are recorded outcomes. They are never inferred from a projection.",
  },
  closing: "See what your operation is paying for that it doesn’t need — and what it would save to fix it.",
};

export default function OperationsEfficiencyPage() {
  return <SolutionPage c={content} />;
}
