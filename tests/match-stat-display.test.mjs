import assert from "node:assert/strict";
import test from "node:test";
import { CAREER_METRICS, formatMatchStat } from "../app/match-stat-display.ts";

test("career stats use fixed decimals and percentages already on the 0–100 scale", () => {
  const values = [8.4, 2.8 + .3, 62 + 8.4 * .65, 34 + 2 * .65, 59 + 6 * .85];
  assert.deepEqual(CAREER_METRICS.map(({suffix}, i) => formatMatchStat(values[i], suffix, 2)),
    ["8.40", "3.10", "67.46%", "35.30%", "64.10%"]);
  assert.equal(formatMatchStat(0, "%", 2), "0.00%");
});

test("missing stats stay unreported and H2H counts stay whole", () => {
  assert.equal(formatMatchStat(null, "%", 2), "—");
  assert.equal(formatMatchStat(NaN, "%", 2), "—");
  assert.equal(formatMatchStat(3), "3");
});
