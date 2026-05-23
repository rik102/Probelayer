import type { PersonaInput } from "./personas";

export type PersonaSuggestion = PersonaInput & {
  reason: string;
};

function cloneSuggestion(input: PersonaSuggestion, id: string): PersonaSuggestion {
  return {
    ...input,
    id,
    tags: Array.from(new Set([...(input.tags ?? []), "suggested"]))
  };
}

function seedFromDescription(description: string) {
  return description.toLowerCase();
}

export function suggestPersonaPack(description: string): PersonaSuggestion[] {
  const text = seedFromDescription(description);
  const suggestions: PersonaSuggestion[] = [];

  if (/checkout|billing|price|subscription|payment|trial|renewal/.test(text)) {
    suggestions.push(
      {
        id: "budget-scan",
        name: "Budget-conscious scanner",
        lens: "compares price, renewal, and commitment language at a glance",
        goal: "avoid surprise charges while understanding the real cost",
        riskBias: "hidden fees, renewal timing, and vague confirmation language",
        patience: 34,
        trust: 44,
        accessibility: "prefers explicit totals and plain cancellation language",
        tone: "careful and suspicious of ambiguity",
        penTest: false,
        tags: ["trust", "pricing", "checkout"],
        reason: "Good for billing, checkout, and subscription-heavy flows."
      },
      {
        id: "fast-checkout",
        name: "Impatient checkout user",
        lens: "skims for one obvious next step and bails when the path is too long",
        goal: "finish without a maze of confirmations",
        riskBias: "too many steps, crowded choices, and slow confirmations",
        patience: 22,
        trust: 39,
        accessibility: "needs one dominant primary action and fewer competing controls",
        tone: "fast-moving and impatient",
        penTest: false,
        tags: ["conversion", "density", "speed"],
        reason: "Useful when the flow must convert quickly with minimal friction."
      }
    );
  }

  if (/signup|onboard|activate|create account|register|start/.test(text)) {
    suggestions.push(
      {
        id: "first-run-newcomer",
        name: "First-run newcomer",
        lens: "new to the product and unsure what happens next",
        goal: "understand the first step and avoid mistakes",
        riskBias: "unclear setup steps, jargon, and weak progress cues",
        patience: 40,
        trust: 52,
        accessibility: "benefits from clear structure and concrete labels",
        tone: "tentative and cautious",
        penTest: false,
        tags: ["onboarding", "clarity", "ux"],
        reason: "Ideal for onboarding, signup, and first-time activation flows."
      },
      {
        id: "keyboard-admin",
        name: "Keyboard-first admin",
        lens: "navigates with keyboard and expects a predictable focus order",
        goal: "complete the flow without mouse dependency or traps",
        riskBias: "modal traps, missing focus states, and hidden controls",
        patience: 47,
        trust: 46,
        accessibility: "needs visible focus and stable tab order",
        tone: "precise and sequence-aware",
        penTest: false,
        tags: ["accessibility", "keyboard", "setup"],
        reason: "Great for setup flows that need keyboard and accessibility validation."
      }
    );
  }

  if (/enterprise|admin|audit|permissions|team|workspace|policy/.test(text)) {
    suggestions.push(
      {
        id: "procurement-buyer",
        name: "Procurement buyer",
        lens: "screens for data handling, trust, and policy fit",
        goal: "confirm the product is safe enough to approve",
        riskBias: "permissions, billing, compliance, and governance ambiguity",
        patience: 60,
        trust: 38,
        accessibility: "expects explicit policy and control language",
        tone: "skeptical and governance-minded",
        penTest: false,
        tags: ["b2b", "trust", "policy"],
        reason: "Useful for enterprise onboarding, admin, and governance-heavy flows."
      },
      {
        id: "policy-red-team",
        name: "Policy boundary tester",
        lens: "looks for weak policy wording and privilege confusion",
        goal: "surface unsafe bypass paths and unclear boundaries",
        riskBias: "authorization ambiguity, support manipulation, and loopholes",
        patience: 68,
        trust: 22,
        accessibility: "focuses on abuse boundaries rather than readability",
        tone: "probing and adversarial",
        penTest: true,
        tags: ["security", "policy", "bypass"],
        reason: "Good for red-team validation of admin and policy boundaries."
      }
    );
  }

  if (/mobile|phone|thumb|app/.test(text)) {
    suggestions.push(
      {
        id: "thumb-mobile",
        name: "Thumb-first mobile user",
        lens: "uses one hand, small screen, and short attention bursts",
        goal: "finish with large targets and stable layout",
        riskBias: "tiny tap targets, scroll traps, sticky bars, and hidden actions",
        patience: 33,
        trust: 47,
        accessibility: "needs readable type and predictable touch affordances",
        tone: "glance-driven and practical",
        penTest: false,
        tags: ["mobile", "touch", "ux"],
        reason: "Important for product or app experiences that will be used on phones."
      }
    );
  }

  if (/security|abuse|fraud|attack|bypass|red team/.test(text)) {
    suggestions.push(
      {
        id: "red-team-adversary",
        name: "Red-team adversary",
        lens: "actively probes the system for weak boundaries and loopholes",
        goal: "discover bypasses, repeated-submit issues, and policy gaps",
        riskBias: "authorization ambiguity, repeated actions, and unsafe action paths",
        patience: 72,
        trust: 18,
        accessibility: "not accessibility-focused; optimized for abuse testing",
        tone: "adversarial and persistent",
        penTest: true,
        tags: ["security", "abuse", "red-team"],
        reason: "Best when the product needs a deeper defensive abuse lens."
      }
    );
  }

  if (!suggestions.length) {
    suggestions.push(
      {
        id: "balanced-scan",
        name: "Balanced exploratory user",
        lens: "general-purpose evaluator for clarity, trust, and friction",
        goal: "understand the flow without requiring domain context",
        riskBias: "ambiguous labels, hidden steps, and overloaded layouts",
        patience: 41,
        trust: 49,
        accessibility: "prefers clean hierarchy and readable structure",
        tone: "measured and observant",
        penTest: false,
        tags: ["ux", "clarity", "balanced"],
        reason: "A good default when the project description is still broad."
      }
    );
  }

  return suggestions.slice(0, 5).map((suggestion, index) => cloneSuggestion(suggestion, `${suggestion.id}-${index + 1}`));
}
