# Backend integration

This document is a **frontend integration guide**. It is not a competing API specification.

The authoritative contract lives in [soccer-llm-analyst](https://github.com/phil-forson/soccer-llm-analyst.git):

- [`API_DOCS.md`](https://github.com/phil-forson/soccer-llm-analyst/blob/main/API_DOCS.md)
- `src/models.py`
- `src/api.py`
- `src/config.py`

If this file and those sources disagree, trust the backend.

## Topology

### Local development

```
Browser (http://localhost:3000)
  → FastAPI (http://localhost:8000)
```

Run the backend from `soccer-llm-analyst` (`python run_api.py` or `uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload`). Run this app with `npm run dev`.

Development CORS on the backend defaults to `*` with credentials disabled, so a local browser origin can call the API directly.

### Production

```
Browser
  → Caddy HTTPS (https://YOUR_VPS_API_HOST)
  → FastAPI (container :8000)
```

The VPS stack is `soccer-llm-analyst/deploy/docker-compose.prod.yml` plus `deploy/Caddyfile`. Caddy terminates TLS and reverse-proxies to the API. The frontend talks to FastAPI over HTTPS. There is no Next.js API proxy/BFF in this integration.

## Frontend configuration

One configuration boundary: `NEXT_PUBLIC_API_URL`.

| Environment | Value |
|---|---|
| Local | `http://localhost:8000` |
| Production | `https://YOUR_VPS_API_HOST` |

Normalize the base URL in one place and strip a trailing slash. Do not hardcode hosts at call sites.

Production builds must set an HTTPS URL. Do **not** silently fall back to `http://localhost:8000` in a production browser.

See [`.env.example`](../.env.example). Never put `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, VPS SSH credentials, Hetzner tokens, or backend `.env` contents in this app.

## Backend CORS

The backend reads `CORS_ORIGINS` (comma-separated origins) from `soccer-llm-analyst` configuration.

- Development, unset: `*` (credentials off).
- Production, unset/empty: no browser CORS. curl still works; the deployed UI will fail.
- Production must list the deployed frontend origin, for example:

```
CORS_ORIGINS=https://YOUR_FRONTEND_ORIGIN
```

The VPS backend must include the origin this Next.js app is served from.

## Endpoints the UI uses

Confirm request and response fields in `soccer-llm-analyst/API_DOCS.md` before coding.

### `GET /health`

Liveness check. Response shape: `{ "status": "healthy", "version": "..." }`.

### `POST /query/stream`

Main ask. Same JSON body as `/query`:

```json
{
  "query": "string",
  "include_highlights": true,
  "emphasize_order": false,
  "gender": "men"
}
```

`include_highlights` may be omitted (`null`) so the backend auto-detects. `gender` is `"men"` | `"women"` | `"any"`.

Use `fetch` + `ReadableStream` (not `EventSource`). The stream emits thinking stages (`query_parser`, `web_search`, `highlights`), then a result payload, then `[DONE]`. `/query` and `/query/stream` do **not** run deep game analysis. `game_analysis` is null on this path.

Application errors are often HTTP 200 with `type: "result"` and `success: false`. Map `query_not_relevant`, `no_match_found`, `rate_limited`, `openai_quota_exceeded`, `missing_query`, and unknown codes.

### `POST /analyze`

Opt-in deep analysis. Same request body as `/query`. Call it only after the user asks and a match result has sufficient verified evidence. Treat the analysis as interpretation, not extra verified facts.

## Request IDs

Every JSON `/query` and `/analyze` response includes `request_id`. The same value is returned as `X-Request-ID`. Clients may send `X-Request-ID` (8–128 chars, `[A-Za-z0-9._-]`) to correlate retries. Retain the id for debugging. Do not retry an expensive query in a loop.

## Evidence-state rendering

`match_metadata.evidence_status` includes `finished`, `scheduled`, `insufficient`, and `conflicting`.

| State | UI |
|---|---|
| `finished` with a verified score | Score card from API fields only. Do not invent "Full Time" or "Today". |
| `scheduled` with teams + date | Upcoming fixture. No invented score or live ticker. |
| `insufficient` or `conflicting` | Honest evidence state. Do not show a manufactured result. |
| `no_match_found` on a match-oriented query | Useful no-match state. |
| Non-match intent (standings, fixtures, news, player info, stats) | Summary + sources. No match card required. |

Sources come only from structured `sources[]` (`id`, `url`, `title`, `domain`). Never scrape URLs from `summary`. Hide highlights when `highlights[]` is empty.

## Troubleshooting

### CORS

Browser console shows a CORS error. Confirm the frontend origin is listed in backend `CORS_ORIGINS` on the VPS. Production with an empty list rejects browser calls.

### HTTPS

Production must use `https://YOUR_VPS_API_HOST`. Mixed content (HTTPS page → HTTP API) will fail.

### Localhost fallback

A production build that falls back to `http://localhost:8000` will look "broken" for real users. Set `NEXT_PUBLIC_API_URL` at build time and fail closed if it is missing or not HTTPS.

### SSE

`EventSource` cannot POST. Use `fetch` + `ReadableStream`. Parse event blocks separated by blank lines; normalize CRLF. Proxies must not buffer the stream (`X-Accel-Buffering: no` is already set by the backend). Stop on `[DONE]`.

### 429 / rate limiting

The backend limits about 10 requests / 60 seconds per client IP. The stream may return `success: false` and `error: "rate_limited"` rather than a raw HTTP 429. Show that error. Do not retry in a tight loop.
