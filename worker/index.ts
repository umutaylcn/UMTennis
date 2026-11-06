/** Cloudflare Worker entry point for UMTennis. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { visibleUpcomingMatches } from "./upcoming-filter";

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
        matches: Array<{ match_id: number; start_time_utc: string; schedule_precision?: "time" | "not_before" | "date_only" | "tba" }>;
        predictions: Record<string, unknown>;
        [key: string]: unknown;
      };
      if (!Array.isArray(payload.matches) || !payload.predictions) {
        return Response.json({ error: "Invalid upcoming snapshot" }, { status: 502 });
      }

      const previousResponse = await env.ASSETS.fetch(new Request(new URL("/data/previous.json", request.url)));
      let previousPayload: { matches?: Array<{ match_id: number }> } | null = null;
      if (previousResponse.ok) {
        try {
          previousPayload = await previousResponse.json() as { matches?: Array<{ match_id: number }> };
        } catch {
          // The time guard still works when the independent result asset is invalid.
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
