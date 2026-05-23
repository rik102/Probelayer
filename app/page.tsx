"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { defaultPersonas, stressPersonas, type Persona, type PersonaInput, normalizePersona } from "@/lib/personas";
import { type AnalysisScenario, type DialSettings, type PentestLevel } from "@/lib/simulation";
import { suggestPersonaPack, type PersonaSuggestion } from "@/lib/persona-assistant";
import type { SupervisorFinding, SupervisorResult } from "@/lib/supervisor";

gsap.registerPlugin(ScrollTrigger);

const defaultDialSettings: DialSettings = {
  designVariance: 9,
  motionIntensity: 9,
  visualDensity: 4
};

const defaultCustomDraft = {
  id: "",
  name: "",
  lens: "",
  goal: "",
  riskBias: "",
  patience: "45",
  trust: "50",
  accessibility: "",
  tone: "",
  penTest: false,
  tags: "custom"
};

type CustomDraft = typeof defaultCustomDraft;
type WorkspaceTab = "dashboard" | "github" | "assistant";
type GitHubRepoSummary = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  updatedAt: string;
};
type SupervisorFindingCard = SupervisorFinding & {
  wingLabel: string;
};

function resolveTargetUrl(value: string) {
  return new URL(value, window.location.origin).toString();
}

function joinTags(tags: string[]) {
  return tags.length ? tags.join(" · ") : "custom";
}

function mergePersona(base: Persona | PersonaInput, override?: PersonaInput, index = 0) {
  return normalizePersona({ ...base, ...override, id: base.id }, index);
}

function cloneCountLabel(count: number) {
  if (count <= 0) return "0";
  if (count === 1) return "1 copy";
  return `${count} copies`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseBoundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const raw = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(raw)) return fallback;
  return clampNumber(Math.round(raw), min, max);
}

function boundedRangeError(label: string, value: unknown, min: number, max: number) {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return `${label} must be a number between ${min} and ${max}.`;
  if (numeric < min || numeric > max) return `${label} must stay between ${min} and ${max}.`;
  return "";
}

function shortSentence(value: string, maxLength = 118) {
  const sentence = value.split(/[.!?]/)[0].replace(/\s+/g, " ").trim();
  if (!sentence.length) return value.slice(0, maxLength);
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trim()}…` : sentence;
}

function simplifyFindingTheme(value: string) {
  const text = value.toLowerCase();
  if (/validation|bypass|input|form|submit/.test(text)) return "Form bypass";
  if (/payment|billing|charge|subscription|price|cost|financial/.test(text)) return "Hidden cost";
  if (/policy|audit|authorization|permission|access|control|role/.test(text)) return "Access loophole";
  if (/keyboard|focus|contrast|aria|screen reader|accessibility/.test(text)) return "Accessibility issue";
  if (/trust|confidence|skeptical|mistrust/.test(text)) return "Trust issue";
  if (/density|clutter|crowded|overload|competing|hierarchy/.test(text)) return "Too much on screen";
  if (/button|repeat|retry|double|loading|race|duplicate/.test(text)) return "Repeated action risk";
  if (/refund|support|cancel|renewal|policy/.test(text)) return "Policy gap";
  return value.replace(/\s+/g, " ").trim().replace(/\b\w/g, (char) => char.toUpperCase()).slice(0, 40);
}

function simplifyFindingText(value: string, theme: string) {
  const text = shortSentence(value, 132);
  const lower = `${theme} ${text}`.toLowerCase();
  if (/hidden cost/.test(lower)) return text.replace(/audit-log validation dependency loophole/gi, "Cost or policy step is unclear");
  if (/form bypass/.test(lower)) return text.replace(/client-side validation bypass/gi, "Form checks can be bypassed");
  if (/access loophole/.test(lower)) return text.replace(/audit-log validation dependency loophole/gi, "Access or policy rule is too loose");
  if (/too much on screen/.test(lower)) return text.replace(/visual hierarchy/gi, "layout hierarchy");
  if (/trust issue/.test(lower)) return text.replace(/trust/gi, "trust");
  return text;
}

function cleanFindingCopy(value: string, theme: string, fallback: string) {
  const trimmed = simplifyFindingText(value, theme);
  return trimmed.length ? trimmed : fallback;
}

function stripCloneSuffix(value: string) {
  return value.replace(/\s+copy\s+\d+$/i, "").trim();
}

function agentAccentStyle(order?: number, selected = false): CSSProperties {
  if (!selected || !order) {
    return { "--agent-hue": 215 } as CSSProperties;
  }
  const hue = (86 + (order - 1) * 37) % 360;
  return { "--agent-hue": hue } as CSSProperties;
}

function normalizePersonaName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findFindingsForPersona(findings: SupervisorFindingCard[], personaName: string) {
  const normalizedPersona = normalizePersonaName(stripCloneSuffix(personaName));
  return findings.filter((finding) => {
    const normalizedFinding = normalizePersonaName(stripCloneSuffix(finding.persona));
    return (
      normalizedFinding === normalizedPersona ||
      normalizedFinding.includes(normalizedPersona) ||
      normalizedPersona.includes(normalizedFinding)
    );
  });
}

function resolveSelectedOrder(selectedPersonas: Persona[], selectedOrderMap: Map<string, number>, personaName: string) {
  const normalizedPersona = normalizePersonaName(personaName);
  for (const persona of selectedPersonas) {
    const normalizedSelected = normalizePersonaName(persona.name);
    if (
      normalizedSelected === normalizedPersona ||
      normalizedSelected.includes(normalizedPersona) ||
      normalizedPersona.includes(normalizedSelected)
    ) {
      return selectedOrderMap.get(persona.id) ?? 0;
    }
  }
  return 0;
}

function arrayToggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function makePersonaId(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `custom-persona-${Date.now()}`
  );
}

function buildPersonaInput(persona: Persona | PersonaInput): PersonaInput {
  return {
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
  };
}

function CoverageCard({
  uxSelectedCount,
  redTeamSelectedCount,
  customCount,
  scenario,
  modelReady,
  redTeamLevel,
  supervisorState
}: {
  uxSelectedCount: number;
  redTeamSelectedCount: number;
  customCount: number;
  scenario: AnalysisScenario;
  modelReady: boolean;
  redTeamLevel: PentestLevel;
  supervisorState: string;
}) {
  return (
    <div className="card-core hero-panel-core coverage-panel">
      <div className="coverage-panel-top">
        <p className="eyebrow">Central supervisor</p>
        <span className="status-pill">{modelReady ? "Model ready" : "Demo ready"}</span>
      </div>
      <div className="coverage-panel-copy">
        <h2>Two wings, one supervisor, compact enough for the top fold.</h2>
        <p>
          The dashboard runs UX and red-team lanes in parallel, then merges them into one readable report
          without losing attribution.
        </p>
        <p className="coverage-focus-copy">{supervisorState}</p>
      </div>
      <div className="coverage-grid">
        <div>
          <span>UX personas</span>
          <strong>{uxSelectedCount}</strong>
        </div>
        <div>
          <span>Red-team personas</span>
          <strong>{redTeamSelectedCount}</strong>
        </div>
        <div>
          <span>Red-team depth</span>
          <strong>{redTeamLevel}</strong>
        </div>
        <div>
          <span>Custom personas</span>
          <strong>{customCount}</strong>
        </div>
        <div>
          <span>Run mode</span>
          <strong>{scenario}</strong>
        </div>
        <div>
          <span>Model route</span>
          <strong>{modelReady ? "Active" : "Ready"}</strong>
        </div>
      </div>
      <div className="coverage-ribbon">
        <span className="coverage-chip is-static">Selection drives the run</span>
        <span className="coverage-chip is-static">No extra focus toggles</span>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  description
}: {
  label: string;
  value: number;
  description: string;
}) {
  const scoreHue = `${Math.max(0, 120 - value * 1.2)}deg`;
  return (
    <article className="score-card" style={{ "--score-hue": scoreHue } as CSSProperties}>
      <div className="score-card-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${Math.max(6, value)}%` }} />
      </div>
      <p>{description}</p>
    </article>
  );
}

function FindingCard({
  finding,
  index,
  agentNumber
}: {
  finding: SupervisorFindingCard;
  index: number;
  agentNumber?: number;
}) {
  const theme = simplifyFindingTheme(finding.theme);
  const evidence = cleanFindingCopy(finding.evidence, theme, "The page needs a simpler decision path.");
  const recommendation = cleanFindingCopy(finding.recommendation, theme, "Make the next step clearer and easier to trust.");
  const orderLabel = agentNumber ? `#${agentNumber}` : `#${index + 1}`;

  return (
    <details className={`finding-card severity-${finding.severity}`} style={agentAccentStyle(agentNumber, Boolean(agentNumber))}>
      <summary className="finding-head">
        <span className="finding-index">{index + 1}</span>
        <div>
          <h3>{theme}</h3>
          <p>
            {orderLabel} · {finding.persona} · {finding.wingLabel}
          </p>
        </div>
        <span className="severity-pill">{finding.severity}</span>
      </summary>
      <div className="finding-body">
        <p className="finding-copy">{evidence}</p>
        <p className="finding-fix">
          <strong>Fix</strong> {recommendation}
        </p>
      </div>
    </details>
  );
}

function PersonaCard({
  persona,
  selected,
  selectedOrder,
  onToggle,
  onEdit,
  onClone,
  onRemove,
  isCustom
}: {
  persona: Persona;
  selected: boolean;
  selectedOrder?: number;
  onToggle: () => void;
  onEdit?: () => void;
  onClone?: () => void;
  onRemove?: () => void;
  isCustom: boolean;
}) {
  const accentStyle = agentAccentStyle(selectedOrder, selected);
  return (
    <button
      className={`persona-card ${selected ? "is-selected" : "is-idle"}`}
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      style={accentStyle}
    >
      <div className="persona-card-top">
        <div>
          <strong>{persona.name}</strong>
          <span>{persona.lens}</span>
        </div>
        <span className={`persona-pill ${selected ? "is-selected" : "is-idle"}`}>
          {selected ? `#${selectedOrder ?? 0}` : "Idle"}
        </span>
      </div>
      <p>{persona.goal}</p>
      <div className="persona-meta">
        <span>{persona.tone}</span>
        <span>{joinTags(persona.tags)}</span>
      </div>
      <div className="persona-meta persona-meta-values">
        <span>Patience {persona.patience}</span>
        <span>Trust {persona.trust}</span>
      </div>
      <div className="persona-actions">
        {onEdit ? (
          <span
            className="persona-link"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </span>
        ) : null}
        {onClone ? (
          <span
            className="persona-link"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClone();
            }}
          >
            Clone
          </span>
        ) : null}
        {isCustom && onRemove ? (
          <span
            className="persona-link danger"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
          >
            Remove
          </span>
        ) : null}
      </div>
    </button>
  );
}

function AgentResultCard({
  persona,
  order,
  wingLabel,
  findings,
  selected
}: {
  persona: Persona;
  order: number;
  wingLabel: string;
  findings: SupervisorFindingCard[];
  selected: boolean;
}) {
  const accentStyle = agentAccentStyle(order, selected);
  const primaryFinding = findings[0];
  const findingLabel = findings.length ? `${findings.length} finding${findings.length === 1 ? "" : "s"}` : "No findings yet";
  const orderLabel = selected ? `#${order}` : "Idle";
  return (
    <details className={`agent-result-card ${selected ? "is-selected" : "is-idle"}`} style={accentStyle}>
      <summary className="agent-result-top">
        <div>
          <span className="agent-result-order">{orderLabel}</span>
          <strong>{persona.name}</strong>
          <p>{wingLabel}</p>
        </div>
        <div className="agent-result-summary-right">
          <span className={`agent-result-state ${selected ? "is-selected" : "is-idle"}`}>
            {selected ? "Selected" : "Idle"}
          </span>
          <span className={`severity-pill ${primaryFinding?.severity ?? "low"}`}>
            {primaryFinding ? primaryFinding.severity : "idle"}
          </span>
        </div>
      </summary>
      <div className="agent-result-body">
        <p className="agent-result-title">
          {primaryFinding ? simplifyFindingTheme(primaryFinding.theme) : "No findings yet"}
        </p>
        <p className="agent-result-copy">
          {primaryFinding
            ? cleanFindingCopy(primaryFinding.evidence, primaryFinding.theme, "The agent did not surface a unique note yet.")
            : "This agent is selected and tracked separately, but no unique finding has been surfaced yet."}
        </p>
        <div className="agent-result-meta">
          <span>{findingLabel}</span>
          <span>{persona.penTest ? "Red-team" : "UX"}</span>
        </div>
        <div className="agent-result-findings">
          {findings.length ? (
            findings.map((finding, findingIndex) => (
              <div className={`agent-finding-row severity-${finding.severity}`} key={`${finding.persona}-${findingIndex}`}>
                <strong>{simplifyFindingTheme(finding.theme)}</strong>
                <p>{cleanFindingCopy(finding.evidence, finding.theme, "The page needs a simpler decision path.")}</p>
              </div>
            ))
          ) : (
            <div className="agent-finding-row muted">
              <strong>Nothing new here yet</strong>
              <p>The agent is still selected, but there is no dedicated finding to show yet.</p>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

function PersonaEditorModal({
  persona,
  draft,
  onChange,
  onSave,
  onDiscard,
  error
}: {
  persona: Persona | null;
  draft: PersonaInput | null;
  onChange: (draft: PersonaInput) => void;
  onSave: () => void;
  onDiscard: () => void;
  error?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!persona) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDiscard();
    };

    document.addEventListener("keydown", keyHandler);

    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { y: 24, opacity: 0, scale: 0.98, filter: "blur(12px)" },
        { y: 0, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.32, ease: "power3.out" }
      );
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyHandler);
    };
  }, [persona]);

  if (!persona || !draft) return null;

  return (
    <div className="persona-modal-backdrop" onMouseDown={onDiscard} role="presentation">
      <div
        className="persona-modal-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-modal-title"
        aria-describedby="persona-modal-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="persona-modal-head">
          <div>
            <p className="eyebrow">Edit persona</p>
            <h3 id="persona-modal-title">{persona.name}</h3>
            <p id="persona-modal-description">
              Update the draft, then save or discard without touching the live persona until you commit.
            </p>
          </div>
          <div className="persona-modal-id">
            <span>ID</span>
            <strong>{persona.id}</strong>
          </div>
        </div>

        <div className="persona-modal-grid">
          <label className="field">
            <span>Name</span>
            <input value={draft.name ?? ""} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Behavioral lens</span>
            <input value={draft.lens ?? ""} onChange={(event) => onChange({ ...draft, lens: event.target.value })} />
          </label>
          <label className="field wide">
            <span>Primary goal</span>
            <input value={draft.goal ?? ""} onChange={(event) => onChange({ ...draft, goal: event.target.value })} />
          </label>
          <label className="field wide">
            <span>Risk biases</span>
            <input
              value={draft.riskBias ?? ""}
              onChange={(event) => onChange({ ...draft, riskBias: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Patience</span>
            <input
              type="number"
              min="1"
              max="100"
              value={draft.patience ?? 45}
              onChange={(event) =>
                onChange({
                  ...draft,
                  patience: parseBoundedNumber(event.target.value, 45, 1, 100)
                })
              }
            />
            <small className="field-hint">Range 1-100</small>
          </label>
          <label className="field">
            <span>Trust</span>
            <input
              type="number"
              min="1"
              max="100"
              value={draft.trust ?? 50}
              onChange={(event) =>
                onChange({
                  ...draft,
                  trust: parseBoundedNumber(event.target.value, 50, 1, 100)
                })
              }
            />
            <small className="field-hint">Range 1-100</small>
          </label>
          <label className="field wide">
            <span>Accessibility needs</span>
            <input
              value={draft.accessibility ?? ""}
              onChange={(event) => onChange({ ...draft, accessibility: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Tone</span>
            <input value={draft.tone ?? ""} onChange={(event) => onChange({ ...draft, tone: event.target.value })} />
          </label>
          <label className="field">
            <span>Tags</span>
            <input
              value={Array.isArray(draft.tags) ? draft.tags.join(", ") : ""}
              onChange={(event) =>
                onChange({
                  ...draft,
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                })
              }
            />
          </label>
        </div>

        <label className="checkbox-row modal-checkbox">
          <input
            type="checkbox"
            checked={Boolean(draft.penTest)}
            onChange={(event) => onChange({ ...draft, penTest: event.target.checked })}
          />
          <span>Pen-test persona</span>
        </label>

        <div className="modal-actions">
          <button className="button-secondary" type="button" onClick={onDiscard}>
            Discard changes
          </button>
          <button className="button-primary" type="button" onClick={onSave}>
            Save changes
            <span>→</span>
          </button>
        </div>
        {error ? <p className="error-banner">{error}</p> : null}
      </div>
    </div>
  );
}

function ClonePersonaModal({
  persona,
  count,
  onChangeCount,
  onSave,
  onDiscard
}: {
  persona: Persona | null;
  count: string;
  onChangeCount: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!persona) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDiscard();
    };

    document.addEventListener("keydown", keyHandler);

    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { y: 24, opacity: 0, scale: 0.98, filter: "blur(12px)" },
        { y: 0, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.32, ease: "power3.out" }
      );
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onDiscard, persona]);

  if (!persona) return null;

  return (
    <div className="persona-modal-backdrop" onMouseDown={onDiscard} role="presentation">
      <div
        className="persona-modal-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-modal-title"
        aria-describedby="clone-modal-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="persona-modal-head">
          <div>
            <p className="eyebrow">Clone persona</p>
            <h3 id="clone-modal-title">{persona.name}</h3>
            <p id="clone-modal-description">
              Choose how many copies to create. Each clone gets a unique ID and is selected automatically.
            </p>
          </div>
          <div className="persona-modal-id">
            <span>Source</span>
            <strong>{persona.id}</strong>
          </div>
        </div>

        <div className="persona-modal-grid">
          <label className="field wide">
            <span>How many clones?</span>
            <input
              type="number"
              min="1"
              max="12"
              value={count}
              onChange={(event) => onChangeCount(event.target.value)}
            />
          </label>
          <div className="clone-preview wide">
            <span>Preview</span>
            <strong>{cloneCountLabel(Math.max(1, Number(count) || 1))}</strong>
          </div>
        </div>

        <div className="modal-actions">
          <button className="button-secondary" type="button" onClick={onDiscard}>
            Discard
          </button>
          <button className="button-primary" type="button" onClick={onSave}>
            Clone personas
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function WingSummaryCard({
  wing,
  title
}: {
  wing: SupervisorResult["wings"]["ux"];
  title: string;
}) {
  const score = wing.scores;

  return (
    <article className={`wing-summary wing-${wing.wing}`}>
      <div className="wing-summary-top">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{wing.title}</h3>
          <p>{wing.durationHint}</p>
        </div>
        <span className="status-pill">{wing.analysisMode}</span>
      </div>
      <div className="wing-summary-grid">
        <div>
          <span>Persona count</span>
          <strong>{wing.personaCount}</strong>
        </div>
        <div>
          <span>Findings</span>
          <strong>{wing.findings.length}</strong>
        </div>
        <div>
          <span>Wing</span>
          <strong>{wing.title}</strong>
        </div>
        <div>
          <span>Depth</span>
          <strong>{wing.pentestLevel ?? "Standard"}</strong>
        </div>
      </div>
      <div className="wing-score-row">
        <span>Clarity {100 - score.confusion}</span>
        <span>Confidence {100 - score.trustRisk}</span>
        <span>Boundary {score.exploitability}</span>
      </div>
    </article>
  );
}

function GitHubLanePanel({
  githubToken,
  setGithubToken,
  githubRepos,
  githubLoading,
  githubError,
  selectedRepo,
  setSelectedRepo,
  githubBranch,
  setGithubBranch,
  loadGitHubRepos,
  saveGitHubConnection,
  setActiveWorkspace
}: {
  githubToken: string;
  setGithubToken: (value: string) => void;
  githubRepos: GitHubRepoSummary[];
  githubLoading: boolean;
  githubError: string;
  selectedRepo: GitHubRepoSummary | null;
  setSelectedRepo: (repo: GitHubRepoSummary | null) => void;
  githubBranch: string;
  setGithubBranch: (value: string) => void;
  loadGitHubRepos: () => void;
  saveGitHubConnection: () => void;
  setActiveWorkspace: (workspace: WorkspaceTab) => void;
}) {
  return (
    <section className="floating-card card-shell reveal">
      <div className="card-core">
        <p className="eyebrow">GitHub lane</p>
        <div className="section-head inline">
          <h2>Connect a repository for CI/CD runs later</h2>
          <span className="status-pill">{selectedRepo ? "Repo connected" : "Token required"}</span>
        </div>
        <p className="section-copy">
          The dashboard can list your repositories server-side with a GitHub token, then keep the chosen
          repo and branch ready for push or PR automation when you are ready to wire it up.
        </p>

        <div className="custom-form github-form">
          <label className="field wide">
            <span>GitHub token</span>
            <input
              value={githubToken}
              onChange={(event) => setGithubToken(event.target.value)}
              placeholder="ghp_..."
            />
          </label>
          <label className="field">
            <span>Branch</span>
            <input value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)} />
          </label>
          <label className="field">
            <span>Lane</span>
            <input value="CI/CD ready" readOnly />
          </label>
        </div>

        <div className="stack-actions">
          <button className="button-primary" type="button" onClick={loadGitHubRepos} disabled={githubLoading}>
            {githubLoading ? "Loading repos..." : "Load repositories"}
            <span>→</span>
          </button>
          <button className="button-secondary" type="button" onClick={saveGitHubConnection} disabled={!selectedRepo}>
            Save connection
          </button>
          <button className="button-secondary" type="button" onClick={() => setActiveWorkspace("dashboard")}>
            Back to dashboard
          </button>
        </div>

        {githubError ? <p className="error-banner">{githubError}</p> : null}

        <div className="repo-grid">
          {githubRepos.length ? (
            githubRepos.map((repo) => (
              <button
                key={repo.id}
                type="button"
                className={`repo-card ${selectedRepo?.id === repo.id ? "is-selected" : ""}`}
                onClick={() => setSelectedRepo(repo)}
              >
                <div className="repo-card-top">
                  <strong>{repo.fullName}</strong>
                  <span>{repo.private ? "Private" : "Public"}</span>
                </div>
                <p>{repo.description || "No description"}</p>
                <div className="repo-card-meta">
                  <span>Default branch {repo.defaultBranch}</span>
                  <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="empty-findings persona-empty">
              <p>Load repositories with your GitHub token to choose the first CI/CD target.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PersonaAssistantPanel({
  personaPrompt,
  setPersonaPrompt,
  personaSuggestions,
  personaSuggestionError,
  generatePersonaSuggestions,
  acceptSuggestion,
  acceptAllSuggestions,
  discardSuggestion,
  setActiveWorkspace
}: {
  personaPrompt: string;
  setPersonaPrompt: (value: string) => void;
  personaSuggestions: PersonaSuggestion[];
  personaSuggestionError: string;
  generatePersonaSuggestions: () => void;
  acceptSuggestion: (suggestion: PersonaSuggestion) => void;
  acceptAllSuggestions: () => void;
  discardSuggestion: (id: string) => void;
  setActiveWorkspace: (workspace: WorkspaceTab) => void;
}) {
  return (
    <section className="floating-card card-shell reveal">
      <div className="card-core">
        <p className="eyebrow">Persona assistant</p>
        <div className="section-head inline">
          <h2>Describe the product and get suggested personas</h2>
          <span className="status-pill">{personaSuggestions.length ? `${personaSuggestions.length} suggestions` : "Heuristic ready"}</span>
        </div>
        <p className="section-copy">
          This is the future persona pack assistant: describe the flow, review suggested personas, then accept,
          edit, save, or discard them.
        </p>

        <label className="field wide">
          <span>Project description</span>
          <textarea
            className="text-area"
            value={personaPrompt}
            onChange={(event) => setPersonaPrompt(event.target.value)}
            placeholder="Example: A B2B billing portal with checkout, admin settings, and mobile onboarding."
            rows={5}
          />
        </label>

        <div className="stack-actions">
          <button className="button-primary" type="button" onClick={generatePersonaSuggestions}>
            Suggest personas
            <span>→</span>
          </button>
          <button className="button-secondary" type="button" onClick={acceptAllSuggestions} disabled={!personaSuggestions.length}>
            Accept all
          </button>
          <button className="button-secondary" type="button" onClick={() => setActiveWorkspace("dashboard")}>
            Back to dashboard
          </button>
        </div>

        {personaSuggestionError ? <p className="error-banner">{personaSuggestionError}</p> : null}

        <div className="suggestion-grid">
          {personaSuggestions.length ? (
            personaSuggestions.map((suggestion) => {
              const suggestionId = suggestion.id ?? makePersonaId(suggestion.name ?? "Suggested persona");
              return (
              <article key={suggestionId} className="suggestion-card">
                <div className="suggestion-card-top">
                  <div>
                    <strong>{suggestion.name}</strong>
                    <p>{suggestion.reason}</p>
                  </div>
                  <span className="severity-pill">{suggestion.penTest ? "Red team" : "UX"}</span>
                </div>
                <p>{suggestion.lens}</p>
                <div className="persona-meta persona-meta-values">
                  <span>Patience {suggestion.patience}</span>
                  <span>Trust {suggestion.trust}</span>
                </div>
                <div className="persona-actions">
                  <span className="persona-link" onClick={() => acceptSuggestion({ ...suggestion, id: suggestionId })}>
                    Accept
                  </span>
                  <span className="persona-link danger" onClick={() => discardSuggestion(suggestionId)}>
                    Discard
                  </span>
                </div>
              </article>
              );
            })
          ) : (
            <div className="empty-findings persona-empty">
              <p>Describe the product or flow to generate a tailored persona pack.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RunningSupervisorPanel({
  uxCount,
  redCount,
  redTeamLevel
}: {
  uxCount: number;
  redCount: number;
  redTeamLevel: PentestLevel;
}) {
  return (
    <div className="running-supervisor">
      <div className="running-supervisor-head">
        <div>
          <p className="eyebrow">Supervisor running</p>
          <h3>Parallel wings are working now</h3>
          <p>UX agents and red-team agents are executing at the same time, each with its own lane.</p>
        </div>
        <span className="status-pill">{redTeamLevel}</span>
      </div>

      <div className="running-grid">
        <div className="running-wing running-wing-ux">
          <div className="running-wing-top">
            <strong>UX Suite</strong>
            <span>{uxCount} agents</span>
          </div>
          <div className="pulse-row" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Scanning for UX friction, layout pressure, and clarity gaps.</p>
        </div>
        <div className="running-wing running-wing-red">
          <div className="running-wing-top">
            <strong>Red Team Suite</strong>
            <span>{redCount} agents</span>
          </div>
          <div className="pulse-row" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Probing for repeated actions, bypasses, and weak boundaries.</p>
        </div>
      </div>
      <div className="loading-grid" aria-hidden="true">
        <div className="loading-caption">
          <span>Gathering signals</span>
          <span>Model + heuristics + browser capture</span>
        </div>
        <div className="loading-track">
          <span />
        </div>
        <div className="loading-track">
          <span />
        </div>
        <div className="loading-track">
          <span />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [targetUrl, setTargetUrl] = useState("/demo-flow");
  const [scenario, setScenario] = useState<AnalysisScenario>("cognitive");
  const [dialSettings, setDialSettings] = useState<DialSettings>(defaultDialSettings);
  const [redTeamLevel, setRedTeamLevel] = useState<PentestLevel>("quick");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>("dashboard");
  const [customPersonas, setCustomPersonas] = useState<PersonaInput[]>([]);
  const [personaOverrides, setPersonaOverrides] = useState<Record<string, PersonaInput>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultPersonas.map((persona) => persona.id));
  const [draft, setDraft] = useState<CustomDraft>(defaultCustomDraft);
  const [draftError, setDraftError] = useState("");
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [editingDraft, setEditingDraft] = useState<PersonaInput | null>(null);
  const [editingError, setEditingError] = useState("");
  const [cloningPersona, setCloningPersona] = useState<Persona | null>(null);
  const [cloneCountDraft, setCloneCountDraft] = useState("1");
  const [result, setResult] = useState<SupervisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrateReady, setHydrateReady] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubRepos, setGithubRepos] = useState<GitHubRepoSummary[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoSummary | null>(null);
  const [githubBranch, setGithubBranch] = useState("main");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [personaSuggestions, setPersonaSuggestions] = useState<PersonaSuggestion[]>([]);
  const [personaSuggestionError, setPersonaSuggestionError] = useState("");

  const baselinePersonas = useMemo(
    () => defaultPersonas.map((persona) => mergePersona(persona, personaOverrides[persona.id])),
    [personaOverrides]
  );

  const stressLibrary = useMemo(
    () => stressPersonas.map((persona) => mergePersona(persona, personaOverrides[persona.id])),
    [personaOverrides]
  );

  const customLibrary = useMemo(
    () =>
      customPersonas.map((persona, index) => {
        const personaId = persona.id ?? makePersonaId(persona.name ?? `Custom persona ${index + 1}`);
        return mergePersona({ ...persona, id: personaId }, personaOverrides[personaId], index);
      }),
    [customPersonas, personaOverrides]
  );

  const allPersonas = useMemo(
    () => [...baselinePersonas, ...stressLibrary, ...customLibrary],
    [baselinePersonas, customLibrary, stressLibrary]
  );

  const stressPersonaIds = useMemo(() => stressPersonas.map((persona) => persona.id), []);

  const selectedPersonas = useMemo(
    () => allPersonas.filter((persona) => selectedIds.includes(persona.id)),
    [allPersonas, selectedIds]
  );

  const selectedOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedIds.forEach((id, index) => {
      map.set(id, index + 1);
    });
    return map;
  }, [selectedIds]);

  const uxSelectedPersonas = useMemo(() => selectedPersonas.filter((persona) => !persona.penTest), [selectedPersonas]);
  const redTeamSelectedPersonas = useMemo(() => selectedPersonas.filter((persona) => persona.penTest), [selectedPersonas]);

  const supervisorSummary = useMemo(() => {
    if (!result) {
      return {
        uxCount: uxSelectedPersonas.length || baselinePersonas.length,
        redCount: redTeamSelectedPersonas.length || stressLibrary.length,
        wingState: "Ready to run both wings" as const
      };
    }

    return {
      uxCount: result.wings.ux.personaCount,
      redCount: result.wings.redTeam.personaCount,
      wingState: `UX ${result.wings.ux.findings.length} · Red team ${result.wings.redTeam.findings.length}` as const
    };
  }, [baselinePersonas.length, redTeamSelectedPersonas.length, result, stressLibrary.length, uxSelectedPersonas.length]);

  const supervisorFindings = useMemo(
    () =>
      result?.findings.map((finding) => ({
        ...finding,
        wingLabel: finding.wing === "ux" ? "UX Suite" : "Red Team Suite"
      })) ?? [],
    [result]
  );

  const agentCards = useMemo(
    () =>
      allPersonas.map((persona) => {
        const order = selectedOrderMap.get(persona.id) ?? 0;
        const wingLabel = persona.penTest ? "Red Team Suite" : "UX Suite";
        const personaFindings = result ? findFindingsForPersona(supervisorFindings, persona.name) : [];
        const selected = selectedIds.includes(persona.id);
        return {
          persona,
          order,
          wingLabel,
          findings: personaFindings,
          selected
        };
      }),
    [allPersonas, result, selectedIds, selectedOrderMap, supervisorFindings]
  );

  const selectedAgentSummary = useMemo(
    () => agentCards.filter((entry) => entry.selected).map((entry) => `#${entry.order} ${entry.persona.name}`),
    [agentCards]
  );

  useEffect(() => {
    const storedCustom = window.localStorage.getItem("probelayer-custom-personas");
    const storedSelected = window.localStorage.getItem("probelayer-selected-personas");
    const storedOverrides = window.localStorage.getItem("probelayer-persona-overrides");

    if (storedCustom) {
      try {
        const parsed = JSON.parse(storedCustom) as PersonaInput[];
        setCustomPersonas(parsed);
      } catch {
        window.localStorage.removeItem("probelayer-custom-personas");
      }
    }

    if (storedSelected) {
      try {
        const parsed = JSON.parse(storedSelected) as string[];
        if (Array.isArray(parsed) && parsed.length) {
          setSelectedIds(parsed);
        }
      } catch {
        window.localStorage.removeItem("probelayer-selected-personas");
      }
    }

    if (storedOverrides) {
      try {
        const parsed = JSON.parse(storedOverrides) as Record<string, PersonaInput>;
        setPersonaOverrides(parsed ?? {});
      } catch {
        window.localStorage.removeItem("probelayer-persona-overrides");
      }
    }

    const storedGitHub = window.localStorage.getItem("probelayer-github-connection");
    if (storedGitHub) {
      try {
        const parsed = JSON.parse(storedGitHub) as {
          repo?: GitHubRepoSummary;
          branch?: string;
        };
        if (parsed.repo) setSelectedRepo(parsed.repo);
        if (parsed.branch) setGithubBranch(parsed.branch);
      } catch {
        window.localStorage.removeItem("probelayer-github-connection");
      }
    }

    setHydrateReady(true);
  }, []);

  useEffect(() => {
    if (!hydrateReady) return;
    window.localStorage.setItem("probelayer-custom-personas", JSON.stringify(customPersonas));
  }, [customPersonas, hydrateReady]);

  useEffect(() => {
    if (!hydrateReady) return;
    window.localStorage.setItem("probelayer-selected-personas", JSON.stringify(selectedIds));
  }, [selectedIds, hydrateReady]);

  useEffect(() => {
    if (!hydrateReady) return;
    window.localStorage.setItem("probelayer-persona-overrides", JSON.stringify(personaOverrides));
  }, [personaOverrides, hydrateReady]);

  useEffect(() => {
    if (draftError) setDraftError("");
    // Reset the create-form error as soon as the user changes the draft again.
  }, [draft]);

  useEffect(() => {
    if (editingError) setEditingError("");
    // Reset the edit-form error as soon as the user changes the draft again.
  }, [editingDraft]);

  useEffect(() => {
    if (scenario !== "pen-test") return;
    setSelectedIds((current) => Array.from(new Set([...current, ...stressPersonaIds])));
  }, [scenario, stressPersonaIds]);

  useGSAP(
    () => {
      const ctx = gsap.context(() => {
        gsap.from(".hero-kicker", { y: 20, opacity: 0, duration: 0.9, ease: "power3.out" });
        gsap.from(".hero-title span", {
          y: 38,
          opacity: 0,
          stagger: 0.06,
          duration: 1.05,
          ease: "power3.out",
          filter: "blur(12px)"
        });
        gsap.from(".hero-copy p, .hero-actions", {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.04,
          delay: 0.1
        });
        gsap.from(".floating-card", {
          y: 36,
          opacity: 0,
          stagger: 0.08,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".content-grid",
            start: "top 82%"
          }
        });
        ScrollTrigger.batch(".reveal", {
          start: "top 84%",
          once: true,
          onEnter: (elements) => {
            gsap.fromTo(
              elements,
              { y: 28, opacity: 0, filter: "blur(12px)" },
              { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, stagger: 0.08, ease: "power3.out" }
            );
          }
        });
      }, heroRef);

      return () => ctx.revert();
    },
    { scope: heroRef }
  );

  useEffect(() => {
    if (!resultRef.current || !result) return;
    gsap.fromTo(
      resultRef.current.querySelectorAll(".hotspot"),
      { scale: 0.7, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.8)", stagger: 0.05 }
    );
  }, [result]);

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/supervisor", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          targetUrl: resolveTargetUrl(targetUrl),
          scenario,
          personas: selectedPersonas.map((persona) => buildPersonaInput(persona)),
          dialSettings,
          redTeamLevel
        })
      });

      const data = (await response.json()) as SupervisorResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Simulation failed");
      setResult(data);
      setActiveWorkspace("dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadGitHubRepos() {
    setGithubLoading(true);
    setGithubError("");

    try {
      const response = await fetch("/api/github/repos", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          token: githubToken,
          visibility: "all"
        })
      });

      const data = (await response.json()) as { repos?: GitHubRepoSummary[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to load repositories");
      setGithubRepos(data.repos ?? []);
      if (data.repos?.length && !selectedRepo) {
        setSelectedRepo(data.repos[0]);
        setGithubBranch(data.repos[0].defaultBranch || "main");
      }
    } catch (requestError) {
      setGithubError(requestError instanceof Error ? requestError.message : "Failed to load repositories");
    } finally {
      setGithubLoading(false);
    }
  }

  function saveGitHubConnection() {
    if (!selectedRepo) return;
    window.localStorage.setItem(
      "probelayer-github-connection",
      JSON.stringify({
        repo: selectedRepo,
        branch: githubBranch,
        tokenSaved: Boolean(githubToken)
      })
    );
  }

  function generatePersonaSuggestions() {
    setPersonaSuggestionError("");
    if (!personaPrompt.trim()) {
      setPersonaSuggestionError("Describe the product or flow you want personas for.");
      return;
    }
    const suggestions = suggestPersonaPack(personaPrompt);
    setPersonaSuggestions(suggestions);
    if (suggestions.length) {
      setActiveWorkspace("assistant");
    }
  }

  function acceptSuggestion(suggestion: PersonaSuggestion) {
    const id = suggestion.id?.trim() || makePersonaId(suggestion.name ?? "Suggested persona");
    const persona: PersonaInput = {
      ...suggestion,
      id
    };
    setCustomPersonas((current) => [...current, persona]);
    setSelectedIds((current) => arrayToggle(current, id));
    setPersonaSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
  }

  function acceptAllSuggestions() {
    personaSuggestions.forEach((suggestion) => acceptSuggestion(suggestion));
  }

  function discardSuggestion(id: string) {
    setPersonaSuggestions((current) => current.filter((suggestion) => suggestion.id !== id));
  }

  function addCustomPersona() {
    const name = draft.name.trim();
    if (!name) {
      setDraftError("Give the persona a name before saving.");
      return;
    }
    const patienceError = boundedRangeError("Patience", draft.patience, 1, 100);
    const trustError = boundedRangeError("Trust", draft.trust, 1, 100);
    if (patienceError || trustError) {
      setDraftError(patienceError || trustError);
      return;
    }
    const id = draft.id.trim() || makePersonaId(name);
    const patience = parseBoundedNumber(draft.patience, 45, 1, 100);
    const trust = parseBoundedNumber(draft.trust, 50, 1, 100);

    const persona: PersonaInput = {
      id,
      name,
      lens: draft.lens.trim(),
      goal: draft.goal.trim(),
      riskBias: draft.riskBias.trim(),
      patience,
      trust,
      accessibility: draft.accessibility.trim(),
      tone: draft.tone.trim(),
      penTest: draft.penTest,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    };

    setCustomPersonas((current) => [...current, persona]);
    setSelectedIds((current) => arrayToggle(current, id));
    setDraft(defaultCustomDraft);
    setDraftError("");
  }

  function openCloneModal(persona: Persona) {
    setCloningPersona(persona);
    setCloneCountDraft("1");
  }

  function closeCloneModal() {
    setCloningPersona(null);
    setCloneCountDraft("1");
  }

  function confirmClonePersona() {
    if (!cloningPersona) return;
    const rawCount = Number.parseInt(cloneCountDraft, 10);
    const count = Number.isFinite(rawCount) ? Math.min(12, Math.max(1, rawCount)) : 1;
    const clones: PersonaInput[] = Array.from({ length: count }, (_, index) => {
      const cloneIndex = index + 1;
      return {
        ...buildPersonaInput(cloningPersona),
        id: `${cloningPersona.id}-copy-${Date.now()}-${cloneIndex}`,
        name: `${cloningPersona.name} Copy ${cloneIndex}`
      };
    });

    setCustomPersonas((current) => [...current, ...clones]);
    setSelectedIds((current) => {
      const next = new Set(current);
      clones.forEach((clone) => {
        if (clone.id) next.add(clone.id);
      });
      return Array.from(next);
    });
    closeCloneModal();
  }

  function removeCustomPersona(id: string) {
    const isEditingRemovedPersona = editingPersona?.id === id;
    setCustomPersonas((current) => current.filter((persona) => persona.id !== id));
    setSelectedIds((current) => current.filter((personaId) => personaId !== id));
    setPersonaOverrides((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (isEditingRemovedPersona) {
      setEditingPersona(null);
      setEditingDraft(null);
    }
  }

  function openPersonaEditor(persona: Persona) {
    setEditingPersona(persona);
    setEditingDraft(buildPersonaInput(persona));
    setEditingError("");
  }

  function discardPersonaEdits() {
    setEditingPersona(null);
    setEditingDraft(null);
    setEditingError("");
  }

  function savePersonaEdits() {
    if (!editingPersona || !editingDraft) return;
    const name = editingDraft.name?.trim() ?? "";
    if (!name) {
      setEditingError("Give the persona a name before saving.");
      return;
    }
    const patienceError = boundedRangeError("Patience", editingDraft.patience, 1, 100);
    const trustError = boundedRangeError("Trust", editingDraft.trust, 1, 100);
    if (patienceError || trustError) {
      setEditingError(patienceError || trustError);
      return;
    }
    const normalized = normalizePersona({ ...editingDraft, id: editingPersona.id }, 0);
    setPersonaOverrides((current) => ({
      ...current,
      [editingPersona.id]: normalized
    }));
    setEditingPersona(null);
    setEditingDraft(null);
    setEditingError("");
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="grain" />

      <header className="topbar">
        <div>
          <span className="brand-mark">P</span>
          <div>
            <strong>Probelayer</strong>
          </div>
        </div>
        <div className="topbar-nav">
          <button
            type="button"
            className={`topbar-tab ${activeWorkspace === "dashboard" ? "is-selected" : ""}`}
            onClick={() => setActiveWorkspace("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`topbar-tab ${activeWorkspace === "github" ? "is-selected" : ""}`}
            onClick={() => setActiveWorkspace("github")}
          >
            GitHub
          </button>
          <button
            type="button"
            className={`topbar-tab ${activeWorkspace === "assistant" ? "is-selected" : ""}`}
            onClick={() => setActiveWorkspace("assistant")}
          >
            Assistant
          </button>
          <span className="topbar-powered">Powered by Gemini 3.5 Flash</span>
        </div>
      </header>

      <section className="hero" ref={heroRef}>
        <div className="hero-copy">
          <p className="hero-kicker eyebrow">Dual-wing supervisor</p>
          <h1 className="hero-title">
            <span>Find where real users</span>
            <span>get stuck, and where bad</span>
            <span>actors get through, before launch.</span>
          </h1>
          <p>
            Probelayer runs UX and red-team suites in parallel, keeps the findings separated by wing, and
            merges the final report only after both passes complete.
          </p>

          <form className="hero-actions" onSubmit={handleRun}>
            <label className="target-field">
              <span>Target URL</span>
              <input
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                placeholder="https://example.com/signup"
              />
            </label>

            <div className="hero-settings">
              <label className="field">
                <span>Scenario</span>
                <select value={scenario} onChange={(event) => setScenario(event.target.value as AnalysisScenario)}>
                  <option value="cognitive">Cognitive load</option>
                  <option value="mobile">Mobile</option>
                  <option value="pen-test">Pen-test</option>
                </select>
              </label>
              <label className="field">
                <span>Red-team depth</span>
                <select value={redTeamLevel} onChange={(event) => setRedTeamLevel(event.target.value as PentestLevel)}>
                  <option value="quick">Quick</option>
                  <option value="deep">Deep</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </label>
            </div>

            <div className="hero-buttons">
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? "Simulating..." : "Run supervisor"}
                <span>→</span>
              </button>
              <a className="button-secondary" href="#analysis">
                Explore analysis
              </a>
            </div>
            {error ? <p className="error-banner">{error}</p> : null}
          </form>
        </div>

        <div className="hero-panel card-shell floating-card reveal">
          <CoverageCard
            uxSelectedCount={uxSelectedPersonas.length || baselinePersonas.length}
            redTeamSelectedCount={redTeamSelectedPersonas.length || stressLibrary.length}
            customCount={customPersonas.length}
            scenario={scenario}
            modelReady={Boolean(result?.usedModel)}
            redTeamLevel={redTeamLevel}
            supervisorState={supervisorSummary.wingState}
          />
        </div>
      </section>

      {activeWorkspace === "dashboard" ? (
        <section className="content-grid" id="analysis">
          <div className="left-column">
            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">Persona library</p>
                <div className="section-head">
                  <h2>Default set plus custom personas</h2>
                  <p>
                    Mix default personas with your own audience definitions, clone what works, and keep a
                    persistent pack in local storage.
                  </p>
                </div>

                <div className="persona-grid">
                  {baselinePersonas.map((persona) => {
                    const selected = selectedIds.includes(persona.id);
                    const selectedOrder = selectedOrderMap.get(persona.id);
                    return (
                      <PersonaCard
                        key={persona.id}
                        persona={persona}
                        selected={selected}
                        selectedOrder={selectedOrder}
                        onToggle={() => setSelectedIds((current) => arrayToggle(current, persona.id))}
                        onEdit={() => openPersonaEditor(persona)}
                        onClone={() => openCloneModal(persona)}
                        isCustom={false}
                      />
                    );
                  })}
                </div>

                <div className="section-head persona-subhead">
                  <div>
                    <p className="eyebrow">Stress & abuse pack</p>
                    <h3>Button mashers and pen-test agents</h3>
                  </div>
                  <p>These agents are ready for repeated submits, bypass attempts, and destructive-path checks.</p>
                </div>

                <div className="persona-grid persona-grid-stress">
                  {stressLibrary.map((persona) => {
                    const selected = selectedIds.includes(persona.id);
                    const selectedOrder = selectedOrderMap.get(persona.id);
                    return (
                      <PersonaCard
                        key={persona.id}
                        persona={persona}
                        selected={selected}
                        selectedOrder={selectedOrder}
                        onToggle={() => setSelectedIds((current) => arrayToggle(current, persona.id))}
                        onEdit={() => openPersonaEditor(persona)}
                        onClone={() => openCloneModal(persona)}
                        isCustom={false}
                      />
                    );
                  })}
                </div>

                <div className="section-head persona-subhead">
                  <div>
                    <p className="eyebrow">Saved customs</p>
                    <h3>Your editable persona set</h3>
                  </div>
                  <p>These live in local storage and can be edited, cloned, or removed without affecting the defaults.</p>
                </div>

                <div className="persona-grid persona-grid-custom">
                  {customLibrary.length ? (
                    customLibrary.map((persona) => {
                      const selected = selectedIds.includes(persona.id);
                      const selectedOrder = selectedOrderMap.get(persona.id);
                      return (
                        <PersonaCard
                          key={persona.id}
                          persona={persona}
                          selected={selected}
                          selectedOrder={selectedOrder}
                          onToggle={() => setSelectedIds((current) => arrayToggle(current, persona.id))}
                          onEdit={() => openPersonaEditor(persona)}
                          onClone={() => openCloneModal(persona)}
                          onRemove={() => removeCustomPersona(persona.id)}
                          isCustom
                        />
                      );
                    })
                  ) : (
                    <div className="empty-findings persona-empty">
                      <p>No custom personas saved yet. Use the form below to add one, then edit it here.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">Create persona</p>
                <div className="section-head">
                  <h2>Manually add a persona for a specific product or funnel</h2>
                  <p>
                    Build custom audience profiles, combine them with the defaults, and keep the results saved
                    for the next run.
                  </p>
                </div>

                <div className="custom-form">
                  <label className="field">
                    <span>Name</span>
                    <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Behavioral lens</span>
                    <input value={draft.lens} onChange={(event) => setDraft((current) => ({ ...current, lens: event.target.value }))} />
                  </label>
                  <label className="field wide">
                    <span>Primary goal</span>
                    <input value={draft.goal} onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))} />
                  </label>
                  <label className="field wide">
                    <span>Risk biases</span>
                    <input
                      value={draft.riskBias}
                      onChange={(event) => setDraft((current) => ({ ...current, riskBias: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Patience</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={draft.patience}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          patience: String(parseBoundedNumber(event.target.value, 45, 1, 100))
                        }))
                      }
                    />
                    <small className="field-hint">Range 1-100</small>
                  </label>
                  <label className="field">
                    <span>Trust</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={draft.trust}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          trust: String(parseBoundedNumber(event.target.value, 50, 1, 100))
                        }))
                      }
                    />
                    <small className="field-hint">Range 1-100</small>
                  </label>
                  <label className="field wide">
                    <span>Accessibility needs</span>
                    <input
                      value={draft.accessibility}
                      onChange={(event) => setDraft((current) => ({ ...current, accessibility: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Tone</span>
                    <input value={draft.tone} onChange={(event) => setDraft((current) => ({ ...current, tone: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} />
                  </label>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={draft.penTest}
                    onChange={(event) => setDraft((current) => ({ ...current, penTest: event.target.checked }))}
                  />
                  <span>Pen-test persona</span>
                </label>

                <div className="stack-actions">
                  <button className="button-primary" type="button" onClick={addCustomPersona}>
                    Save persona
                    <span>→</span>
                  </button>
                  <button className="button-secondary" type="button" onClick={() => setDraft(defaultCustomDraft)}>
                    Reset form
                  </button>
                </div>
                {draftError ? <p className="error-banner">{draftError}</p> : null}
              </div>
            </section>
          </div>

          <div className="right-column" ref={resultRef}>
            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">Supervisor output</p>
                <div className="section-head inline">
                  <h2>Parallel wing report</h2>
                  <span className="status-pill">
                    {result?.usedModel ? "Gemini 3.5 Flash active" : "Heuristic fallback ready"}
                  </span>
                </div>

                {loading ? (
                  <RunningSupervisorPanel
                    uxCount={uxSelectedPersonas.length || baselinePersonas.length}
                    redCount={redTeamSelectedPersonas.length || stressLibrary.length}
                    redTeamLevel={redTeamLevel}
                  />
                ) : null}

                <div className="supervisor-wing-grid">
                  {result ? (
                    <>
                      <WingSummaryCard wing={result.wings.ux} title="Wing 1" />
                      <WingSummaryCard wing={result.wings.redTeam} title="Wing 2" />
                    </>
                  ) : (
                    <div className="empty-findings persona-empty supervisor-empty">
                      <p>Run Probelayer to launch the UX suite and the red-team suite together.</p>
                    </div>
                  )}
                </div>

                <div className="agent-roster">
                  <div className="section-head inline">
                    <h3>Agents</h3>
                    <span className="status-pill">
                      {selectedAgentSummary.length}/{agentCards.length} selected
                    </span>
                  </div>
                  <div className="agent-roster-strip" role="list" aria-label="All agents">
                    {agentCards.map((entry) => (
                      <div
                        key={entry.persona.id}
                        className="agent-roster-chip"
                        role="listitem"
                        style={agentAccentStyle(entry.order, entry.selected)}
                      >
                        <span className="agent-roster-order">{entry.selected ? `#${entry.order}` : "Idle"}</span>
                        <div>
                          <strong>{entry.persona.name}</strong>
                          <p>{entry.wingLabel}</p>
                        </div>
                        <span className={`agent-roster-state ${entry.selected ? "is-selected" : "is-idle"}`}>
                          {entry.selected ? "Selected" : "Idle"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-box">
                    <span>Mode</span>
                    <strong>{result ? result.scenario : scenario}</strong>
                  </div>
                  <div className="summary-box">
                    <span>Depth</span>
                    <strong>{redTeamLevel}</strong>
                  </div>
                  <div className="summary-box">
                    <span>Inputs</span>
                    <strong>{result ? result.pageFacts.analysisInputs.join(" + ") : "Screenshot + DOM + personas"}</strong>
                  </div>
                  <div className="summary-box">
                    <span>Supervisor</span>
                    <strong>{supervisorSummary.wingState}</strong>
                  </div>
                </div>

                <div className="agent-results">
                  <div className="agent-results-grid">
                    {agentCards.map((entry) => (
                      <AgentResultCard
                        key={entry.persona.id}
                        persona={entry.persona}
                        order={entry.order}
                        wingLabel={entry.wingLabel}
                        findings={entry.findings}
                        selected={entry.selected}
                      />
                    ))}
                  </div>
                </div>

                {result ? (
                  <div className="score-grid">
                    <ScoreCard
                      label="Selected agents"
                      value={selectedAgentSummary.length}
                      description="These agents are active in this run."
                    />
                    <ScoreCard
                      label="UX findings"
                      value={result.wings.ux.findings.length}
                      description="Friction, clarity, and usability issues."
                    />
                    <ScoreCard
                      label="Red-team findings"
                      value={result.wings.redTeam.findings.length}
                      description="Abuse, bypass, and repeated-action risks."
                    />
                    <ScoreCard
                      label="Strongest wing"
                      value={Math.max(result.wings.ux.findings.length, result.wings.redTeam.findings.length)}
                      description="The lane with the heavier signal this pass."
                    />
                    <ScoreCard
                      label="Composite risk"
                      value={Math.max(result.scores.abandonment, result.scores.exploitability)}
                      description="Overall pressure from the two wings combined."
                    />
                    <ScoreCard
                      label="Coverage strength"
                      value={Math.max(result.pageFacts.buttonCount + result.pageFacts.inputCount, result.pageFacts.headingCount)}
                      description="Signals available for the supervisor to inspect."
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">Visual map</p>
                <div className="section-head inline">
                  <h2>Hotspots over the live screenshot</h2>
                  <span className="status-pill">{result ? new URL(result.targetUrl).hostname : "No run yet"}</span>
                </div>

                <div className="screenshot-frame">
                  {result?.screenshot ? (
                    <>
                      <img src={result.screenshot} alt="Probelayer analysis screenshot" />
                      {supervisorFindings.map((finding, index) => (
                        <span
                          key={`${finding.persona}-${index}`}
                          className={`hotspot severity-${finding.severity}`}
                          title={`${finding.persona}: ${simplifyFindingTheme(finding.theme)}`}
                          style={
                            {
                              left: `${finding.x}%`,
                              top: `${finding.y}%`,
                              "--delay": `${index * 0.05}s`
                            } as CSSProperties
                          }
                        >
                          <b>{resolveSelectedOrder(selectedPersonas, selectedOrderMap, finding.persona) || index + 1}</b>
                          <em>{simplifyFindingTheme(finding.theme)}</em>
                        </span>
                      ))}
                    </>
                  ) : (
                    <div className="empty-state">
                      <div>
                        <strong>No simulation yet</strong>
                        <p>
                          Run Probelayer against the built-in demo flow or a live URL to capture a screenshot,
                          plot risks, and generate a full analysis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="analysis-note">
                  <span>Interaction scan</span>
                  <p>
                    {result?.pageFacts.interaction.note ||
                      "Probelayer inspects copy, layout pressure, and action labels without clicking destructive controls."}
                  </p>
                </div>

                {result ? (
                  <div className="analysis-metadata">
                    <div>
                      <span>Buttons</span>
                      <strong>{result.pageFacts.interaction.buttonLabels.join(", ") || "None detected"}</strong>
                    </div>
                    <div>
                      <span>High-impact actions</span>
                      <strong>{result.pageFacts.interaction.highImpactActions.join(", ") || "None detected"}</strong>
                    </div>
                    <div>
                      <span>Ambiguous actions</span>
                      <strong>{result.pageFacts.interaction.ambiguousActions.join(", ") || "None detected"}</strong>
                    </div>
                    <div>
                      <span>Repeated labels</span>
                      <strong>{result.pageFacts.interaction.repeatedActionLabels.join(", ") || "None detected"}</strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">Findings</p>
                <div className="section-head inline">
                  <h2>Behavioral risk report</h2>
                  <span className="status-pill">{result ? `${result.findings.length} findings` : "Awaiting run"}</span>
                </div>

                <div className="findings-stack">
                  {result ? (
                    supervisorFindings.map((finding, index) => (
                      <FindingCard
                        key={`${finding.persona}-${index}`}
                        finding={finding}
                        index={index}
                        agentNumber={resolveSelectedOrder(selectedPersonas, selectedOrderMap, finding.persona)}
                      />
                    ))
                  ) : (
                    <div className="empty-findings">
                      <p>
                        No findings yet. Select personas and run a simulation to surface wing-specific risks.
                      </p>
                    </div>
                  )}
                </div>

                {result ? <p className="summary-copy">{result.summary}</p> : null}
              </div>
            </section>
          </div>
        </section>
      ) : activeWorkspace === "github" ? (
        <section className="content-grid" id="analysis">
          <div className="left-column">
            <GitHubLanePanel
              githubToken={githubToken}
              setGithubToken={setGithubToken}
              githubRepos={githubRepos}
              githubLoading={githubLoading}
              githubError={githubError}
              selectedRepo={selectedRepo}
              setSelectedRepo={setSelectedRepo}
              githubBranch={githubBranch}
              setGithubBranch={setGithubBranch}
              loadGitHubRepos={loadGitHubRepos}
              saveGitHubConnection={saveGitHubConnection}
              setActiveWorkspace={setActiveWorkspace}
            />
          </div>
          <div className="right-column">
            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">CI/CD roadmap</p>
                <div className="section-head">
                  <h2>Dashboard first now, push automation later</h2>
                  <p>
                    This lane keeps repository selection and branch selection ready now, then leaves webhook and
                    push-trigger automation for the next phase.
                  </p>
                </div>
                <div className="analysis-metadata">
                  <div>
                    <span>Selected repo</span>
                    <strong>{selectedRepo ? selectedRepo.fullName : "No repository selected"}</strong>
                  </div>
                  <div>
                    <span>Branch</span>
                    <strong>{githubBranch}</strong>
                  </div>
                  <div>
                    <span>Token state</span>
                    <strong>{githubToken ? "Entered" : "Waiting"}</strong>
                  </div>
                  <div>
                    <span>Next step</span>
                    <strong>Push-triggered runs after dashboard validation</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      ) : (
        <section className="content-grid" id="analysis">
          <div className="left-column">
            <PersonaAssistantPanel
              personaPrompt={personaPrompt}
              setPersonaPrompt={setPersonaPrompt}
              personaSuggestions={personaSuggestions}
              personaSuggestionError={personaSuggestionError}
              generatePersonaSuggestions={generatePersonaSuggestions}
              acceptSuggestion={acceptSuggestion}
              acceptAllSuggestions={acceptAllSuggestions}
              discardSuggestion={discardSuggestion}
              setActiveWorkspace={setActiveWorkspace}
            />
          </div>
          <div className="right-column">
            <section className="floating-card card-shell reveal">
              <div className="card-core">
                <p className="eyebrow">Persona pack assistant</p>
                <div className="section-head">
                  <h2>Later: model-assisted persona packs</h2>
                  <p>
                    This lane will eventually use project context and product description to suggest tailored
                    persona sets that you can accept, edit, save, or discard.
                  </p>
                </div>
                <div className="analysis-metadata">
                  <div>
                    <span>Suggested personas</span>
                    <strong>{personaSuggestions.length || "None yet"}</strong>
                  </div>
                  <div>
                    <span>Workflow</span>
                    <strong>Describe product → review suggestions → accept or discard</strong>
                  </div>
                  <div>
                    <span>Manual override</span>
                    <strong>Still fully supported through the persona editor</strong>
                  </div>
                  <div>
                    <span>Future model hook</span>
                    <strong>Can be upgraded to model-backed generation later</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}

      <PersonaEditorModal
        persona={editingPersona}
        draft={editingDraft}
        onChange={setEditingDraft}
        onSave={savePersonaEdits}
        onDiscard={discardPersonaEdits}
        error={editingError}
      />
      <ClonePersonaModal
        persona={cloningPersona}
        count={cloneCountDraft}
        onChangeCount={setCloneCountDraft}
        onSave={confirmClonePersona}
        onDiscard={closeCloneModal}
      />
    </main>
  );
}
