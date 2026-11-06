import assert from "node:assert/strict";
import test from "node:test";
import { matchingCompletedResults } from "../worker/completed-filter.ts";

const match = { match_id: 10, p1_name: "Ben Shelton", p2_name: "Tommy Paul",
  tournament_name: "Paris", start_time_utc: "2026-11-06T13:00:00Z" };

test("only the same published fixture is hidden", () => {
  assert.deepEqual(matchingCompletedResults([match], [{ ...match, p1_name: "Tommy Paul", p2_name: "Ben Shelton" }]), [{ match_id: 10 }]);
  assert.deepEqual(matchingCompletedResults([match], [{ ...match, p2_name: "Someone Else" }]), []);
  assert.deepEqual(matchingCompletedResults([match], [{ ...match, start_time_utc: "2027-11-06T13:00:00Z" }]), []);
});
