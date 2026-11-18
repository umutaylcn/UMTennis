# UMTennis — UI-only visual redesign guardrails

This repository is the public-facing UMTennis ATP prediction frontend. The separate `umutaylcn/umtennis-api` repository contains the ML models and Python API. This experiment is **visual-only and non-destructive**.

## Skills and design quality

- For UI work, **read and apply both** `.agents/skills/frontend-design/SKILL.md` and `.agents/skills/ui-ux-pro-max/SKILL.md` (the latter has research/data scripts; use Python 3 if available). Do not pretend to have used a skill or run a script if not.
- Aim for an exceptional, distinctive, premium tennis/broadcast/data-product experience. Push beyond superficial colors and spacing: reimagine composition, hierarchy, responsive layout, tennis-specific visual storytelling, motion, micro-interactions and high-quality data presentation, while retaining all existing features. Think elite sports editorial and credible predictive analytics, not an interchangeable SaaS dashboard. Do not present an aesthetic mockup as a working application.
- Ground every decision in the actual product: upcoming ATP fixtures, player comparison, Elo and surface Elo, form, head-to-head, predicted win probability, bilingual content and responsive usage.
- Visually evaluate the actual implementation in browser at ~360, 390, 768, 1280, and 1440px if a browser is available; fix visual issues, not just compile errors. Respect keyboard, contrast, touch targets and reduced motion.

## STRICT: NO SETTINGS / DATA / LOGIC CHANGES

- Allowed source edits: `app/globals.css`, `app/mobile.css`, and **presentation-only JSX / className / layout markup** in `app/MatchDashboard.tsx`; add-only imagery/fonts/visual assets in a dedicated `public/ui-experiment/` directory only when necessary.
- Inside `MatchDashboard.tsx`, never change imports for data/network/model modules, hooks, `useState`/`useEffect`/`useMemo`, persistence, localStorage, sessionStorage, timezones, language/translation mappings, filters, selection/sorting, routes/links, numeric calculations, match identifiers, data fetching, error/loading/retry logic, or event-handler semantics. Reorganize existing visual markup only when every control/feature remains accessible and identically functional.
- **Do not edit any other existing file.** In particular: `.openai/`, `worker/`, `public/data/`, `public/players/`, `public/backgrounds/`, `umtennis-api`, `app/search.ts`, `app/tennisBallGeometry.ts`, `app/LoadingTennisBall.tsx`, `app/layout.tsx`, `app/page.tsx`, tests, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `vite.config.ts`, environment/credentials, build or deployment files.
- Preserve 100% of existing functionality and settings, including bilingual EN/TR, user choices, timezone-aware schedules, live and previous fixtures, all prediction figures, player portraits, rankings, form/Elo/H2H comparisons, loading/error states and responsive navigation.
- Do not modify Cloudflare project settings, secrets, routes, bindings, production data, schedules, or run any update-data task.
- Do not alter the live deployment in this experiment unless the user **explicitly asks** for production publication after reviewing screenshots. Prefer a local or isolated preview. Do not force-push or merge the experiment branch without approval.
- If a requested visual change would require a behavior/configuration change, stop that change and propose a purely presentational alternative.

## Safety baseline — treat as immutable

Baseline commit: `807e0ceb2fb980df678a7ea156d9a30a2739e326`
Backup branch: `backup/umtennis-before-ui-redesign-2026-11-18`
Experiment branch: `experiment/umtennis-ui-ux-redesign`
Detailed rollback playbook: `UI_REDESIGN_ROLLBACK.md`

The user expects the phrase **"UMTennis eski haline geri dön"** to initiate the rollback workflow with no new planning question. Never delete or rewrite the backup branch. Before changing branches, protect any uncommitted work; never perform destructive resets on the user's workspace.

## Before declaring success

1. Check `git diff --name-only` against the baseline: only the explicitly allowed UI files and add-only dedicated visual assets can differ (plus the `AGENTS.md`, skill files and rollback doc preinstalled for agent tooling).
2. Run `pnpm build`, `pnpm test`, `pnpm lint`; report any unavailable/failed checks honestly. Do not modify tests to make them pass.
3. Exercise EN/TR, switches, controls, filters, upcoming/previous matches, player details, loading and error states; compare outputs and numerical values with the baseline.
4. Take before/after screenshots and give a concise visual critique at desktop and mobile sizes. Missing screenshots are not verified.
5. Deliver the design on the experiment branch only, with no changes to production and explicit rollback instructions.

## Attribution

Anthropic's `frontend-design` skill is licensed Apache-2.0, bundled with its license.
NextLevelBuilder's `ui-ux-pro-max` skill is licensed MIT, bundled with its license. Its local search scripts use Python 3's standard library.
