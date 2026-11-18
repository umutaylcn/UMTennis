# UMTennis UI experiment — reversible restore playbook

## Frozen known-good original

- Repo: `umutaylcn/UMTennis`
- Baseline commit: `807e0ceb2fb980df678a7ea156d9a30a2739e326`
- Backup branch: `backup/umtennis-before-ui-redesign-2026-11-18`
- Experiment branch: `experiment/umtennis-ui-ux-redesign`
- Original live site: https://prediction.umtennis.workers.dev
- Backend API remains entirely outside this experiment.

## Single-message trigger

When the user says **"UMTennis eski haline geri dön"**, restore the original **visual UI**, not the user preferences, prediction data, or backend. Avoid losing any unrelated work.

### If the experiment was never merged or deployed

Simply stop using the experiment branch and return to the original `main`/production UI. Preserve the experiment branch for inspection. No deployment is necessary because production was unchanged.

### If experimental UI commits were merged or deployed

1. Inspect git status, remote branches and the actual diff. Back up any uncommitted work; do **not** run `git reset --hard` or force-push. Keep all config, data, ML/API, environment, secrets and server files intact.
2. Create a dedicated `restore/umtennis-ui` branch from the currently deployed code. Restore **only UI files changed by the experiment** from the known-good baseline, e.g.:

   ```bash
   git fetch origin
   git restore --source 807e0ceb2fb980df678a7ea156d9a30a2739e326 -- app/globals.css app/mobile.css app/MatchDashboard.tsx
   ```

   Remove any **add-only assets introduced solely by the experiment** if safe. Carefully examine the diff and preserve all later unrelated bug fixes, user settings, content, and data. If these files contain later non-visual changes, surgically revert only the experimental visual commits instead of replacing whole files.
3. Test (`pnpm build && pnpm test && pnpm lint`) and visually compare with the baseline. Commit the visual revert. Merge through the normal, authorized workflow; do not overwrite a changed branch or modify production without the user's explicit instruction.
4. If the experimental version **was deployed** and the user explicitly asks to restore the live site, redeploy the verified restored frontend using the existing authorized deployment mechanism. Never create or change Cloudflare bindings, API secrets, environment variables, D1/R2 resources, or live data to do this. Confirm the public site actually serves the restored UI. If deployment credentials are unavailable, report the precise limitation rather than claiming restoration.
5. Report restored commit, deployment status, and confirmation screenshots.

**Note:** A Git backup protects tracked source files, not independent external services or browser-local preferences. We protect those by not editing them in the first place.
