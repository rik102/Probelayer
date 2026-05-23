import { chromium } from "playwright";
import { callOpenAICompatibleChat } from "./llm";
import {
  Persona,
  PersonaInput,
  defaultPersonas,
  normalizePersona,
  selectDefaultPersonas
} from "./personas";

export type AnalysisScenario = "balanced" | "pen-test" | "cognitive" | "mobile";

export type SimulationFinding = {
  persona: string;
  severity: "low" | "medium" | "high";
  theme: string;
  evidence: string;
  recommendation: string;
  x: number;
  y: number;
  emotion: "confused" | "anxious" | "frustrated" | "mistrustful" | "curious";
};

export type DialSettings = {
  designVariance: number;
  motionIntensity: number;
  visualDensity: number;
};

export type SimulationResult = {
  targetUrl: string;
  scenario: AnalysisScenario;
  screenshot?: string;
  analysisMode: "heuristic" | "model";
  pageFacts: {
    buttonCount: number;
    linkCount: number;
    inputCount: number;
    headingCount: number;
    analysisInputs: string[];
    interaction: InteractionFacts;
  };
  summary: string;
  scores: {
    confusion: number;
    trustRisk: number;
    abandonment: number;
    exploitability: number;
    visualOverload: number;
    accessibilityFriction: number;
  };
  findings: SimulationFinding[];
  usedModel: boolean;
};

type PageFacts = {
  title: string;
  buttons: string[];
  links: string[];
  inputs: string[];
  headings: string[];
  textSample: string;
  anchors: ElementAnchor[];
  interaction: InteractionFacts;
};

type ElementAnchor = {
  role: "button" | "input" | "link" | "heading" | "text";
  label: string;
  x: number;
  y: number;
};

type InteractionFacts = {
  buttonLabels: string[];
  ambiguousActions: string[];
  highImpactActions: string[];
  competingActionCount: number;
  repeatedActionLabels: string[];
  stressRisk: "low" | "medium" | "high";
  focusRisk: "low" | "medium" | "high";
  note: string;
};

export type SimulationRequest = {
  targetUrl: string;
  scenario: AnalysisScenario;
  personas?: PersonaInput[];
  dialSettings?: DialSettings;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length ? text : fallback;
}

function coordinateToPercent(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return clampScore(value);
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return clampScore(parsed);
  const lower = value.toLowerCase();
  if (lower.includes("left") || lower.includes("top")) return 22;
  if (lower.includes("center") || lower.includes("middle")) return 50;
  if (lower.includes("right") || lower.includes("bottom")) return 78;
  return fallback;
}

function normalizeSeverity(value: unknown): SimulationFinding["severity"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeEmotion(value: unknown): SimulationFinding["emotion"] {
  if (
    value === "confused" ||
    value === "anxious" ||
    value === "frustrated" ||
    value === "mistrustful" ||
    value === "curious"
  ) {
    return value;
  }
  if (value === "overwhelmed" || value === "annoyed") return "frustrated";
  if (value === "skeptical" || value === "suspicious") return "mistrustful";
  return "confused";
}

function normalizeFinding(finding: Partial<SimulationFinding>, index: number): SimulationFinding {
  return {
    persona: cleanText(finding.persona, `Synthetic persona ${index + 1}`),
    severity: normalizeSeverity(finding.severity),
    theme: cleanText(finding.theme, "Behavioral risk"),
    evidence: cleanText(
      finding.evidence,
      "The page contains a behavioral signal that may reduce comprehension, trust, or completion."
    ),
    recommendation: cleanText(
      finding.recommendation,
      "Clarify the primary action, reduce ambiguity, and simplify the decision point."
    ),
    x: coordinateToPercent(finding.x, 35 + index * 7),
    y: coordinateToPercent(finding.y, 38 + index * 5),
    emotion: normalizeEmotion(finding.emotion)
  };
}

function keywordScore(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

function textTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function anchorIntent(finding: SimulationFinding) {
  const text = `${finding.theme} ${finding.evidence} ${finding.recommendation}`.toLowerCase();
  const wantsLiteralAction = /literal-language|generic continue|vague/.test(text);
  const wantsPolicy = /policy|refund|authorization|support|boundary|irreversible|permission/.test(text);
  const wantsBilling =
    !wantsLiteralAction && !wantsPolicy && /billing|charge|subscription|renewal|price|payment|pay|cost|card/.test(text);
  return {
    wantsForm: !wantsBilling && /form|field|input|card|email|company|control/.test(text),
    wantsBilling,
    wantsAction: wantsLiteralAction || /action|button|continue|submit|confirm|start|trial|choice|path/.test(text),
    wantsPolicy,
    wantsDensity: /overload|density|clutter|competing|hierarchy|simultaneous|decision fatigue/.test(text),
    wantsAccessibility: /keyboard|focus|screen reader|contrast|accessibility|tab/.test(text)
  };
}

function anchorFindings(findings: SimulationFinding[], facts: PageFacts) {
  if (!facts.anchors.length) return findings;

  const used = new Set<number>();

  return findings.map((finding) => {
    const findingTokens = textTokens(`${finding.theme} ${finding.evidence} ${finding.recommendation}`);
    const intent = anchorIntent(finding);
    let bestIndex = -1;
    let bestScore = -Infinity;

    facts.anchors.forEach((anchor, anchorIndex) => {
      const anchorTokens = textTokens(anchor.label);
      let score = 0;

      findingTokens.forEach((token) => {
        if (anchorTokens.has(token)) score += 3;
      });

      if (intent.wantsForm && anchor.role === "input") score += 32;
      if (intent.wantsBilling && /billing|trial|renewal|payment|pay|card|cost|charge|subscription/.test(anchor.label.toLowerCase())) {
        score += anchor.role === "text" || anchor.role === "heading" ? 24 : 14;
        if (anchor.x > 55) score += 12;
      }
      if (intent.wantsAction && !intent.wantsForm && anchor.role === "button") score += 12;
      if (intent.wantsPolicy && /policy|refund|support|cancel|authorization|confirm|activate|permission/.test(anchor.label.toLowerCase())) {
        score += anchor.role === "text" || anchor.role === "heading" ? 22 : 12;
        if (anchor.x > 55) score += 10;
      }
      if (intent.wantsDensity && (anchor.role === "button" || anchor.role === "heading" || anchor.role === "text")) score += 6;
      if (intent.wantsAccessibility && (anchor.role === "input" || /focus|keyboard|tab|contrast/.test(anchor.label.toLowerCase()))) score += 14;
      if (anchor.role === "heading" && /review|confirm|checkout|complete|security|access/.test(anchor.label.toLowerCase())) score += 4;
      if (used.has(anchorIndex)) score -= 4;

      const distance = Math.hypot(anchor.x - finding.x, anchor.y - finding.y);
      score -= distance / 20;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = anchorIndex;
      }
    });

    if (bestIndex < 0 || bestScore < 1) return finding;
    used.add(bestIndex);
    const anchor = facts.anchors[bestIndex];

    return {
      ...finding,
      x: anchor.x,
      y: anchor.y
    };
  });
}

async function capturePage(targetUrl: string): Promise<{ screenshot: string; facts: PageFacts }> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1
  });
  const timeout = Number(process.env.PLAYWRIGHT_TIMEOUT_MS ?? 20000);

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("timeout")) {
      await browser.close();
      throw error;
    }
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout });
  }

  const facts = await page.evaluate(() => {
    const visibleText = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();

    const labelForInput = (input: Element) => {
      const element = input as HTMLInputElement;
      const explicitLabel = element.id
        ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent
        : "";
      const parentLabel = element.closest("label")?.textContent;
      return (
        explicitLabel ||
        parentLabel ||
        element.placeholder ||
        element.name ||
        element.id ||
        element.type ||
        "Input field"
      )
        .replace(/\s+/g, " ")
        .trim();
    };

    const take = (selector: string, limit = 30) =>
      Array.from(document.querySelectorAll(selector))
        .map((element) => visibleText(element))
        .filter(Boolean)
        .slice(0, limit);

    const buttons = take("button, [role='button'], input[type='submit']");
    const links = take("a");
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
      .map((input) => {
        const element = input as HTMLInputElement;
        return labelForInput(element);
      })
      .filter(Boolean)
      .slice(0, 30);
    const headings = take("h1, h2, h3", 16);

    const anchorCandidates = Array.from(
      document.querySelectorAll("button, [role='button'], input, textarea, select, a, h1, h2, h3, label, p, li, dt, dd, strong, small, span")
    );
    const seenAnchors = new Set<string>();
    const anchors: ElementAnchor[] = anchorCandidates
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8 || rect.bottom < 0 || rect.right < 0) return null;
        if (rect.top > window.innerHeight || rect.left > window.innerWidth) return null;
        const style = window.getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return null;

        const tagName = element.tagName.toLowerCase();
        const role: ElementAnchor["role"] =
          tagName === "button" || element.getAttribute("role") === "button" || (element as HTMLInputElement).type === "submit"
            ? "button"
            : tagName === "input" || tagName === "textarea" || tagName === "select"
              ? "input"
              : tagName === "a"
                ? "link"
                : /^h[1-3]$/.test(tagName)
                  ? "heading"
                  : "text";
        const label = role === "input" ? labelForInput(element) : visibleText(element);
        if (!label || label.length < 3) return null;
        const normalizedLabel = label.slice(0, 140);
        const x = Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 100);
        const y = Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 100);
        const key = `${role}:${normalizedLabel.toLowerCase()}:${x}:${y}`;
        if (seenAnchors.has(key)) return null;
        seenAnchors.add(key);
        return {
          role,
          label: normalizedLabel,
          x: Math.max(3, Math.min(97, x)),
          y: Math.max(3, Math.min(97, y))
        };
      })
      .filter((anchor): anchor is ElementAnchor => Boolean(anchor))
      .slice(0, 80);

    const repeatedLabels = (labels: string[]) => {
      const counts = new Map<string, number>();
      labels.forEach((label) => {
        const normalized = label.toLowerCase().trim();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
      return Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([label]) => label);
    };

    const ambiguousActions = buttons.filter((label) => /continue|next|submit|ok|confirm|proceed/i.test(label));
    const highImpactActions = buttons.filter((label) =>
      /pay|purchase|activate|confirm|delete|cancel|subscribe|start trial|checkout|submit|upgrade/i.test(label)
    );
    const focusRiskButtons = buttons.filter((label) => /modal|menu|close|dismiss|skip|back|next/i.test(label));

    let stressRisk: "low" | "medium" | "high" = "low";
    if (highImpactActions.length > 0 && (ambiguousActions.length > 0 || buttons.length > 3 || inputs.length > 2)) {
      stressRisk = "high";
    } else if (buttons.length > 3 || ambiguousActions.length > 0) {
      stressRisk = "medium";
    }

    let focusRisk: "low" | "medium" | "high" = "low";
    if (focusRiskButtons.length > 3 || inputs.length > 4) {
      focusRisk = "high";
    } else if (focusRiskButtons.length > 0 || inputs.length > 2) {
      focusRisk = "medium";
    }

    return {
      title: document.title,
      buttons,
      links,
      inputs,
      headings,
      anchors,
      textSample: visibleText(document.body).slice(0, 2600),
      interaction: {
        buttonLabels: buttons,
        ambiguousActions,
        highImpactActions,
        competingActionCount: buttons.length,
        repeatedActionLabels: repeatedLabels(buttons),
        stressRisk,
        focusRisk,
        note:
          "Interaction scan is non-destructive: Probelayer inspects copy, layout pressure, and action labels without clicking real purchase, submit, or destructive controls."
      }
    };
  });

  const screenshotBuffer = await page.screenshot({ fullPage: false, type: "png" });
  await browser.close();

  return {
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
    facts
  };
}

function personaFromTags(persona: Persona) {
  return `${persona.name} | ${persona.lens} | goal:${persona.goal} | risks:${persona.riskBias}`;
}

function buildFallbackFinding(persona: Persona, facts: PageFacts, scenario: AnalysisScenario, index: number): SimulationFinding {
  const text = `${facts.title} ${facts.headings.join(" ")} ${facts.buttons.join(" ")} ${facts.links.join(" ")} ${facts.inputs.join(" ")} ${facts.textSample}`;
  const hasPriceOrPayment = keywordScore(text, ["pay", "price", "checkout", "card", "subscription", "billing", "charge"]);
  const hasRefundOrPolicy = keywordScore(text, ["refund", "policy", "cancel", "renewal", "support", "terms", "authorization"]);
  const hasVagueContinue = facts.buttons.some((label) => /continue|next|submit|proceed/i.test(label));
  const dense = facts.textSample.length > 1200 || facts.buttons.length + facts.links.length > 22;
  const manyInputs = facts.inputs.length > 3;

  if (scenario === "pen-test" || persona.penTest) {
    return {
      persona: persona.name,
      severity: hasPriceOrPayment || hasRefundOrPolicy ? "high" : "medium",
      theme: "Defensive boundary probing",
      evidence: hasPriceOrPayment || hasRefundOrPolicy
        ? "The flow exposes billing, authorization, or support language that should be checked for misuse and unclear boundaries."
        : "The flow has enough decision surfaces to validate abuse resistance, repeated submissions, and boundary clarity.",
      recommendation:
        "Harden confirmation steps, make irreversible actions explicit, add clear policy language, and validate repeated-action resilience.",
      x: 74,
      y: 42,
      emotion: "mistrustful" as const
    };
  }

  if (persona.tags.includes("accessibility") && persona.tags.includes("keyboard")) {
    return {
      persona: persona.name,
      severity: facts.interaction.focusRisk === "high" ? "high" : "medium",
      theme: "Keyboard flow friction",
      evidence: `Detected ${facts.inputs.length} inputs and ${facts.interaction.competingActionCount} visible actions. This can become fragile without visible focus and predictable tab order.`,
      recommendation: "Verify focus states, preserve tab order, and reduce simultaneous actions in the first viewport.",
      x: 54,
      y: 64,
      emotion: "confused" as const
    };
  }

  if (persona.tags.includes("cognitive-load") || scenario === "cognitive") {
    return {
      persona: persona.name,
      severity: dense || manyInputs || hasVagueContinue ? "high" : "medium",
      theme: "Decision fatigue risk",
      evidence: `The first viewport contains ${facts.buttons.length} buttons, ${facts.links.length} links, and ${facts.inputs.length} inputs, which can overwhelm a user who needs structure.`,
      recommendation: "Collapse secondary actions, create clearer hierarchy, and reduce the number of simultaneous decisions.",
      x: 58,
      y: 52,
      emotion: "frustrated"
    };
  }

  if (persona.tags.includes("mobile") || scenario === "mobile") {
    return {
      persona: persona.name,
      severity: facts.buttons.length > 3 || manyInputs ? "high" : "medium",
      theme: "Thumb-target and scroll pressure",
      evidence: "Mobile users need stable spacing, readable copy, and a single obvious next step.",
      recommendation: "Increase tap target size, reduce clutter, and keep the primary action in one visually dominant spot.",
      x: 45,
      y: 69,
      emotion: "frustrated" as const
    };
  }

  if (persona.id === "visual-overload") {
    return {
      persona: persona.name,
      severity: dense || facts.buttons.length > 2 ? "high" : "medium",
      theme: "Cognitive overload",
      evidence: `Detected ${facts.buttons.length} buttons, ${facts.links.length} links, ${facts.inputs.length} inputs, and ${facts.headings.length} headings in the first viewport.`,
      recommendation: "Reduce simultaneous options, keep one primary action dominant, and strengthen visual hierarchy.",
      x: 57,
      y: 52,
      emotion: "confused" as const
    };
  }

  if (persona.id === "non-native-speaker") {
    return {
      persona: persona.name,
      severity: hasVagueContinue ? "high" : "medium",
      theme: "Literal-language ambiguity",
      evidence: hasVagueContinue
        ? "A generic Continue action does not say whether it saves, charges, submits, or advances to review."
        : "Important decision copy may require careful interpretation rather than plain outcome-oriented labels.",
      recommendation: "Use concrete verbs such as Review billing, Start trial, Save draft, or Confirm subscription.",
      x: 52,
      y: 66,
      emotion: "confused" as const
    };
  }

  if (persona.id === "older-adult") {
    return {
      persona: persona.name,
      severity: manyInputs || hasVagueContinue ? "high" : "medium",
      theme: "Form confidence risk",
      evidence: `The first viewport contains ${facts.inputs.length} form controls and action labels including ${facts.buttons.join(", ") || "no buttons"}.`,
      recommendation: "Add inline helper text, mark optional fields, and make the next step unmistakable.",
      x: 50,
      y: 43,
      emotion: "confused" as const
    };
  }

  if (persona.id === "distracted-parent") {
    return {
      persona: persona.name,
      severity: hasPriceOrPayment ? "high" : "medium",
      theme: "Surprise charge anxiety",
      evidence: hasPriceOrPayment
        ? "Billing, card, subscription, or renewal language appears while the user is trying to scan quickly."
        : "The flow asks for commitment before cost and consequence language is easy to compare.",
      recommendation: "Place total cost, renewal timing, and cancellation terms directly beside the primary confirmation action.",
      x: 79,
      y: 40,
      emotion: "anxious" as const
    };
  }

  if (persona.id === "impatient-shopper") {
    return {
      persona: persona.name,
      severity: facts.buttons.length > 2 ? "high" : "medium",
      theme: "Competing next actions",
      evidence: `Detected ${facts.buttons.length} buttons in the first viewport. Multiple similarly weighted choices slow a user who wants one obvious path.`,
      recommendation: "Make one primary action dominant, demote secondary paths, and move help or marketing options away from the critical step.",
      x: 44,
      y: 66,
      emotion: "frustrated" as const
    };
  }

  if (persona.id === "enterprise-buyer") {
    return {
      persona: persona.name,
      severity: hasRefundOrPolicy || keywordScore(text, ["security", "compliance", "permissions", "audit", "admin"]) > 0 ? "medium" : "low",
      theme: "Governance trust check",
      evidence: "Enterprise buyers scan for auditability, data-handling clarity, and role boundaries before they trust the product.",
      recommendation: "Surface policy language, permissions boundaries, and administrative control points near the decision step.",
      x: 73,
      y: 45,
      emotion: "mistrustful" as const
    };
  }

  if (persona.id === "neurodivergent") {
    return {
      persona: persona.name,
      severity: dense || manyInputs || facts.interaction.ambiguousActions.length > 0 ? "high" : "medium",
      theme: "Executive-function strain",
      evidence: `This page shows ${facts.buttons.length} actions and ${facts.inputs.length} inputs at once, which increases task-switching burden.`,
      recommendation: "Reduce simultaneous choices, simplify the sequence, and keep the primary action unambiguous in the first viewport.",
      x: 56,
      y: 54,
      emotion: "frustrated"
    };
  }

  if (persona.id === "keyboard-only") {
    return {
      persona: persona.name,
      severity: facts.interaction.focusRisk === "high" ? "high" : "medium",
      theme: "Focus order risk",
      evidence: `Keyboard-only users need a predictable tab sequence, visible focus, and no hidden modal traps. The current action density suggests testing those paths carefully.`,
      recommendation: "Verify visible focus, logical tab order, and escape behavior for dialogs or overlays.",
      x: 60,
      y: 64,
      emotion: "confused" as const
    };
  }

  return {
    persona: persona.name,
    severity: "medium" as const,
    theme: "Flow confidence risk",
    evidence: `${persona.name} is likely to scan for reassurance around ${persona.riskBias}.`,
    recommendation: "Add plain-language helper text near the decision point and preserve visible progress through the flow.",
    x: 44 + index * 4,
    y: 48 + (index % 3) * 6,
    emotion: persona.trust < 45 ? ("mistrustful" as const) : ("curious" as const)
  };
}

function fallbackFindings(facts: PageFacts, selectedPersonas: Persona[], scenario: AnalysisScenario): SimulationFinding[] {
  return selectedPersonas.slice(0, 10).map((persona, index) => buildFallbackFinding(persona, facts, scenario, index));
}

function fallbackSummary(facts: PageFacts, findings: SimulationFinding[]) {
  const high = findings.filter((finding) => finding.severity === "high").length;
  return `Probelayer found ${findings.length} behavioral risk signals in the first-pass analysis. ${high} are high severity. The strongest risks cluster around ${[
    ...new Set(findings.map((finding) => finding.theme.toLowerCase()))
  ]
    .slice(0, 3)
    .join(", ")}.`;
}

async function modelFindings({
  targetUrl,
  screenshot,
  facts,
  selectedPersonas,
  scenario
}: {
  targetUrl: string;
  screenshot: string;
  facts: PageFacts;
  selectedPersonas: Persona[];
  scenario: AnalysisScenario;
}) {
  const model = process.env.VISION_MODEL ?? "gemini-3.5-flash";
  const content = await callOpenAICompatibleChat({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are Probelayer, a behavioral failure simulation engine. Return valid JSON only. Identify UX, trust, accessibility, overload, and defensive abuse risks from a screenshot and extracted DOM facts."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              targetUrl,
              scenario,
              personas: selectedPersonas.map((persona) => ({
                name: persona.name,
                lens: persona.lens,
                goal: persona.goal,
                riskBias: persona.riskBias,
                patience: persona.patience,
                trust: persona.trust,
                accessibility: persona.accessibility,
                tone: persona.tone,
                penTest: persona.penTest,
                tags: persona.tags
              })),
              pageFacts: facts,
              schema: {
                summary: "string",
                findings: [
                  {
                    persona: "string",
                    severity: "low|medium|high",
                    theme: "string",
                    evidence: "string",
                    recommendation: "string",
                    x: "number from 0 to 100, where 0 is left and 100 is right",
                    y: "number from 0 to 100, where 0 is top and 100 is bottom",
                    emotion: "confused|anxious|frustrated|mistrustful|curious"
                  }
                ]
              },
              rules: [
                "Return exactly one JSON object with summary and findings.",
                "Return 4 to 10 findings.",
                "Use numeric x and y percentages, not words.",
                "Use only the allowed severity and emotion enum values.",
                "Prefer concrete, actionable evidence and recommendations.",
                "If the scenario is pen-test, emphasize defensive boundary risks."
              ]
            })
          },
          { type: "image_url", image_url: { url: screenshot } }
        ]
      }
    ]
  });

  if (!content) return null;
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) return null;

  const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
    summary?: string;
    findings?: Array<Partial<SimulationFinding>>;
  };

  return {
    summary: parsed.summary ?? "",
    findings: (parsed.findings ?? []).map((finding, index) => normalizeFinding(finding, index))
  };
}

function scenarioFromPersonas(scenario: AnalysisScenario) {
  return scenario;
}

function scoreWithDials(base: number, dialSettings?: DialSettings, adjustments?: { designVariance?: number; motionIntensity?: number; visualDensity?: number }) {
  const dialVariance = dialSettings?.designVariance ?? 9;
  const dialMotion = dialSettings?.motionIntensity ?? 9;
  const dialDensity = dialSettings?.visualDensity ?? 4;
  return clampScore(
    base +
      (adjustments?.designVariance ?? 0) * (dialVariance / 10) +
      (adjustments?.motionIntensity ?? 0) * (dialMotion / 10) +
      (adjustments?.visualDensity ?? 0) * (dialDensity / 10)
  );
}

export async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  const scenario = scenarioFromPersonas(request.scenario);
  const selectedPersonas = request.personas?.length
    ? request.personas.map((input, index) => normalizePersona(input, index))
    : selectDefaultPersonas(scenario);

  const personasForRun = selectedPersonas.length ? selectedPersonas : defaultPersonas;
  const { screenshot, facts } = await capturePage(request.targetUrl);

  let usedModel = false;
  let findings = fallbackFindings(facts, personasForRun, scenario);
  let summary = fallbackSummary(facts, findings);

  try {
    const modeled = await modelFindings({
      targetUrl: request.targetUrl,
      screenshot,
      facts,
      selectedPersonas: personasForRun,
      scenario
    });

    if (modeled?.findings?.length) {
      usedModel = true;
      findings = modeled.findings.slice(0, 10);
      summary = modeled.summary || summary;
    }
  } catch (error) {
    console.warn("Falling back to heuristic simulation", error);
  }

  findings = anchorFindings(findings, facts);

  const dialSettings = request.dialSettings ?? {
    designVariance: 9,
    motionIntensity: 9,
    visualDensity: 4
  };

  const high = findings.filter((finding) => finding.severity === "high").length;
  const medium = findings.filter((finding) => finding.severity === "medium").length;
  const text = `${facts.textSample} ${facts.buttons.join(" ")} ${facts.inputs.join(" ")}`;
  const securitySignals = keywordScore(text, ["refund", "promo", "support", "admin", "invite", "permission", "policy", "authorization"]);
  const accessibilitySignals = keywordScore(text, ["focus", "keyboard", "contrast", "aria", "screen reader", "tab"]);

  return {
    targetUrl: request.targetUrl,
    scenario,
    screenshot,
    analysisMode: usedModel ? "model" : "heuristic",
    pageFacts: {
      buttonCount: facts.buttons.length,
      linkCount: facts.links.length,
      inputCount: facts.inputs.length,
      headingCount: facts.headings.length,
      analysisInputs: [
        "Playwright screenshot",
        "DOM text",
        "Button labels",
        "Form/input fields",
        "Headings and links",
        scenario === "pen-test"
          ? "Defensive abuse heuristics"
          : scenario === "cognitive"
            ? "Cognitive-load heuristics"
            : scenario === "mobile"
              ? "Mobile interaction heuristics"
              : "Mixed persona heuristics",
        usedModel ? "Gemini 3.5 Flash multimodal reasoning" : "Heuristic fallback rules"
      ],
      interaction: facts.interaction
    },
    summary,
    scores: {
      confusion: scoreWithDials(32 + medium * 7 + high * 12, dialSettings, { designVariance: 2, motionIntensity: 1, visualDensity: 3 }),
      trustRisk: scoreWithDials(24 + keywordScore(text, ["pay", "card", "refund", "confirm", "subscription", "security"]) * 11 + high * 8, dialSettings, {
        designVariance: 1,
        motionIntensity: 0
      }),
      abandonment: scoreWithDials(20 + facts.inputs.length * 5 + facts.buttons.length * 2 + facts.interaction.ambiguousActions.length * 7, dialSettings, {
        designVariance: 1,
        visualDensity: 2
      }),
      exploitability: scoreWithDials(
        18 + securitySignals * 14 + facts.interaction.highImpactActions.length * 8 + (scenario === "pen-test" ? 10 : 0),
        dialSettings,
        { motionIntensity: 1 }
      ),
      visualOverload: scoreWithDials(
        18 +
          facts.buttons.length * 3 +
          facts.links.length * 2 +
          Math.floor(facts.textSample.length / 120) +
          (facts.interaction.stressRisk === "high" ? 10 : 0),
        dialSettings,
        { visualDensity: 4 }
      ),
      accessibilityFriction: scoreWithDials(
        20 +
          facts.inputs.length * 4 +
          facts.buttons.length * 2 +
          (facts.interaction.focusRisk === "high" ? 12 : facts.interaction.focusRisk === "medium" ? 6 : 0) +
          accessibilitySignals * 10,
        dialSettings,
        { visualDensity: 2 }
      )
    },
    findings,
    usedModel
  };
}

export function getDefaultSimulationPersonas() {
  return defaultPersonas;
}
