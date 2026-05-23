import { defaultPersonas, normalizePersona, selectDefaultPersonas, stressPersonas, type Persona, type PersonaInput } from "./personas";
import {
  analyzeCapturedPage,
  capturePage,
  getPentestProfile,
  type AnalysisScenario,
  type DialSettings,
  type PentestLevel,
  type SimulationFinding,
  type SimulationResult
} from "./simulation";

export type SupervisorWing = "ux" | "red-team";

export type SupervisorWingResult = SimulationResult & {
  wing: SupervisorWing;
  title: string;
  durationHint: string;
  personaCount: number;
  pentestLevel?: PentestLevel;
  personas: Persona[];
};

export type SupervisorFinding = SimulationFinding & {
  wing: SupervisorWing;
};

export type SupervisorRequest = {
  targetUrl: string;
  scenario: AnalysisScenario;
  personas?: PersonaInput[];
  dialSettings?: DialSettings;
  redTeamLevel?: PentestLevel;
};

export type SupervisorResult = {
  targetUrl: string;
  scenario: AnalysisScenario;
  redTeamLevel: PentestLevel;
  screenshot?: string;
  analysisMode: "heuristic" | "model";
  pageFacts: SimulationResult["pageFacts"];
  summary: string;
  scores: SimulationResult["scores"];
  findings: SupervisorFinding[];
  usedModel: boolean;
  wings: {
    ux: SupervisorWingResult;
    redTeam: SupervisorWingResult;
  };
};

function dedupePersonas(personas: Persona[]) {
  const seen = new Set<string>();
  return personas.filter((persona) => {
    const key = persona.id.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePersonaList(personas?: PersonaInput[]) {
  return (personas ?? []).map((persona, index) => normalizePersona(persona, index));
}

function splitPersonas(personas: Persona[]) {
  const ux = personas.filter((persona) => !persona.penTest);
  const redTeam = personas.filter((persona) => persona.penTest);
  return { ux, redTeam };
}

function mergeScores(ux: SimulationResult["scores"], redTeam: SimulationResult["scores"]): SimulationResult["scores"] {
  const average = (left: number, right: number) => Math.round((left + right) / 2);
  return {
    confusion: average(ux.confusion, redTeam.confusion),
    trustRisk: average(ux.trustRisk, redTeam.trustRisk),
    abandonment: average(ux.abandonment, redTeam.abandonment),
    exploitability: average(ux.exploitability, redTeam.exploitability),
    visualOverload: average(ux.visualOverload, redTeam.visualOverload),
    accessibilityFriction: average(ux.accessibilityFriction, redTeam.accessibilityFriction)
  };
}

function mergeFindings(ux: SupervisorWingResult, redTeam: SupervisorWingResult): SupervisorFinding[] {
  return [
    ...ux.findings.map((finding) => ({ ...finding, wing: "ux" as const })),
    ...redTeam.findings.map((finding) => ({ ...finding, wing: "red-team" as const }))
  ].sort((left, right) => {
    const severityWeight = { high: 3, medium: 2, low: 1 } as const;
    const diff = severityWeight[right.severity] - severityWeight[left.severity];
    if (diff !== 0) return diff;
    return right.x - left.x;
  });
}

function summarizeWings(ux: SupervisorWingResult, redTeam: SupervisorWingResult) {
  const redLevel = redTeam.pentestLevel ? ` The red-team lane ran at ${getPentestProfile(redTeam.pentestLevel).label.toLowerCase()} depth.` : "";
  return [
    `Supervisor completed ${ux.findings.length} UX findings and ${redTeam.findings.length} red-team findings in parallel.`,
    `UX focused on clarity, trust, overload, and accessibility.`,
    `Red team focused on abuse, bypasses, repeated submits, and weak boundaries.${redLevel}`
  ].join(" ");
}

export async function runSupervisorSimulation(request: SupervisorRequest): Promise<SupervisorResult> {
  const normalized = normalizePersonaList(request.personas);
  const selectedPersonas = normalized.length ? normalized : defaultPersonas;
  const { ux, redTeam } = splitPersonas(selectedPersonas);

  const uxPersonas = dedupePersonas(ux.length ? ux : defaultPersonas.filter((persona) => !persona.penTest));
  const defaultRedTeam = dedupePersonas([
    ...selectDefaultPersonas("pen-test"),
    ...stressPersonas
  ]);
  const redTeamPersonas = dedupePersonas([
    ...defaultRedTeam,
    ...(redTeam.length ? redTeam : [])
  ]);

  const { screenshot, facts } = await capturePage(request.targetUrl);
  const redTeamLevel = request.redTeamLevel ?? "quick";

  const [uxResult, redResult] = await Promise.all([
    analyzeCapturedPage({
      targetUrl: request.targetUrl,
      scenario: request.scenario,
      screenshot,
      facts,
      personas: uxPersonas.map((persona) => ({
        id: persona.id,
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
      dialSettings: request.dialSettings,
      suite: "ux"
    }),
    analyzeCapturedPage({
      targetUrl: request.targetUrl,
      scenario: "pen-test",
      screenshot,
      facts,
      personas: redTeamPersonas.map((persona) => ({
        id: persona.id,
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
      dialSettings: request.dialSettings,
      suite: "red-team",
      pentestLevel: redTeamLevel
    })
  ]);

  const uxWing: SupervisorWingResult = {
    ...uxResult,
    wing: "ux",
    title: "UX Suite",
    durationHint: "fast first-pass coverage",
    personaCount: uxPersonas.length,
    personas: uxPersonas
  };

  const redWing: SupervisorWingResult = {
    ...redResult,
    wing: "red-team",
    title: "Red Team Suite",
    durationHint: getPentestProfile(redTeamLevel).durationHint,
    personaCount: redTeamPersonas.length,
    pentestLevel: redTeamLevel,
    personas: redTeamPersonas
  };

  const findings = mergeFindings(uxWing, redWing);
  const scores = mergeScores(uxWing.scores, redWing.scores);
  const usedModel = uxWing.usedModel || redWing.usedModel;

  return {
    targetUrl: request.targetUrl,
    scenario: request.scenario,
    redTeamLevel,
    screenshot,
    analysisMode: usedModel ? "model" : "heuristic",
    pageFacts: uxWing.pageFacts,
    summary: summarizeWings(uxWing, redWing),
    scores,
    findings,
    usedModel,
    wings: {
      ux: uxWing,
      redTeam: redWing
    }
  };
}
