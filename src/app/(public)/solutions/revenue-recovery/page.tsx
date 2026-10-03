import type { Metadata } from "next";
import { SolutionPage, type SolutionContent } from "@/components/public/solution-page";

export const metadata: Metadata = {
  title: "Revenue Recovery",
  description:
    "Find and recover revenue your business is already losing — underbilling, underpayment, missed charges, and contract or pricing leakage — ranked by financial impact, with verified recovery tracked separately from estimates.",
};

const content: SolutionContent = {
  tone: "amber",
  kicker: "Revenue Recovery",
  title: "Recover revenue you have already earned.",
  lede:
    "Most businesses lose revenue they never see: work delivered but not billed, payments below contract, fees never applied. Kaivaryn finds it, ranks it by value, and tracks it until the cash is recovered and verified.",
  problem: {
    heading: "Money is already leaving the business. Nobody owns finding it.",
    intro:
      "Revenue leakage hides inside systems that look healthy. It is rarely one big error — it is hundreds of small ones that no single team is responsible for.",
    items: [
      ["It is invisible in the P&L", "Underbilling and underpayment never show up as a loss. The revenue simply never arrives, so no one goes looking for it."],
      ["It lives across systems", "Contracts, billing, claims, and collections each hold part of the picture. No one sees where they disagree."],
      ["Estimates get treated as cash", "When recovery is tracked in spreadsheets, projected value gets reported as recovered — and credibility goes with it."],
    ],
  },
  finds: {
    heading: "Where the revenue is going.",
    items: [
      ["Underbilling", "Services delivered at rates below contract, or not invoiced at all."],
      ["Underpayment", "Customers or payers paying less than the agreed amount, with no follow-up."],
      ["Missed revenue", "Change orders, late fees, and billable events that were never charged."],
      ["Contract and pricing leakage", "Renewals at legacy rates, discounts beyond policy, and terms that were never enforced."],
      ["Process leakage", "Denials written off without appeal and errors that repeat because no one fixes the cause."],
      ["Ranked by impact", "Every finding is quantified and ranked by value, urgency, and confidence — not by volume."],
    ],
  },
  financial: {
    heading: "Recovered revenue drops straight to margin.",
    body:
      "Revenue you have already earned carries no new cost of sale. Recovering it — and closing the gap that caused it — improves margin and cash without adding a single customer.",
    points: [
      "One-time recovery of revenue already lost",
      "Ongoing prevention once the cause is fixed",
      "A defensible number for the CFO and the board",
    ],
  },
  executiveView: {
    heading: "What matters, what it is worth, and whether it worked.",
    body:
      "Kaivaryn analyzes the evidence, ranks the highest-value issues, and shows your team what deserves attention first. The executive view leads with money, not activity.",
    metrics: [
      { label: "Estimated opportunity", note: "What the evidence suggests is recoverable. Clearly labeled as an estimate." },
      { label: "Highest-value opportunities", note: "The few issues worth the most, ranked first, with the evidence behind each one." },
      { label: "Cash recovered", note: "What your team has recorded as recovered against each finding.", realized: true },
      { label: "Verified recovery", note: "Recovered cash confirmed against evidence. The number that goes in the board pack.", realized: true },
    ],
    columns: ["Value", "Status", "Evidence", "Owner", "Next action", "Approval"],
  },
  nextAction: {
    heading: "Each finding gets an owner, a next step, and an approval path.",
    steps: [
      ["Assign an owner", "Every opportunity has one accountable person, so nothing sits in a shared queue."],
      ["Set the next step", "Tasks, notes, and draft outreach live on the finding, with the evidence attached."],
      ["Approve what matters", "High-value recoveries and actions in outside systems wait for an explicit decision."],
      ["Your team executes", "Kaivaryn never contacts customers or changes your systems on its own."],
    ],
  },
  verification: {
    heading: "Recovered is not the same as verified.",
    body:
      "An opportunity moves from identified to recovered only when your team records the cash. It becomes verified only when that cash is confirmed against evidence. Every step is logged.",
    stages: [
      ["Identified", "Estimated value, with the evidence behind it."],
      ["Under review", "Owner assigned and evidence checked."],
      ["In recovery", "Approved work underway."],
      ["Recovered → verified", "Cash recorded, then confirmed."],
    ],
    rule: "Verified recovery can never exceed recovered cash, and estimates are never added to either.",
  },
  closing: "Find out what your business is already losing — and what it would take to get it back.",
};

export default function RevenueRecoveryPage() {
  return <SolutionPage c={content} />;
}
