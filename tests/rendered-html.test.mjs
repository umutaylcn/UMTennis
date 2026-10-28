import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { rotatePoint, seamPoint, visibleSeam } from "../app/tennisBallGeometry.ts";

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
  assert.match(html, /fixture-column is-loading/);
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
  assert.match(dashboard, /fixture-column\$\{status==="loading"\?" is-loading"/);
  assert.match(dashboard, /status!=="loading"&&<div className="fixture-heading"/);
  assert.match(dashboard, /match-loading-caption/);
  assert.match(dashboard, /LoadingTennisBall/);
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

test("loading ball projects a rotating 3D seam onto the visible hemisphere", async () => {
  const [css, ball] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/LoadingTennisBall.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /match-loading-ball canvas/);
  assert.match(css, /\.fixture-column\.is-loading\{position:fixed;inset:0/);
  assert.match(css, /\.fixture-column\.is-loading \.fixture-list\{display:none\}/);
  assert.doesNotMatch(css, /\.fixture-column\.is-loading \.match-loading-ball:before\{/);
  assert.match(css, /\.fixture-column\.is-loading \.match-loading-ball canvas\{width:50px;height:50px/);
  assert.match(css, /@media\(min-width:761px\)\{[\s\S]*?match-loading-ball canvas\{width:64px;height:64px\}/);
  assert.match(css, /@keyframes tennis-ball-bounce-desktop\{[\s\S]*?translateY\(-180px\)/);
  assert.match(css, /@media\(min-width:761px\)\{[\s\S]*?animation-name:tennis-ball-bounce-desktop/);
  assert.match(css, /@media\(min-width:761px\)\{[\s\S]*?match-loading-inline\{gap:22px;transform:translateY\(50px\)/);
  assert.match(css, /@media\(max-width:760px\)\{[\s\S]*?match-loading-ball:after\{[^}]*rgba\(201,255,69,\.55\)[^}]*box-shadow:/);
  assert.doesNotMatch(css, /tennis-ball-roll/);
  assert.match(css, /tennis-ball-shadow/);
  assert.match(css, /height:17px;flex:none/);
  assert.match(css, /width:30px;height:7px;.*box-shadow:/);
  assert.match(ball, /requestAnimationFrame/);
  assert.match(ball, /visibleSeam\(angle\)/);
  assert.match(ball, /prefers-reduced-motion/);

  for (const angle of [0, 0.4, 1.1, 2.2, 3.7, 5.8]) {
    for (let index = 0; index < 256; index += 1) {
      const point = rotatePoint(seamPoint((index / 256) * Math.PI * 2), angle);
      assert.ok(Math.abs(Math.hypot(point.x, point.y, point.z) - 1) < 1e-10);
    }
    const segments = visibleSeam(angle);
    assert.ok(segments.length > 0);
    for (const segment of segments) {
      assert.ok(segment.length > 1);
      assert.ok(segment.every(point => point.z >= -1e-10));
      assert.ok(segment.every(point => Math.hypot(point.x, point.y) <= 1.0001));
    }
  }
});
