# Probelayer PRD

_Working title: Probelayer._

## 1. Overview

Probelayer is a synthetic human failure testing platform that runs psychologically distinct user personas against a live web flow, captures a screenshot and DOM signals, and produces behavioral risk findings about confusion, trust collapse, abandonment, accessibility friction, cognitive overload, and abuse potential.

The product exists to help teams discover pre-release UX and trust failures before real users hit them.

## 2. Problem Statement

Most QA tools answer whether a flow technically works. They do not answer:

- Will a stressed or distracted user understand the next step?
- Will a low-tech or non-native speaker interpret the UI correctly?
- Will a visually overwhelmed user be able to find the primary action?
- Will the flow create mistrust around billing, confirmation, refunds, or security?
- Will an adversarial user find a path to abuse policy gaps or confusing boundaries?

Teams usually discover these problems after launch through support tickets, analytics, session replay, or churn.

## 3. Product Goal

Probelayer should make behavioral failure simulation as easy to run as a smoke test, while producing output that is:

- Fast to interpret
- Specific enough to act on
- Grounded in the actual page state
- Useful with or without a multimodal model endpoint

## 4. Target Users

### Primary users

- Product designers
- UX researchers
- Product managers
- QA engineers
- Trust and safety teams
- Accessibility-minded teams
- Security and red-team reviewers

### Secondary users

- Founders preparing demos or launches
- Growth teams reviewing conversion funnels
- Security or fraud teams reviewing abuse-prone flows

## 5. Core Use Cases

1. Run a one-off behavioral simulation on a signup, checkout, onboarding, or settings flow.
2. Compare the same flow before and after a UI change.
3. Identify confusing labels, overloaded layouts, or trust-breaking billing language.
4. Inspect where persona-specific risks cluster on the page via visual hotspots.
5. Use a heuristic fallback when no model endpoint is configured.

## 6. Product Principles

- Behavioral, not just functional: the goal is human comprehension, trust, and completion, not only button success.
- Explainable output: every finding needs evidence and a recommendation.
- Model-optional: the product should still work in heuristic mode.
- Demo-friendly: a user should be able to understand the value in under a minute.
- Non-destructive by default: analysis should not click risky controls.

## 6.1 Presentation Dials

The interface direction for the product should be intentionally premium and distinct:

- `DESIGN_VARIANCE`: 9/10
- `MOTION_INTENSITY`: 9/10
- `VISUAL_DENSITY`: 4/10

This means:

- High layout experimentation and asymmetry
- High motion depth and reveal choreography
- Low-mid information density per viewport
- Premium, calm, expensive-feeling UI rather than a generic dashboard

## 6.2 Taste-Skill Direction

The shipped product experience should follow these taste constraints:

- High layout variance with intentional asymmetry
- Strong motion choreography with meaningful reveals and transitions
- Low to mid visual density so the interface still breathes
- Premium typography and a polished, expensive-feeling surface
- No placeholder UI, no half-finished sections, and no stub copy in the shipped experience
- Every visible surface should feel deliberate, finished, and presentation-ready

## 6.3 Design Execution Context

The implementation should explicitly be executed with these taste-skill constraints in mind:

- `gpt-taste`: stricter variance, stronger motion direction, aggressive anti-slop
- `high-end-visual-design`: polished, calm, premium surfaces with whitespace and spring motion
- `full-output-enforcement`: no placeholder sections, no partial delivery, no stubbed content

These are not just labels. They are the working rules for how the UI should be designed, built, and reviewed.

## 7. MVP Scope

### In scope

- Single URL simulation
- Persona-based analysis
- Screenshot capture with Playwright
- DOM text and interaction extraction
- Heuristic findings when no model is present
- OpenAI-compatible multimodal model support
- Severity scores and summary scores
- Visual heatmap markers over the screenshot
- Built-in demo flow for judging and presentation

### Out of scope for MVP

- Persistent run history
- Team collaboration
- Regression dashboards
- Export to PDF
- Automated UI fixes
- Multi-step scripted browsing or autonomous clicking
- Full browser recording / replay

## 8. Personas

Probelayer currently simulates these behavioral lenses:

- Low-tech older adult
- Distracted single parent
- Impatient shopper
- Non-native English speaker
- Visually overwhelmed user
- Scammer / exploit seeker
- First-time mobile user
- Security-conscious enterprise buyer
- Neurodivergent / executive-function sensitive user
- Keyboard-only accessibility user

These personas represent common failure modes:

- Low confidence with modern web patterns
- Time pressure and scanning behavior
- Friction intolerance
- Literal interpretation of text
- Sensitivity to dense layouts and competing calls to action
- Adversarial probing of policy and trust boundaries
- Executive-function load, task switching, and decision fatigue
- Keyboard traversal and focus-order friction

## 8.1 Manual Persona Authoring

Users should be able to add custom personas manually, so teams can test product-specific audiences instead of only relying on the default library.

### Manual persona fields

- Persona name
- Behavioral lens
- Primary goal
- Risk biases
- Patience level
- Trust level
- Accessibility or device constraints
- Tone / emotional style
- Pen-test intent flag
- Notes for why this persona matters

### Persona authoring requirements

- Users should be able to create, edit, clone, and delete personas.
- Users should be able to save a custom persona set for a specific product or funnel.
- Users should be able to mix default personas with custom personas in the same run.
- The UI should support a quick-create path and an advanced form path.
- The system should validate that personas are diverse enough to avoid redundant output.

## 8.2 Recommended Default Persona Set

Probelayer should ship with a balanced set of 10 personas that cover UX, trust, accessibility, and abuse testing from different angles:

1. Low-tech older adult
2. Distracted single parent
3. Impatient shopper
4. Non-native English speaker
5. Visually overwhelmed user
6. Scammer / exploit seeker
7. First-time mobile user
8. Security-conscious enterprise buyer
9. Neurodivergent / executive-function sensitive user
10. Keyboard-only accessibility user

### Why this set is balanced

- Covers reading comprehension, urgency, trust, and decision fatigue.
- Includes both everyday usability and adversarial behaviors.
- Adds an accessibility-first persona that is not just a visual overload proxy.
- Adds a B2B evaluation lens for more realistic procurement and onboarding flows.
- Adds a mobile-first lens because many failures appear only on smaller screens.
- Adds a cognitive-load lens for decision fatigue, overload, and task-switching strain.

## 8.3 Pen Test Mode

Probelayer should include a dedicated pen-test mode for safe, defensive abuse simulation.

### Pen-test goals

- Find suspiciously weak refund, trial, account, and authorization boundaries.
- Detect confusing labels that could be exploited to bypass intent.
- Flag flows that invite support manipulation or accidental privilege escalation.
- Surface repeated-action, policy, or permission risks before release.
- Simulate benign abuse patterns such as button mashing, repeated submissions, back-button thrashing, refresh loops, tab-order abuse, and navigation bypass attempts.
- Surface rate-limit, quota, session, and confirmation weaknesses in defensive testing.

### Pen-test guardrails

- Pen-test simulations must remain non-destructive by default.
- The platform should not execute real payment, deletion, or irreversible actions.
- The system should summarize risk patterns rather than attempting harmful actions.
- The UI should clearly label this as defensive testing for authorized flows only.

## 8.4 Neurodivergent and Cognitive Load Testing

Probelayer should include a dedicated accessibility and cognitive-load lens for users who are sensitive to executive-function strain, overload, or ambiguous task structure.

### What this mode should detect

- Too many buttons in the first viewport
- Competing calls to action with similar visual weight
- Hidden or delayed confirmation states
- Long forms that create memory burden
- Dense information stacking without enough breathing room
- Ambiguous next steps that increase decision fatigue

### Why it matters

- The product should not only check visual accessibility.
- It should also check whether the flow is mentally navigable.
- This is especially valuable for onboarding, checkout, settings, and account recovery flows.

## 9. Key User Journey

1. User opens the app.
2. User selects or enters a target URL.
3. User clicks Run simulation.
4. System captures the page with Playwright.
5. System extracts page facts:
   - Buttons
   - Links
   - Inputs
   - Headings
   - Visible text
   - Anchor positions
   - Interaction risk signals
6. System runs heuristic analysis and optionally multimodal model analysis.
7. System returns:
   - Summary
   - Scores
   - Persona findings
   - Visual hotspots over the page screenshot
   - Optional pen-test findings when defensive abuse mode is enabled
   - Optional cognitive-load findings for neurodivergent and executive-function-sensitive users

## 10. Functional Requirements

### 10.1 Input and targeting

- The app must accept a URL over `http` or `https`.
- The app must reject invalid or unsupported protocols.
- The app should allow quick selection of demo targets.

### 10.2 Capture and analysis

- The system must open the target URL in a headless browser.
- The system must capture a screenshot of the first viewport.
- The system must extract page text, headings, buttons, links, inputs, and anchor positions.
- The system must compute interaction signals such as:
  - Ambiguous actions
  - High-impact actions
  - Repeated action labels
  - Competing action count
  - Stress risk

### 10.3 Persona simulation

- The system must generate findings for the configured personas.
- The system should produce persona-specific language in the output.
- The system should vary severity, emotion, and recommendations per persona.
- The system should allow teams to add, edit, and save custom personas.
- The system should support a mixed run of default personas and custom personas.
- The system should support saved persona packs for product-specific audiences.

### 10.3.1 Pen-test simulation

- The system should support a defensive abuse-testing mode.
- The system should surface risks related to refunds, promotions, authorization, permissions, and support misuse.
- The system should preserve non-destructive analysis behavior.
- The system should clearly separate pen-test findings from UX findings when both are present.
- The system should report button-mashing, repeated-submit, and bypass-attempt risks as defensive resilience signals.

### 10.3.2 Cognitive-load simulation

- The system should support a neurodivergent and executive-function lens.
- The system should flag high button counts, ambiguous flows, and overload-heavy layouts.
- The system should score task-switching burden and first-viewport decision fatigue.
- The system should recommend simplification, spacing, labeling, and hierarchy improvements.

### 10.4 Multimodal reasoning

- If a compatible model endpoint is configured, the system should send:
  - Screenshot
  - Page facts
  - Persona definitions
  - Structured output instructions
- The model response must be normalized into the app schema.
- If the model call fails, the system must fall back to heuristic findings.

### 10.5 Output

- The app must show a summary of risks.
- The app must show at least five scores:
  - Confusion
  - Trust risk
  - Abandonment
  - Exploitability
  - Visual overload
- The app must show individual findings with:
  - Persona
  - Severity
  - Theme
  - Evidence
  - Recommendation
  - Emotional state
- The app must plot findings as hotspots on the screenshot.

## 11. Non-Functional Requirements

- The system should be responsive enough for live demo usage.
- The system should degrade gracefully when model inference is unavailable.
- The analysis should be deterministic enough to explain in a presentation.
- The output should be understandable to non-technical stakeholders.
- The UI should be polished enough for judging and live demos.

## 12. Success Metrics

### Product success

- A user can understand the product value within 60 seconds.
- A simulation run returns a useful result without manual tuning.
- The platform identifies at least one meaningful behavioral issue on the demo flow.
- Users can add a custom persona without developer help.
- Users can run a defensive pen-test mode on a target flow.
- Users can identify overload and cognitive-friction issues on dense layouts.

### Demo success

- The system works reliably on the built-in checkout demo.
- The app can run with heuristic fallback if the model endpoint is offline.
- The output visually communicates confusion and risk clearly.

### Future product success

- Users run the tool before launch, not after complaints.
- Teams compare multiple runs over time.
- Teams use the findings to improve conversion, trust, accessibility, and abuse resistance.

## 13. Current Implementation Snapshot

The current codebase already supports:

- A Next.js frontend for running simulations
- A `/api/simulate` endpoint
- Playwright screenshot capture
- Heuristic risk scoring and persona findings
- OpenAI-compatible multimodal model integration
- A built-in demo checkout flow
- A no-install static demo path

## 14. Risks and Constraints

### Technical risks

- Model endpoints may be unavailable or slow.
- Some targets may block headless browsers or require auth.
- DOM heuristics can misread complex layouts.
- Screenshot-only reasoning may miss deeper workflow context.

### Product risks

- The idea could be mistaken for generic QA if the messaging is too technical.
- Findings must feel actionable, not like random LLM commentary.
- Strong demo value is required because the category is novel.

### Safety and trust risks

- Analysis should remain non-destructive by default.
- The platform should avoid encouraging harmful probing beyond legitimate testing.

## 15. MVP Acceptance Criteria

The MVP is successful when:

- A user can enter a URL and complete a run.
- The system returns a screenshot, summary, scores, and at least several findings.
- The findings are tied to visible page content and not generic filler.
- The app works in both model and fallback modes.
- The built-in demo flow clearly demonstrates the problem space.

## 16. Roadmap

### Phase 1

- Single-run analysis
- Heuristic fallback
- Model-backed reasoning
- Demo flow
- Manual persona editor
- Default 10-persona library
- Defensive pen-test mode
- Cognitive-load / neurodivergence mode
- Design dials reflected in the UI

### Phase 1.5

- Before/after comparison on the same target
- Persona set templates per product type
- Saved persona collections
- Button-density and overload scoring improvements

### Phase 2

- Run history
- Exportable report
- Before/after comparison
- Batch simulation across multiple URLs
- Accessibility mode with keyboard and contrast checks
- Mobile viewport simulation
- Persona coverage meter showing which user types are underrepresented
- Navigation-thrash and repeated-submit detection

### Phase 3

- Multi-step flows
- Private flow support
- Team workspaces
- Scheduled regression checks
- Deeper trust and safety analytics
- Scenario marketplace for reusable test packs
- Policy-aware trust boundary analyzer
- Launch readiness score for executive review
- Red-team scenario library for defensive resilience testing
- Cross-funnel comparison dashboard
- Exportable evidence packs for design reviews and security reviews

## 16.1 Unique Differentiators

Probelayer can become more distinctive by adding:

- Persona coverage heatmaps that show which audience segments were tested and which are missing.
- Before/after regression diffs that explain how a UI change improved or worsened trust and confusion.
- A challenge mode that asks the system to generate the hardest failure cases for a given flow.
- Accessibility-first simulations that combine keyboard-only navigation, reduced motion, and low-vision checks.
- A launch readiness score that rolls up UX, trust, and abuse risk into one executive-friendly metric.
- A persona marketplace or template library for common industries such as SaaS, ecommerce, fintech, and enterprise onboarding.
- Annotated evidence exports that let teams paste findings directly into design reviews or issue trackers.
- Product-type presets that automatically select relevant personas for checkout, signup, trial, or settings flows.
- A defensive resilience score focused on button mashing, repeated submits, and bypass attempts.
- A cognitive-load score that specifically models decision fatigue and overload in dense interfaces.
- A persona pack builder that lets teams save their own audience definitions per product.
- A security-review mode that packages abuse findings separately from general UX findings.

## 17. Open Questions

- Should the product prioritize UX, trust, or abuse detection in the default presentation?
- Should outputs be tailored for designers, PMs, or security teams first?
- Should users be able to define custom personas?
- Should the product support authenticated flows in the next milestone?
- Should run history be stored locally first or in a shared backend?

## 18. Positioning Statement

Probelayer is synthetic human testing for behavioral failure simulation. It helps teams find confusion, mistrust, overload, abandonment, cognitive strain, and abuse risks before launch by combining persona modeling, Playwright capture, and multimodal page reasoning.
