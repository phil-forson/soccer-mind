# Soccer Mind

Evidence-first football research UI for the Soccer LLM Analyst backend.

This Next.js app is a client. It does not invent scores, dates, competitions, or highlights, and it does not run a second analyst pipeline. Football facts come from the FastAPI backend: [soccer-llm-analyst](https://github.com/phil-forson/soccer-llm-analyst.git).

## Backend dependency

Clone and run [soccer-llm-analyst](https://github.com/phil-forson/soccer-llm-analyst.git). That repository's `API_DOCS.md`, `src/models.py`, and `src/api.py` are the API contract.

Integration notes for this frontend: [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md).

Local API: `http://localhost:8000`  
Production API: `https://YOUR_VPS_API_HOST` (Caddy → FastAPI on the VPS)

The VPS backend must list this app's origin in `CORS_ORIGINS`.

## Setup

```bash
npm install
cp .env.example .env.local
```

`.env.local` needs only the public API base URL:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the backend in `soccer-llm-analyst`, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | API contract regression tests |

## Production

Set `NEXT_PUBLIC_API_URL` to the HTTPS FastAPI host at build time, for example:

```
NEXT_PUBLIC_API_URL=https://YOUR_VPS_API_HOST
```

Do not fall back to localhost in a production browser. Do not put OpenAI, YouTube, or VPS credentials in this repository. `.env.example` is public frontend config only; never commit `.env.local`.
