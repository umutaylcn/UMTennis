# UMTennis

**ATP match predictions powered by leakage-free feature engineering, dual Elo ratings, and an XGBoost-Logistic Regression ensemble.**

[Live Demo](https://prediction.umtennis.workers.dev) · [Machine Learning API](https://github.com/umutaylcn/umtennis-api) · [API Health](https://umtennis-api.onrender.com/api/health)

![UMTennis match prediction platform](public/og.png)

## What it does

UMTennis turns upcoming ATP fixtures into interactive pre-match analysis. Select a match to compare:

- ATP ranking, general Elo, and surface-specific Elo
- last 5, last 10, and surface form
- career serve and return statistics
- overall and surface head-to-head records
- calibrated win probabilities and confidence levels
- match-strength ratings and surface-aware presentation

The interface is responsive, bilingual (English/Turkish), timezone-aware, and optimized for desktop and mobile.

## Model results

The production model is a probability ensemble of **60% XGBoost + 40% Logistic Regression**, selected with expanding-window cross-validation.

| Evaluation period | Accuracy | ROC-AUC | Log loss | Brier score |
| --- | ---: | ---: | ---: | ---: |
| 2023-2025 untouched test set | 66.2% | 0.726 | 0.608 | 0.211 |
| 2026 partial backtest | 66.0% | 0.733 | 0.602 | 0.208 |

Accuracy reaches **78.0% at >=70% model confidence** on the held-out evaluation set, covering roughly 39.7% of matches. Confidence thresholds are descriptive model diagnostics, not betting advice.

## Leakage-free pipeline

```text
Historical ATP matches
        ↓
Chronological audit and cleaning
        ↓
Pre-match state reconstruction
        ↓
119 features: Elo, surface Elo, form, H2H, ranking, tournament context
        ↓
Expanding-window cross-validation
        ↓
XGBoost + Logistic Regression ensemble
        ↓
Calibrated P(Player 1 wins)
```

Every stateful feature is calculated using only matches completed before the target match. Winner/loser columns are randomized into Player 1/Player 2 orientation to prevent target leakage.

## Tech stack

- **Frontend:** React 19, TypeScript, Next-compatible App Router, Vinext, CSS
- **Hosting:** Cloudflare Workers
- **API:** FastAPI, Python, pandas, scikit-learn, XGBoost
- **Data:** ATP match history and live upcoming-fixture provider

## Local development

Requirements: Node.js `>=22.13.0`.

```bash
pnpm install
pnpm dev
```

The frontend uses the production API by default. To use another backend, set:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Useful commands:

```bash
pnpm build
pnpm test
pnpm lint
```

## Repository structure

```text
app/                 React pages, match dashboard, and responsive styles
public/backgrounds/  Surface-specific visual assets
public/players/      Prepared player portraits
tests/               Render and build checks
worker/              Cloudflare Worker entry point
```

The modeling code, notebooks, feature pipeline, and FastAPI service live in [umtennis-api](https://github.com/umutaylcn/umtennis-api).

## Disclaimer

UMTennis is an educational portfolio project. Predictions are probabilistic and must not be interpreted as guaranteed outcomes or financial advice. Player images belong to their respective rights holders and are used for non-commercial demonstration purposes.

## Author

Developed by [Umut Ali Yalçın](https://github.com/umutaylcn).
