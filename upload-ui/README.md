# S3 Multipart Upload UI

React + Tailwind frontend for the presigned-S3 multipart upload service.

## Stack

- **React 18** + **React Router v6**
- **Tailwind CSS 3** with a custom dark design system
- **Zustand** for global upload state
- **Framer Motion** for animated upload cards
- **react-dropzone** for file drag-and-drop
- **axios** for HTTP + retry logic
- **react-hot-toast** for notifications
- **lucide-react** for icons
- **Vite** for bundling

## Quick start

```bash
cp .env.example .env          # set VITE_API_BASE if not localhost:8000
npm install
npm run dev                   # http://localhost:3000
```

With LocalStack running (from the backend repo):

```bash
# Terminal 1 — backend
cd ../s3_upload_api && make up

# Terminal 2 — frontend
npm run dev
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | New upload | Dropzone, config sliders, start |
| `/active` | Active uploads | Live progress cards with per-part detail |
| `/history` | History | Searchable table of completed sessions |
| `/security` | Security | Controls, checklist, cleanup trigger |
| `/settings` | Settings | Token, API URL, connection test |

## Auth

Set your token in **Settings**:
- JWT: paste the full `eyJ…` token (no "Bearer" prefix needed — the app adds it)
- API Key: `devkey-1` or `devkey-2` (LocalStack defaults)

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # serve the dist/ build locally
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `''` (empty = same origin) | FastAPI base URL |
