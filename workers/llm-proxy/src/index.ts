type Env = {
  OPENAI_API_KEY: string;
  PROXY_AUTH_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
};

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://localhost:8800',
  'https://lifely.thirdplane.io',
];

const ALLOWED_MODELS = new Set(['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano']);
const GPT52_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh']);
const MINI_EFFORTS = new Set(['minimal', 'low', 'medium', 'high']);

function parseAllowedOrigins(envValue: string | undefined): string[] {
  if (!envValue) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return true; // curl / no origin
  return allowed.includes(origin);
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  return token || null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeReasoningEffort(model: string, effortRaw: unknown): string {
  const isMiniOrNano = model.includes('mini') || model.includes('nano');
  if (typeof effortRaw !== 'string') {
    return isMiniOrNano ? 'minimal' : 'low';
  }

  if (isMiniOrNano) {
    if (effortRaw === 'none') return 'minimal';
    if (effortRaw === 'xhigh') return 'high';
    return MINI_EFFORTS.has(effortRaw) ? effortRaw : 'low';
  }

  // gpt-5.2 supports: none | low | medium | high | xhigh (not minimal)
  if (effortRaw === 'minimal') return 'low';
  return GPT52_EFFORTS.has(effortRaw) ? effortRaw : 'low';
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): Headers {
  const headers = new Headers();
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!isOriginAllowed(origin, allowedOrigins)) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    const requiredToken = env.PROXY_AUTH_TOKEN?.trim();
    if (requiredToken) {
      const provided = getBearerToken(request);
      if (!provided || provided !== requiredToken) {
        return new Response('Unauthorized', { status: 401, headers: cors });
      }
    }

    if (!env.OPENAI_API_KEY) {
      return new Response('Server misconfigured (missing OPENAI_API_KEY)', {
        status: 500,
        headers: cors,
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request (invalid JSON)', { status: 400, headers: cors });
    }

    const model =
      typeof body?.model === 'string' && ALLOWED_MODELS.has(body.model)
        ? body.model
        : 'gpt-5.2';
    const input = typeof body?.input === 'string' ? body.input : null;
    if (!input) {
      return new Response('Bad Request (missing input)', { status: 400, headers: cors });
    }

    const effortRaw = body?.reasoning?.effort;
    const effort = normalizeReasoningEffort(model, effortRaw);
    const verbosityRaw = body?.text?.verbosity;
    const verbosity = typeof verbosityRaw === 'string' ? verbosityRaw : 'low';

    const maxOutputTokens = clampInt(body?.max_output_tokens, 1, 2400, 1600);

    const openaiBody = {
      model,
      input,
      reasoning: { effort },
      text: { verbosity },
      max_output_tokens: maxOutputTokens,
    };

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiBody),
    });

    const headers = new Headers(cors);
    headers.set('Cache-Control', 'no-store');
    headers.set('Content-Type', 'application/json');

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
