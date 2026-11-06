/** Cloudflare Worker entry point for UMTennis. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { visibleUpcomingMatches } from "./upcoming-filter";
import { matchingCompletedResults } from "./completed-filter";

const COMPLETED_FEED_URL = "https://api.github.com/repos/umutaylcn/umtennis-api/contents/data/public/completed_fixtures.json?ref=main";
const REFRESH_AFTER_MS = 5 * 60 * 1000;

type Match = { match_id: number; start_time_utc: string; p1_name: string; p2_name: string;
  tournament_name: string; schedule_precision?: "time" | "not_before" | "date_only" | "tba" };
type CompletedFeed = { completed: Match[] };

function validCompletedFeed(value: unknown): value is CompletedFeed {
  if (!value || typeof value !== "object") return false;
  const feed = value as Partial<CompletedFeed>;
  return Array.isArray(feed.completed) && feed.completed.every(item =>
    typeof item.match_id === "number" && typeof item.start_time_utc === "string"
    && typeof item.p1_name === "string" && typeof item.p2_name === "string"
    && typeof item.tournament_name === "string");
}

async function fetchCompletedFeed(cache: Cache, cacheKey: Request): Promise<Response> {
  const response = await fetch(COMPLETED_FEED_URL, {
    signal: AbortSignal.timeout(3000),
    headers: { "Accept": "application/vnd.github.raw+json", "User-Agent": "UMTennis-site" },
  });
  if (!response.ok) throw new Error(`Completed fixture feed returned ${response.status}`);
  const payload: unknown = await response.json();
  if (!validCompletedFeed(payload)) throw new Error("Invalid completed fixture feed");
  const cached = Response.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "X-UMTennis-Cached-At": String(Date.now()),
    },
  });
  await cache.put(cacheKey, cached.clone());
  return cached;
}

async function completedFeed(request: Request, ctx: ExecutionContext): Promise<CompletedFeed | null> {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const key = new Request(new URL("/data/completed-fixtures-cache-v2", request.url));
  const cached = await cache.match(key);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get("X-UMTennis-Cached-At") || 0);
    if (age > REFRESH_AFTER_MS) {
      ctx.waitUntil(fetchCompletedFeed(cache, key).catch(() => undefined));
    }
    return cached.json() as Promise<CompletedFeed>;
  }
  try {
    return await (await fetchCompletedFeed(cache, key)).json() as CompletedFeed;
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

    if (url.pathname === "/data/upcoming.json" && request.method === "GET") {
      const upcomingResponse = await env.ASSETS.fetch(request);
      if (!upcomingResponse.ok) return upcomingResponse;
      const payload = await upcomingResponse.json() as {
        matches: Match[];
        predictions: Record<string, unknown>;
        [key: string]: unknown;
      };
      if (!Array.isArray(payload.matches) || !payload.predictions) {
        return Response.json({ error: "Invalid upcoming snapshot" }, { status: 502 });
      }

      let previousPayload: { matches?: Array<{ match_id: number }> } | null = null;
      const previousResponse = await env.ASSETS.fetch(new Request(new URL("/data/previous.json", request.url)));
      if (previousResponse.ok) {
        try {
          previousPayload = await previousResponse.json() as { matches?: Array<{ match_id: number }> };
        } catch {
          // The time guard still works when the independent result asset is invalid.
        }
      }
      const completed = await completedFeed(request, ctx);
      const confirmedResults = completed
        ? matchingCompletedResults(payload.matches, completed.completed) : [];
      const matches = visibleUpcomingMatches(
        payload.matches,
        [...(Array.isArray(previousPayload?.matches) ? previousPayload.matches : []), ...confirmedResults],
        Date.now(),
      );
      const predictions = Object.fromEntries(
        matches.map(match => [String(match.match_id), payload.predictions[String(match.match_id)]]),
      );
      return Response.json(
        { ...payload, count: matches.length, matches, predictions },
        { headers: { "Cache-Control": "no-store",
          "X-UMTennis-Completed-Feed": String(completed?.completed.length ?? -1) } },
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
