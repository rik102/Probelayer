# Probelayer Runbook

## Local Setup

1. Install dependencies.
2. Ensure `.env` contains the Gemini API key and endpoint.
3. Install Chromium for Playwright.
4. Run the dev server.

## Commands

```bash
npm install
npx playwright install chromium
npm run dev
```

## Verification Checklist

- App loads without console errors
- Simulation endpoint accepts a live URL
- Gemini model call returns JSON output
- Heuristic fallback works when the model is unavailable
- Custom persona creation works
- Pen-test mode works
- Cognitive-load mode works
- Hotspots render on the screenshot

## Notes

- Keep the experience premium and motion-rich.
- Keep the visual density low-mid so the UI breathes.
- Keep the implementation complete; do not ship placeholders.

