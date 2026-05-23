# Probelayer

Probelayer is a synthetic human failure testing platform for pre-release UX, trust, accessibility, cognitive load, and defensive pen-testing.

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

## What Probelayer does

- Captures a live page with Playwright
- Extracts DOM facts and interaction signals
- Runs persona-based failure simulation
- Supports heuristic fallback if no model endpoint is available
- Displays findings as scores, summaries, and visual hotspots

