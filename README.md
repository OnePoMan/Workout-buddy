# Workout-buddy
Gamified fitness tracker. See [SPEC.md](SPEC.md) for the full specification.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest (domain + storage)
npm run typecheck
npm run build      # typecheck + production build with service worker -> dist/
npm run icons      # regenerate public/ icons from the character sprite
```

Data is stored in the browser's `localStorage` under the key `workout-buddy`.
Export/import JSON from Settings.
