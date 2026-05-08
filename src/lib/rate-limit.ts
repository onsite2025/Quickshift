import "server-only";
import { NextRequest, NextResponse } from "next/server";

// Rate limiter for portal endpoints. Uses Vercel KV via its REST API when
// KV_REST_API_URL + KV_REST_API_TOKEN are set; otherwise falls back to a
// per-process in-memory store. KV is preferred in production because it
// survives serverless cold starts and is shared across regions; in-memory
// is "good enough" against accidental spam but resets ~every 15 min and
// won't stop a determined attacker.

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);

const kvFetch = async (path: string): Promise<unknown> => {
  const res = await fetch(`${KV_URL}/${path}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${path} -> ${res.status}`);
  return res.json();
};

const kvIncr = async (key: string): Promise<number> => {
  const data = (await kvFetch(`incr/${encodeURIComponent(key)}`)) as { result: number };
  return data.result;
};

const kvExpire = async (key: string, seconds: number): Promise<void> => {
  await kvFetch(`expire/${encodeURIComponent(key)}/${seconds}`);
};

export const rateLimit = async ({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> => {
  const now = Date.now();
  const resetAt = now + windowMs;
  const ttl = Math.ceil(windowMs / 1000);

  if (KV_ENABLED) {
    try {
      const count = await kvIncr(key);
      if (count === 1) await kvExpire(key, ttl);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch (err) {
      console.error("rate-limit: KV failure, falling back to memory", err);
      // fall through to in-memory
    }
  }

  const existing = memoryStore.get(key);
  if (existing && existing.resetAt > now) {
    existing.count++;
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      resetAt: existing.resetAt,
    };
  }
  memoryStore.set(key, { count: 1, resetAt });
  return { allowed: true, remaining: limit - 1, resetAt };
};

interface EnforceOptions {
  token: string;
  endpoint: string;
  // Per-token limit. Per-IP limit is 4x this value to accommodate legit
  // traffic from offices behind a NAT.
  limit: number;
  windowMs?: number;
}

export const enforcePortalRateLimit = async (
  req: NextRequest,
  options: EnforceOptions,
): Promise<NextResponse | null> => {
  const windowMs = options.windowMs ?? 60_000;
  const ipRaw =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = ipRaw.split(",")[0]!.trim();

  const [tokenRes, ipRes] = await Promise.all([
    rateLimit({
      key: `rl:${options.endpoint}:t:${options.token}`,
      limit: options.limit,
      windowMs,
    }),
    rateLimit({
      key: `rl:${options.endpoint}:ip:${ip}`,
      limit: options.limit * 4,
      windowMs,
    }),
  ]);

  if (tokenRes.allowed && ipRes.allowed) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((Math.max(tokenRes.resetAt, ipRes.resetAt) - Date.now()) / 1000),
  );
  return NextResponse.json(
    { error: "Too many requests. Try again in a moment." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
};
