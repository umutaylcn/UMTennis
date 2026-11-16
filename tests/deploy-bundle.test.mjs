import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("deployment bundle contains the client-side expiry policy", async () => {
  const chunks = path.resolve("dist/client/_next/static/chunks");
  const names = (await readdir(chunks)).filter(name => /^MatchDashboard-.*\.js$/.test(name));
  assert.equal(names.length, 1, "Build the frontend before testing or deploying it");
  const bundle = await readFile(path.join(chunks, names[0]), "utf8");
  assert.ok(bundle.includes("start-plus-3h"), "Stale frontend bundle: rebuild before deploy");
});
