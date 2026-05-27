# SolarFit 3D

## Cursor Cloud specific instructions

### Overview

SolarFit 3D is a React + Vite frontend with a Node.js/Express API backend for solar panel planning on rooftops. See `README.md` for full product context.

### Running in development

```bash
npm run dev
```

This starts both services concurrently:
- **Frontend** (Vite + React): http://127.0.0.1:5173 — proxies `/api` to the backend
- **API** (Express via tsx): http://127.0.0.1:3001 — handles photo uploads, reconstruction jobs, serves 3D assets

### Key caveats

- **No database required.** Job state is in-memory (`server/reconstructionStore.ts`); uploaded files persist on disk under `data/reconstructions/`.
- **COLMAP is optional.** The photogrammetry engine (COLMAP) is not installed in this environment. The app handles this gracefully — uploads succeed and return `errorCode: "ENGINE_MISSING"` when the 3D reconstruction step runs. All other functionality works normally.
- **No lint script defined.** Use `npx tsc --noEmit` for type checking the `src/` directory (the tsconfig only includes `src`). Server files under `server/` are transpiled at runtime by `tsx`.
- **No test framework configured.** There are no automated test scripts in this repository yet.
- **Build command:** `npm run build` (runs `tsc && vite build`, outputs to `dist/`).
- **Electron (desktop) mode** requires macOS and is not available in this Linux environment. Use `npm run dev` for the web-based development workflow.
