import assert from "node:assert/strict";
import test from "node:test";
import { visibleUpcomingMatches } from "../worker/upcoming-filter.ts";

const hour = 60 * 60 * 1000;
const now = Date.parse("2026-11-06T20:00:00Z");

function match(id, hoursBefore, precision = "time") {
  return {
    match_id: id,
    start_time_utc: new Date(now - hoursBefore * hour).toISOString(),
    schedule_precision: precision,
  };
}

test("verified results disappear immediately, even during the start-time grace period", () => {
  const matches = [match(1, 1), match(2, 1)];
  assert.deepEqual(visibleUpcomingMatches(matches, [{ match_id: 1 }], now), [matches[1]]);
});

test("precise starts allow live/delayed matches briefly but never indefinitely", () => {
  const matches = [match(1, 2.9), match(2, 3.1), match(3, -1)];
  assert.deepEqual(visibleUpcomingMatches(matches, [], now), [matches[0], matches[2]]);
});

test("uncertain schedules get a wider safety window", () => {
  const matches = [match(1, 11, "not_before"), match(2, 13, "not_before"), match(3, 35, "date_only"), match(4, 37, "date_only")];
  assert.deepEqual(visibleUpcomingMatches(matches, [], now), [matches[0], matches[2]]);
});

test("invalid fixture dates cannot remain stuck on the site", () => {
  assert.deepEqual(visibleUpcomingMatches([{ match_id: 1, start_time_utc: "bad date" }], [], now), []);
});
