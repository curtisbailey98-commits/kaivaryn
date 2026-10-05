/**
 * Restaurant presets for the "Let Kaivaryn build it for me" voice-agent questionnaire.
 * They only add responsibilities and handoff/approval rules. They never raise an action level:
 * consequential tools stay "needs approval" and Kaivaryn's built-in handoff rules still apply.
 */
export type RestaurantVoicePreset = { id: string; label: string; description: string; responsibilities: string[]; escalation: string[] };

export const RESTAURANT_VOICE_PRESETS: RestaurantVoicePreset[] = [
  {
    id: "res_reservations",
    label: "Reservations, hours & location",
    description: "Hours, directions, parking, and reservation requests a person confirms.",
    responsibilities: [
      "Answer hours, location, parking, and reservation-policy questions from approved knowledge only",
      "Capture reservation requests (name, party size, date, time, phone) for the team to confirm — a table is only booked once a reservation system is connected and a person confirms",
    ],
    escalation: [],
  },
  {
    id: "res_menu_allergen",
    label: "Menu & allergen questions (careful)",
    description: "Answers from the approved menu only. Never guarantees an item is allergen-free.",
    responsibilities: [
      "Answer menu questions only from the approved menu and approved knowledge",
      "For allergy or dietary questions, share only what approved knowledge states, never promise an item is free of an allergen, and offer to connect the caller with a manager",
    ],
    escalation: [
      "Always hand off: any allergy or dietary question the approved menu does not clearly answer, or whenever unsure",
    ],
  },
  {
    id: "res_large_party",
    label: "Large-party & catering inquiries",
    description: "Takes the details; a person follows up with pricing and menus.",
    responsibilities: [
      "Take large-party, private-event, and catering inquiries: date, headcount, occasion, budget, and contact details for a person to follow up",
    ],
    escalation: [
      "Needs approval before anything is promised: large-party or catering pricing, deposits, minimums, and custom menus",
    ],
  },
  {
    id: "res_human_orders",
    label: "Order status, complaints & refunds go to a person",
    description: "These always reach your team, never handled by the agent alone.",
    responsibilities: [],
    escalation: [
      "Always hand off: order status questions, complaints about a visit or order, and refund requests",
    ],
  },
];

export const RESTAURANT_CALLER_TYPES = [
  ["guests", "Guests and diners"],
  ["event_planners", "Event and catering planners"],
] as const;

export function restaurantPresetAdditions(ids: string[] | undefined): { responsibilities: string[]; escalation: string[] } {
  const chosen = RESTAURANT_VOICE_PRESETS.filter((p) => (ids || []).includes(p.id));
  return { responsibilities: chosen.flatMap((p) => p.responsibilities), escalation: chosen.flatMap((p) => p.escalation) };
}
