/** Cloudflare Worker entry point for UMTennis. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { visibleUpcomingMatches } from "./upcoming-filter";

const LIVE_BUNDLE_URL = "https://raw.githubusercontent.com/umutaylcn/umtennis-api/main/data/public/live_bundle.json";
const REFRESH_AFTER_MS = 5 * 60 * 1000;

type Match = { match_id: number; start_time_utc: string; schedule_precision?: "time" | "not_before" | "date_only" | "tba" };
type LiveBundle = {
  generated_at_utc: string;
  upcoming: { count: number; matches: Match[]; predictions: Record<string, unknown> };
  previous: { count: number; matches: Array<{ match_id: number }> };
};

function validBundle(value: unknown): value is LiveBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as Partial<LiveBundle>;
  return Boolean(bundle.upcoming && Array.isArray(bundle.upcoming.matches)
    && bundle.upcoming.predictions && bundle.previous && Array.isArray(bundle.previous.matches));
}

async function fetchLiveBundle(cache: Cache, cacheKey: Request): Promise<Response> {
  const response = await fetch(LIVE_BUNDLE_URL, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Public snapshot returned ${response.status}`);
  const payload: unknown = await response.json();
  if (!validBundle(payload)) throw new Error("Invalid public snapshot");
  const cached = Response.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "X-UMTennis-Cached-At": String(Date.now()),
    },
  });
  await cache.put(cacheKey, cached.clone());
  return cached;
}

async function liveBundle(request: Request, ctx: ExecutionContext): Promise<LiveBundle | null> {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const key = new Request(new URL("/data/live-bundle-cache", request.url));
  const cached = await cache.match(key);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get("X-UMTennis-Cached-At") || 0);
    if (age > REFRESH_AFTER_MS) {
      ctx.waitUntil(fetchLiveBundle(cache, key).catch(() => undefined));
    }
    return cached.json() as Promise<LiveBundle>;
  }
  try {
    return await (await fetchLiveBundle(cache, key)).json() as LiveBundle;
  } catch {
    return null;
  }
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if ((url.pathname === "/data/upcoming.json" || url.pathname === "/data/previous.json") && request.method === "GET") {
      const bundle = await liveBundle(request, ctx);
      if (url.pathname === "/data/previous.json") {
        if (bundle) {
          return Response.json(bundle.previous, { headers: { "Cache-Control": "no-store" } });
        }
        return env.ASSETS.fetch(request);
      }

      const upcomingResponse = bundle ? null : await env.ASSETS.fetch(request);
      if (upcomingResponse && !upcomingResponse.ok) return upcomingResponse;
      const payload = bundle ? bundle.upcoming : await upcomingResponse!.json() as {
        matches: Match[];
        predictions: Record<string, unknown>;
        [key: string]: unknown;
      };
      if (!Array.isArray(payload.matches) || !payload.predictions) {
        return Response.json({ error: "Invalid upcoming snapshot" }, { status: 502 });
      }

      let previousPayload: { matches?: Array<{ match_id: number }> } | null = bundle?.previous ?? null;
      if (!previousPayload) {
        const previousResponse = await env.ASSETS.fetch(new Request(new URL("/data/previous.json", request.url)));
        if (previousResponse.ok) {
          try {
            previousPayload = await previousResponse.json() as { matches?: Array<{ match_id: number }> };
          } catch {
            // The time guard still works when the independent result asset is invalid.
          }
        }
      }
      const matches = visibleUpcomingMatches(
        payload.matches,
        Array.isArray(previousPayload?.matches) ? previousPayload.matches : [],
        Date.now(),
      );
      const predictions = Object.fromEntries(
        matches.map(match => [String(match.match_id), payload.predictions[String(match.match_id)]]),
      );
      return Response.json(
        { ...payload, count: matches.length, matches, predictions },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
