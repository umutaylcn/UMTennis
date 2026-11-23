import assert from "node:assert/strict";
import test from "node:test";

import { previousTournamentName } from "../app/tournament-display.ts";

test("Turin playoff source label shares one Previous tournament name",()=>{
  assert.equal(previousTournamentName("Finals - Turin"),"Finals - Turin");
  assert.equal(previousTournamentName("Finals - Turin ATP - Play Offs (indoor)"),"Finals - Turin");
  assert.equal(previousTournamentName("Finals - Turin ATP - Play Offs"),"Finals - Turin");
  assert.equal(previousTournamentName("Stockholm"),"Stockholm");
});
