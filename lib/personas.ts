export type Persona = {
  id: string;
  name: string;
  lens: string;
  goal: string;
  riskBias: string;
  patience: number;
  trust: number;
  accessibility: string;
  tone: string;
  penTest: boolean;
  tags: string[];
};

export type PersonaInput = Partial<Persona> & {
  id?: string;
  name?: string;
};

export const defaultPersonas: Persona[] = [
  {
    id: "older-adult",
    name: "Low-tech older adult",
    lens: "careful reader, low confidence with modern web patterns, worried about mistakes",
    goal: "finish the flow without feeling tricked or locked in",
    riskBias: "password wording, unlabeled icons, unclear next steps, hidden consequences",
    patience: 38,
    trust: 46,
    accessibility: "prefers large targets, clear labels, and minimal ambiguity",
    tone: "cautious and deliberate",
    penTest: false,
    tags: ["ux", "accessibility", "clarity"]
  },
  {
    id: "distracted-parent",
    name: "Distracted single parent",
    lens: "time-constrained, multitasking, scanning rather than reading",
    goal: "finish quickly while avoiding surprise charges",
    riskBias: "dense copy, long forms, interrupted checkout, ambiguous pricing",
    patience: 31,
    trust: 52,
    accessibility: "prefers direct action labels and short decision paths",
    tone: "rushed and pragmatic",
    penTest: false,
    tags: ["ux", "trust", "speed"]
  },
  {
    id: "impatient-shopper",
    name: "Impatient shopper",
    lens: "fast-moving, price-sensitive, intolerant of friction",
    goal: "understand value and complete purchase with minimal steps",
    riskBias: "hidden fees, slow confirmation, forced account creation, clutter",
    patience: 22,
    trust: 41,
    accessibility: "benefits from one obvious primary action and low cognitive load",
    tone: "decisive and impatient",
    penTest: false,
    tags: ["ux", "conversion", "density"]
  },
  {
    id: "non-native-speaker",
    name: "Non-native English speaker",
    lens: "literal interpretation, sensitive to idioms and vague labels",
    goal: "understand each action without relying on cultural context",
    riskBias: "idioms, legal phrasing, vague confirmations, vague error states",
    patience: 49,
    trust: 55,
    accessibility: "needs concrete verbs and plain-language guidance",
    tone: "careful and literal",
    penTest: false,
    tags: ["ux", "language", "clarity"]
  },
  {
    id: "visual-overload",
    name: "Visually overwhelmed user",
    lens: "sensitive to clutter, contrast, competing calls to action, and dense layouts",
    goal: "identify the correct action without cognitive overload",
    riskBias: "too many choices, low contrast, crowded forms, noisy hierarchy",
    patience: 35,
    trust: 48,
    accessibility: "needs spacing, contrast, and a strong visual hierarchy",
    tone: "overloaded and uncertain",
    penTest: false,
    tags: ["ux", "density", "hierarchy"]
  },
  {
    id: "scammer",
    name: "Scammer / exploit seeker",
    lens: "adversarial, probes refund, support, promo, and authorization loopholes",
    goal: "find a path to misuse the product or extract unintended value",
    riskBias: "refund policy gaps, authorization confusion, weak identity checks",
    patience: 64,
    trust: 18,
    accessibility: "not an accessibility persona; focused on abuse paths and weak boundaries",
    tone: "probing and adversarial",
    penTest: true,
    tags: ["security", "abuse", "policy"]
  },
  {
    id: "mobile-first",
    name: "First-time mobile user",
    lens: "thumb-first, distracted by small screen, limited patience for microscopic controls",
    goal: "complete the flow on a phone without accidental taps or hidden steps",
    riskBias: "tiny tap targets, sticky bars, scroll traps, off-screen actions",
    patience: 34,
    trust: 50,
    accessibility: "needs large touch targets, readable type, and stable layout",
    tone: "mobile-dependent and glance-driven",
    penTest: false,
    tags: ["mobile", "touch", "ux"]
  },
  {
    id: "enterprise-buyer",
    name: "Security-conscious enterprise buyer",
    lens: "evaluates trust, control, compliance, and procurement fit",
    goal: "confirm the product is safe enough for a team rollout",
    riskBias: "permissions, data handling, auditability, account boundaries",
    patience: 58,
    trust: 39,
    accessibility: "needs clear policy language and confidence around governance",
    tone: "skeptical and procurement-minded",
    penTest: false,
    tags: ["trust", "security", "b2b"]
  },
  {
    id: "neurodivergent",
    name: "Neurodivergent / executive-function sensitive user",
    lens: "sensitive to task switching, mental load, and ambiguous sequencing",
    goal: "complete the task without losing place or momentum",
    riskBias: "too many buttons, multi-step ambiguity, memory burden, competing paths",
    patience: 42,
    trust: 53,
    accessibility: "needs clear prioritization, fewer simultaneous choices, and strong structure",
    tone: "methodical but easily overloaded",
    penTest: false,
    tags: ["accessibility", "cognitive-load", "density"]
  },
  {
    id: "keyboard-only",
    name: "Keyboard-only accessibility user",
    lens: "navigates with tab, enter, and focus order; sensitive to traps and missing focus states",
    goal: "complete the flow without mouse dependency",
    riskBias: "broken focus order, invisible focus, modal traps, custom controls",
    patience: 47,
    trust: 44,
    accessibility: "needs visible focus, predictable tab order, and well-labeled controls",
    tone: "precise and sequence-aware",
    penTest: false,
    tags: ["accessibility", "keyboard", "focus"]
  }
];

export const stressPersonas: Persona[] = [
  {
    id: "button-masher",
    name: "Button masher / rapid retry tester",
    lens: "double-clicks, back-button thrash, repeated submits, and impatient burst interactions",
    goal: "surface duplicate submissions, unstable states, and unclear disabled behavior",
    riskBias: "loading spinners, repeated clicks, destructive actions, race conditions",
    patience: 19,
    trust: 44,
    accessibility: "needs clear disabled states, predictable feedback, and idempotent actions",
    tone: "impatient and repetitive",
    penTest: true,
    tags: ["qa", "stress", "interaction"]
  },
  {
    id: "red-team-tester",
    name: "Red-team pen tester",
    lens: "adversarial security reviewer probing bypasses, policy leaks, and weak boundaries",
    goal: "find unsafe bypasses, weak guardrails, and abusive action paths",
    riskBias: "promo loopholes, invite abuse, confirmation bypass, authorization ambiguity",
    patience: 66,
    trust: 21,
    accessibility: "not accessibility-focused; scans for policy and abuse boundaries",
    tone: "probing and adversarial",
    penTest: true,
    tags: ["security", "abuse", "bypass"]
  }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text.length ? text : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
  return fallback;
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizePersona(input: PersonaInput, index = 0): Persona {
  const baseId = cleanText(input.id, `custom-persona-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const name = cleanText(input.name, `Custom persona ${index + 1}`);
  const lens = cleanText(input.lens, "custom lens");
  const goal = cleanText(input.goal, "test the product flow");
  const riskBias = cleanText(input.riskBias, "general trust and clarity risks");
  const accessibility = cleanText(input.accessibility, "general accessibility considerations");
  const tone = cleanText(input.tone, "balanced");
  const tags = Array.from(
    new Set(
      (Array.isArray(input.tags) ? input.tags : [])
        .map((tag) => cleanText(tag, "").toLowerCase())
        .filter(Boolean)
    )
  );

  return {
    id: baseId || `custom-persona-${index + 1}`,
    name,
    lens,
    goal,
    riskBias,
    patience: clamp(Math.round(toNumber(input.patience, 45)), 1, 100),
    trust: clamp(Math.round(toNumber(input.trust, 50)), 1, 100),
    accessibility,
    tone,
    penTest: toBoolean(input.penTest, false),
    tags: tags.length ? tags : ["custom"]
  };
}

export function selectDefaultPersonas(mode: string) {
  if (mode === "pen-test") {
    return [
      ...defaultPersonas.filter((persona) => persona.penTest || persona.tags.includes("security")),
      ...stressPersonas
    ];
  }
  if (mode === "cognitive") {
    return defaultPersonas.filter((persona) => persona.tags.includes("accessibility") || persona.tags.includes("density"));
  }
  if (mode === "mobile") {
    return defaultPersonas.filter((persona) => persona.tags.includes("mobile") || persona.tags.includes("touch"));
  }
  return defaultPersonas;
}
