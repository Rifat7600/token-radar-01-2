# Token Radar — discovery-first board of pre-token protocols

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Rifat7600/token-radar-01-2/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Rifat7600/token-radar-01-2/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar that exists to find protocols **early**: it ranks the
protocols that record no token yet by a momentum model — 7-day growth ×
TVL tier × age running with no token — so a fast-growing young protocol
surfaces above a big slow one, including protocols below the snapshot's
$50M watchlist floor.

## The model

```
score = min(ln(TVL / $5M + 1), 4) × (1 + clamp(growth_7d, −50%, +200%)) × 1 / (1 + age_years)
implied_value_usd = round(score × $25,000,000)
```

Size enters on a log scale capped at 4.0 (about $268M of TVL) so it cannot dominate; growth runs 0.5×–3×;
age favours the young (60 days keeps 0.86×, 3 years keeps 0.25×). The
board holds the top 200 pre-token protocols by this score, every one of
the 40 watchlist slugs included. Each row carries a farm plan generated
from its own category, chains, TVL and age, with a cost and a time on
every step.

## How it is built

`main.ts` (Node 22, standard library only) reads the sealed snapshot,
scores every pre-token protocol, writes `board.json` and the dashboard
data, and writes `dossier.json` with the kit's `buildDossier`. The value
formula and the farm-step templates live once in `dashboard/model.js`,
which both `main.ts` and the dashboard's `app.js` call — the page can
never disagree with the board. The dashboard is a sortable, filterable
board with a detail view per protocol (live model breakdown + farm
checklist) and an "Early signals only" filter.

## Results on this snapshot

- **200 rows**, all 40 watchlist slugs covered, ranks 1–200, implied
  values $157.1M (rank 1) down to $14.5M (rank 200).
- Rank 1 is **Shift DeFi** (Yield, Ethereum): $47.6M TVL, +4448.5% in
  7 days, listed 45 days ago — exactly the early signal this radar is
  built to surface. The capped TVL tier pushes the giants down:
  WBTC sits at rank 34, Robinhood at 35.
- **12 early signals** (listed within a year, up 10%+ in 7 days).
- Two runs write byte-identical output; the dossier (748,238 bytes)
  reproduces byte for byte, its 54,174-byte source text uncut; all
  three screenshots are real 1440×900 captures of the dashboard.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Two runs write identical bytes. Screenshots are real captures of the
dashboard: the board, a protocol detail view, and the early-signal filter.
