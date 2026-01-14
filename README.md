# Interactive Model Analysis Workbench (Frontend)

React + TypeScript + Vite UI for browsing Jupyter contents and interacting with notebooks.

## Prerequisites

- Node.js 18+ (recommended) and npm
- A running JupyterHub/Jupyter Server instance (this repo’s Docker backend typically runs at `http://localhost:8000`)

## Setup

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`).

## Build

```bash
npm run build
```

## Preview (production build)

```bash
npm run preview
```

## How it connects to Jupyter

This frontend talks to Jupyter using:

- REST APIs (via React Query): contents + sessions
- WebSocket kernel channels: live cell execution output

During development, requests to `/jupyter/*` are proxied by Vite to your backend.

### REST

- `/api/contents/...` for listing, reading, creating, renaming, deleting
- `/api/sessions` for creating a session (kernel) for notebook execution

### WebSocket

- `/api/kernels/{kernelId}/channels?session_id=...` for executing code and streaming output

The WebSocket execution implementation is in `src/api/jupyter/kernelWs.ts`.

## Environment variables (optional)

Create a `.env.local` in this folder to override defaults:

- `VITE_JUPYTER_HUB_BASE_URL` (default: `http://localhost:8000/hub/api`)
- `VITE_JUPYTER_SERVER_BASE_URL` (default: `http://localhost:8000/user/admin/`)
- `VITE_JUPYTER_TOKEN` (default: empty)

## Useful commands

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Troubleshooting

### “Port 5173 already in use”

Stop the other Vite dev server instance and re-run `npm run dev`.

### API calls failing / 404s under `/jupyter`

- Confirm your backend is running and reachable (commonly `http://localhost:8000`).
- Confirm Vite proxy configuration in `vite.config.ts`.

### WebSocket execution not returning output

- Ensure a kernel session is successfully created (REST `/api/sessions`).
- Check browser devtools Network → WS for the kernel channels connection.

### Hook rule errors (React)

If you see errors like “Rendered more hooks than during the previous render”, ensure hooks are not called conditionally (e.g. not after early returns).

## Design

See DESIGN.md in this same folder for architectural decisions (Zustand store, WebSocket strategy, and component breakdown).
