import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      IMAGES: {
        input: () => ({
          transform: () => ({
            output: async () => ({ response: () => new Response() }),
          }),
        }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the UMTennis application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>UMTennis.*ATP Match Predictions<\/title>/i);
  assert.match(html, /UMTennis/);
  assert.match(html, /Yaklaşan Maçlar|Upcoming Matches/);
  assert.match(html, /Maçlar yükleniyor|Loading matches/);
  assert.doesNotMatch(html, /vinext-starter|Starter Project/i);
});

test("keeps production API and model presentation in source", async () => {
  const [dashboard, layout] = await Promise.all([
    readFile(new URL("../app/MatchDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /https:\/\/umtennis-api\.onrender\.com/);
  assert.match(dashboard, /fetch\(`\$\{API_BASE\}\/api\/matches`/);
  assert.match(dashboard, /match-loading-inline/);
  assert.match(dashboard, /match-loading-ball/);
  assert.match(dashboard, /"Jakub Mensik":"110"/);
  assert.doesNotMatch(dashboard, /match-loading-spinner/);
  assert.match(dashboard, /loadingPercent/);
  assert.doesNotMatch(dashboard, /match-loading-card|match-loading-track/);
  assert.match(dashboard, /setLoadAttempt\(current=>current\+1\)/);
  assert.doesNotMatch(dashboard, /fetch\("\/data\/upcoming\.json"/);
  assert.match(dashboard, /view!=="previous"\|\|previousRequested\.current/);
  assert.match(dashboard, /XGBoost/);
  assert.match(dashboard, /Logistic Regression/);
  assert.match(dashboard, /Accuracy by year/i);
  assert.match(layout, /UMTennis.*ATP Match Predictions/);
});

test("ships the generated upcoming snapshot as a static asset", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../public/data/upcoming.json", import.meta.url), "utf8"));
  assert.equal(snapshot.count, snapshot.matches.length);
  assert.ok(Number.isFinite(Date.parse(snapshot.generated_at_utc)));
  assert.ok(snapshot.matches.every(match => Number.isFinite(Date.parse(match.start_time_utc))));
});

test("loading ball keeps its silhouette fixed while surface seams move", async () => {
  const [css, ball] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/loading-tennis-ball-3d.svg", import.meta.url), "utf8"),
  ]);
  assert.match(css, /loading-tennis-ball-3d\.svg/);
  assert.doesNotMatch(css, /tennis-ball-roll/);
  assert.match(ball, /attributeName="d"/);
  assert.match(ball, /url\(#volume\)/);
});
