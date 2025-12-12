# Lifely LLM Proxy (Cloudflare Worker)

This Worker proxies requests to OpenAI’s `POST /v1/responses` so the browser never holds an OpenAI API key.

## Environment variables

- `OPENAI_API_KEY` (secret, required)
- `PROXY_AUTH_TOKEN` (secret, optional) — if set, requests must include `Authorization: Bearer <token>`
- `ALLOWED_ORIGINS` (optional) — comma-separated list of allowed `Origin` values (e.g. `http://localhost:5173,https://lifely.thirdplane.io`)

## Local dev

```bash
cd workers/llm-proxy
wrangler dev
```

## Deploy

```bash
cd workers/llm-proxy
wrangler secret put OPENAI_API_KEY
wrangler secret put PROXY_AUTH_TOKEN   # optional
wrangler deploy
```

## Client config

Set these in `lifely-web-react/.env`:

- `VITE_LLM_PROXY_URL` → your deployed Worker URL
- `VITE_LLM_PROXY_TOKEN` → matches `PROXY_AUTH_TOKEN` (if set)

