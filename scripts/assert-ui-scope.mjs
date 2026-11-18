#!/usr/bin/env node
/**
 * UMTennis visual experiment scope guard.
 * Run from the repository root with: node scripts/assert-ui-scope.mjs
 * Checks both tracked and untracked files against the frozen baseline.
 * This catches out-of-scope file edits, not semantic/behavior changes within JSX.
 */
import { execFileSync } from "node:child_process";

const baseline = "807e0ceb2fb980df678a7ea156d9a30a2739e326";
function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}
const tracked = git("diff", "--name-only", "--diff-filter=ACDMRT", baseline, "--");
const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACDMRT", baseline, "--");
const untracked = git("ls-files", "--others", "--exclude-standard");
const changed = [...new Set([...tracked, ...staged, ...untracked])].sort();

const approvedFiles = new Set([
  "app/globals.css",
  "app/mobile.css",
  "app/MatchDashboard.tsx",
  "AGENTS.md",
  "UI_REDESIGN_ROLLBACK.md",
  "scripts/assert-ui-scope.mjs",
]);
const approvedPrefixes = [".agents/skills/", "public/ui-experiment/"];
const rejected = changed.filter((f) => !approvedFiles.has(f) && !approvedPrefixes.some((p) => f.startsWith(p)));
console.log("UMTennis UI scope guard (baseline", baseline.slice(0, 8) + ")");
console.log("Files changed:", changed.length);
if (rejected.length) {
  console.error("BLOCKED: non-visual or non-approved files were changed:");
  for (const f of rejected) console.error(" -", f);
  console.error("Revert those changes safely before declaring success. Do not force reset.");
  process.exitCode = 1;
} else {
  console.log("PASS: every changed path is within the approved experiment scope.");
  console.log("NOTE: this does not prove MatchDashboard.tsx logic is unchanged. Review JSX diffs and run full behavior tests.");
}
