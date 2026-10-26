import assert from "node:assert/strict";
import test from "node:test";

import { matchesSearch } from "../app/search.ts";

const fields=["Jakub Menšík","Lukas Neumayer","Vienna"];

test("search ignores diacritics in either direction",()=>{
  assert.equal(matchesSearch("mensik",fields),true);
  assert.equal(matchesSearch("Menšík",["Jakub Mensik","Vienna"]),true);
  assert.equal(matchesSearch("neumayer",fields),true);
});

test("search tolerates small player-name typos",()=>{
  assert.equal(matchesSearch("mensk",fields),true);
  assert.equal(matchesSearch("menisik",fields),true);
  assert.equal(matchesSearch("jakub neumaier",fields),true);
});

test("search preserves partial and multi-field matching",()=>{
  assert.equal(matchesSearch("mens",fields),true);
  assert.equal(matchesSearch("mensik vienna",fields),true);
  assert.equal(matchesSearch("   ",fields),true);
});

test("search does not turn short or unrelated queries into broad fuzzy matches",()=>{
  assert.equal(matchesSearch("ru",fields),false);
  assert.equal(matchesSearch("federer",fields),false);
  assert.equal(matchesSearch("menz",fields),false);
});
