# Probelayer

Probelayer is a synthetic human failure testing platform for pre-release UX, trust, accessibility, cognitive load, and defensive pen-testing.

The current dashboard runs a dual-wing supervisor:

- UX Suite for confusion, trust, accessibility, and overload
- Red Team Suite for button mashing, repeated submits, bypass attempts, and defensive abuse checks

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy the env template and paste your Gemini API key:

```bash
cp .env.example .env
```

3. Install the browser runtime:

```bash
npx playwright install chromium
```

4. Start the app:

```bash
npm run dev
```

## Model setup

- `OPENAI_COMPAT_CHAT_URL` should point at an OpenAI-compatible Gemini endpoint.
- `OPENAI_COMPAT_API_KEY` should contain your Gemini API key.
- `VISION_MODEL` is set to `gemini-3.5-flash` by default.

## Dashboard tabs

- `Dashboard` runs the concurrent supervisor and shows wing-separated findings.
- `GitHub` lists repositories server-side with a GitHub token so you can stage future CI/CD runs.
- `Assistant` suggests persona packs from a product description and lets you accept or discard them.

## What Probelayer does

- Captures a live page with Playwright
- Extracts DOM facts and interaction signals
- Runs persona-based failure simulation
- Runs UX and red-team suites concurrently through a central supervisor
- Supports heuristic fallback if no model endpoint is available
- Displays findings as scores, summaries, and visual hotspots
