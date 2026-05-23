"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { defaultPersonas, type Persona, type PersonaInput, normalizePersona } from "@/lib/personas";
import type { AnalysisScenario, DialSettings, SimulationFinding, SimulationResult } from "@/lib/simulation";

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

function resolveTargetUrl(value: string) {
  return new URL(value, window.location.origin).toString();
}

function joinTags(tags: string[]) {
  return tags.length ? tags.join(" · ") : "custom";
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

function DialControl({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  hint
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint: string;
}) {
  return (
    <label className="dial-control">
      <div className="dial-head">
        <span>{label}</span>
        <strong>{value}/10</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p>{hint}</p>
    </label>
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
  return (
    <article className="score-card">
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

function FindingCard({ finding, index }: { finding: SimulationFinding; index: number }) {
  return (
    <article className={`finding-card severity-${finding.severity}`}>
      <div className="finding-head">
        <span className="finding-index">{index + 1}</span>
        <div>
          <h3>{finding.theme}</h3>
          <p>
            {finding.persona} felt {finding.emotion}.
          </p>
        </div>
        <span className="severity-pill">{finding.severity}</span>
      </div>
      <p className="finding-copy">{finding.evidence}</p>
      <p className="finding-fix">
        <strong>Fix</strong> {finding.recommendation}
      </p>
    </article>
  );
}

function PersonaCard({
  persona,
  selected,
  onToggle,
  onClone,
  onRemove,
  isCustom
}: {
  persona: Persona;
  selected: boolean;
  onToggle: () => void;
  onClone?: () => void;
  onRemove?: () => void;
  isCustom: boolean;
}) {
  return (
    <button className={`persona-card ${selected ? "is-selected" : ""}`} type="button" onClick={onToggle}>
      <div className="persona-card-top">
        <div>
          <strong>{persona.name}</strong>
          <span>{persona.lens}</span>
        </div>
        <span className="persona-pill">{selected ? "Selected" : "Idle"}</span>
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

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [targetUrl, setTargetUrl] = useState("/demo-flow");
  const [scenario, setScenario] = useState<AnalysisScenario>("balanced");
  const [dialSettings, setDialSettings] = useState<DialSettings>(defaultDialSettings);
  const [customPersonas, setCustomPersonas] = useState<PersonaInput[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultPersonas.map((persona) => persona.id));
  const [draft, setDraft] = useState<CustomDraft>(defaultCustomDraft);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrateReady, setHydrateReady] = useState(false);

  const allPersonas = useMemo(() => {
    return [
      ...defaultPersonas,
      ...customPersonas.map((persona, index) => normalizePersona(persona, index))
    ];
  }, [customPersonas]);

  const selectedPersonas = useMemo(
    () => allPersonas.filter((persona) => selectedIds.includes(persona.id)),
    [allPersonas, selectedIds]
  );

  useEffect(() => {
    const storedCustom = window.localStorage.getItem("probelayer-custom-personas");
    const storedSelected = window.localStorage.getItem("probelayer-selected-personas");

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
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          targetUrl: resolveTargetUrl(targetUrl),
          scenario,
          personas: selectedPersonas.map((persona) => buildPersonaInput(persona)),
          dialSettings
        })
      });

      const data = (await response.json()) as SimulationResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Simulation failed");
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  function addCustomPersona() {
    const name = draft.name.trim();
    if (!name) return;
    const id = draft.id.trim() || makePersonaId(name);

    const persona: PersonaInput = {
      id,
      name,
      lens: draft.lens.trim(),
      goal: draft.goal.trim(),
      riskBias: draft.riskBias.trim(),
      patience: Number(draft.patience),
      trust: Number(draft.trust),
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
  }

  function clonePersona(persona: Persona) {
    const cloneName = `${persona.name} Copy`;
    const clone: PersonaInput = {
      ...buildPersonaInput(persona),
      id: `${persona.id}-copy-${Date.now()}`,
      name: cloneName
    };
    setCustomPersonas((current) => [...current, clone]);
    setSelectedIds((current) => [...new Set([...current, clone.id ?? ""])].filter((value): value is string => Boolean(value)));
  }

  function removeCustomPersona(id: string) {
    setCustomPersonas((current) => current.filter((persona) => persona.id !== id));
    setSelectedIds((current) => current.filter((personaId) => personaId !== id));
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
            <p>Behavioral failure simulation</p>
          </div>
        </div>
        <div className="topbar-meta">
          <span>Gemini 3.5 Flash</span>
          <span>Design variance 9/10</span>
          <span>Motion intensity 9/10</span>
          <span>Visual density 4/10</span>
        </div>
      </header>

      <section className="hero" ref={heroRef}>
        <div className="hero-copy">
          <p className="hero-kicker eyebrow">Synthetic human testing</p>
          <h1 className="hero-title">
            <span>Find where real people</span>
            <span>get confused, overloaded, or suspicious</span>
            <span>before launch.</span>
          </h1>
          <p>
            Probelayer uses personas, screenshot reasoning, and defensive interaction checks to reveal
            UX, trust, accessibility, cognitive load, and abuse risks in the first pass.
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
            <div className="hero-buttons">
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? "Simulating..." : "Run simulation"}
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
          <div className="card-core hero-panel-core">
            <p className="eyebrow">Design dials</p>
            <div className="dial-grid">
              <DialControl
                label="Design variance"
                value={dialSettings.designVariance}
                onChange={(value) => setDialSettings((current) => ({ ...current, designVariance: value }))}
                hint="Higher values lean into asymmetry and modern layout shifts."
              />
              <DialControl
                label="Motion intensity"
                value={dialSettings.motionIntensity}
                onChange={(value) => setDialSettings((current) => ({ ...current, motionIntensity: value }))}
                hint="Higher values increase reveal depth, motion layering, and kinetic emphasis."
              />
              <DialControl
                label="Visual density"
                value={dialSettings.visualDensity}
                onChange={(value) => setDialSettings((current) => ({ ...current, visualDensity: value }))}
                hint="Keep this low-mid so the interface stays premium and readable."
              />
            </div>
            <div className="scenario-row">
              {(["balanced", "pen-test", "cognitive", "mobile"] as AnalysisScenario[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`scenario-pill ${scenario === mode ? "is-selected" : ""}`}
                  onClick={() => setScenario(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="hero-summary-grid">
              <div>
                <span>Selected personas</span>
                <strong>{selectedPersonas.length}</strong>
              </div>
              <div>
                <span>Custom personas</span>
                <strong>{customPersonas.length}</strong>
              </div>
              <div>
                <span>Model</span>
                <strong>{result?.usedModel ? "Gemini active" : "Ready"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid" id="analysis">
        <div className="left-column">
          <section className="floating-card card-shell reveal">
            <div className="card-core">
              <p className="eyebrow">Persona library</p>
              <div className="section-head">
                <h2>Balanced default set plus custom personas</h2>
                <p>
                  Mix default personas with your own audience definitions, clone what works, and keep a
                  persistent pack in local storage.
                </p>
              </div>

              <div className="persona-grid">
                {allPersonas.map((persona, index) => {
                  const selected = selectedIds.includes(persona.id);
                  const isCustom = index >= defaultPersonas.length;
                  return (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      selected={selected}
                      onToggle={() => setSelectedIds((current) => arrayToggle(current, persona.id))}
                      onClone={() => clonePersona(persona)}
                      onRemove={isCustom ? () => removeCustomPersona(persona.id) : undefined}
                      isCustom={isCustom}
                    />
                  );
                })}
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
                    onChange={(event) => setDraft((current) => ({ ...current, patience: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Trust</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={draft.trust}
                    onChange={(event) => setDraft((current) => ({ ...current, trust: event.target.value }))}
                  />
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
            </div>
          </section>
        </div>

        <div className="right-column" ref={resultRef}>
          <section className="floating-card card-shell reveal">
            <div className="card-core">
              <p className="eyebrow">Run status</p>
              <div className="section-head inline">
                <h2>Simulation output</h2>
                <span className="status-pill">
                  {result?.usedModel ? "Gemini 3.5 Flash active" : "Heuristic fallback ready"}
                </span>
              </div>

              <div className="summary-grid">
                <div className="summary-box">
                  <span>Mode</span>
                  <strong>{result ? result.scenario : scenario}</strong>
                </div>
                <div className="summary-box">
                  <span>Signals</span>
                  <strong>
                    {result ? `${result.pageFacts.buttonCount} buttons / ${result.pageFacts.inputCount} inputs` : "Waiting"}
                  </strong>
                </div>
                <div className="summary-box">
                  <span>Inputs</span>
                  <strong>{result ? result.pageFacts.analysisInputs.join(" + ") : "Screenshot + DOM + personas"}</strong>
                </div>
                <div className="summary-box">
                  <span>Selected</span>
                  <strong>{selectedPersonas.length}</strong>
                </div>
              </div>

              {result ? (
                <div className="score-grid">
                  <ScoreCard
                    label="Confusion"
                    value={result.scores.confusion}
                    description="Misunderstanding the page or the next step."
                  />
                  <ScoreCard
                    label="Trust risk"
                    value={result.scores.trustRisk}
                    description="Billing, confirmation, policy, or credibility signals that create doubt."
                  />
                  <ScoreCard
                    label="Abandonment"
                    value={result.scores.abandonment}
                    description="Users bailing because the flow feels too demanding or unclear."
                  />
                  <ScoreCard
                    label="Exploitability"
                    value={result.scores.exploitability}
                    description="Abuse paths, weak boundaries, or loophole-prone language."
                  />
                  <ScoreCard
                    label="Overload"
                    value={result.scores.visualOverload}
                    description="The number of simultaneous choices and how crowded the layout feels."
                  />
                  <ScoreCard
                    label="Accessibility friction"
                    value={result.scores.accessibilityFriction}
                    description="Keyboard, focus, contrast, and high-load navigation risks."
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
                    {result.findings.map((finding, index) => (
                      <span
                        key={`${finding.persona}-${index}`}
                        className={`hotspot severity-${finding.severity}`}
                        title={`${finding.persona}: ${finding.theme}`}
                        style={
                          {
                            left: `${finding.x}%`,
                            top: `${finding.y}%`,
                            "--delay": `${index * 0.05}s`
                        } as CSSProperties
                        }
                      >
                        <b>{index + 1}</b>
                        <em>{finding.theme}</em>
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
                  result.findings.map((finding, index) => <FindingCard key={`${finding.persona}-${index}`} finding={finding} index={index} />)
                ) : (
                  <div className="empty-findings">
                    <p>
                      No findings yet. Select personas, tune the dials, and run a simulation to surface
                      confusion, trust collapse, overload, and defensive abuse signals.
                    </p>
                  </div>
                )}
              </div>

              {result ? <p className="summary-copy">{result.summary}</p> : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
