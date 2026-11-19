// Shared model for the Token Launch Radar.
// One file, plain JavaScript, used by BOTH sides of the entry:
//   - main.ts (Node) imports it and builds board.json with it
//   - app.js (browser) loads it as a classic script and re-runs it to render
// Because both sides call the same functions, the dashboard can never
// disagree with board.json. No imports, no network, no clock, no randomness.

// ---- helpers -----------------------------------------------------------

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

// Days between a protocol's first DefiLlama listing and the snapshot date.
// -1 when DefiLlama reports no listing date.
function ageDays(listedAt, asOf) {
  if (!listedAt) return -1;
  var a = Date.parse(asOf + "T00:00:00Z");
  var b = Date.parse(listedAt + "T00:00:00Z");
  if (isNaN(a) || isNaN(b)) return -1;
  return Math.max(0, Math.round((a - b) / 86400000));
}

// ---- the value model ---------------------------------------------------
// A protocol's implied token value follows from the snapshot's own figures:
// its TVL, its 7-day growth, and how long it has run with no token.
//
//   score = min(ln(TVL / $5M + 1), 4)  x  (1 + clamp(growth, -50, 200) / 100)
//                              x  1 / (1 + ageDays / 365)
//   implied_value_usd = round(score x $25,000,000)
//
// The log TVL tier keeps size in the picture without letting it dominate,
// and it is capped at 4.0 (about $268M of TVL): beyond that, more size
// adds nothing, so a $12B exchange cannot outrank young growers on size
// alone. The growth factor runs 0.5x (down 50%+) to 3x (up 200%+). The
// age factor favours the young: a protocol listed 60 days ago keeps
// 0.86x, one listed 3 years ago keeps 0.25x. So a fast-growing young
// protocol surfaces above a big slow one — the radar exists to find
// launches early, not to restate the TVL leaderboard. Age unknown counts
// as 365 days (0.5x).

function growthFactor(g) {
  var x = (g === null || g === undefined) ? 0 : g;
  return 1 + clamp(x, -50, 200) / 100;
}

function ageFactor(days) {
  var d = days < 0 ? 365 : days;
  return 1 / (1 + d / 365);
}

function tvlTier(tvl) {
  // Capped at 4.0 (about $268M of TVL): beyond that, more size adds
  // nothing. Without the cap a $12B exchange would outrank every young
  // grower on size alone; with it, growth and youth decide the top.
  return Math.min(Math.log(tvl / 5000000 + 1), 4);
}

function momentumScore(tvl, growth, days) {
  return tvlTier(tvl) * growthFactor(growth) * ageFactor(days);
}

function impliedValue(tvl, growth, days) {
  return Math.max(1, Math.round(momentumScore(tvl, growth, days) * 25000000));
}

// An "early signal" is a young protocol already growing fast: listed
// within the last year and up at least 10% in the last 7 days.
function isEarly(days, growth) {
  var g = (growth === null || growth === undefined) ? 0 : growth;
  return days >= 0 && days <= 365 && g >= 10;
}

// ---- display formatting ------------------------------------------------

function fmtUsd(n) {
  if (n >= 1000000000) return "$" + (n / 1000000000).toFixed(2) + "B";
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "K";
  return "$" + Math.round(n);
}

function fmtPct(g) {
  if (g === null || g === undefined) return "n/a";
  return (g >= 0 ? "+" : "") + g.toFixed(1) + "%";
}

function fmtAge(days) {
  if (days < 0) return "unknown";
  if (days < 30) return days + " days";
  if (days < 365) return (days / 30).toFixed(0) + " mo";
  return (days / 365).toFixed(1) + " yrs";
}

// ---- farm steps --------------------------------------------------------
// Every step names what to do, what it costs and how long it takes.
// Templates keyed by the protocol's category; the protocol's own name,
// chain and figures are interpolated, so no two protocols share a plan.
// Steps are generated, never copied from a list of names.

var GAS = {
  "Ethereum": "ETH",
  "Solana": "SOL",
  "Base": "ETH",
  "Arbitrum": "ETH",
  "BSC": "BNB",
  "BNB Chain": "BNB",
  "Polygon": "POL",
  "Avalanche": "AVAX",
  "Optimism": "ETH",
  "Sui": "SUI",
  "Aptos": "APT"
};

function gasToken(chain) {
  return GAS[chain] || "native gas token";
}

function catSteps(cat) {
  if (cat === "Dexs") return [
    "Swap $25 of {GAS} for a stablecoin on {NAME} ({CHAIN}) — gas about $0.50-$2, 5 minutes.",
    "Add $25 to a {NAME} liquidity pool on {CHAIN} and hold the LP position — gas about $1-$3, 10 minutes."
  ];
  if (cat === "Lending") return [
    "Supply $50 of stablecoin to {NAME} on {CHAIN} as collateral — gas about $1-$3, 10 minutes.",
    "Borrow $20 against your supply on {NAME}, then repay it a week later — interest under $1, 10 minutes."
  ];
  if (cat === "Yield") return [
    "Deposit $50 into a {NAME} vault on {CHAIN} — gas about $1-$3, 10 minutes.",
    "Leave the deposit for 4 weeks and harvest any rewards weekly — gas about $0.50 per harvest, 5 minutes a week."
  ];
  if (cat === "RWA") return [
    "Buy $50 of the tokenised asset on {NAME} ({CHAIN}) — gas about $1-$3, 10 minutes.",
    "Hold the position for 4 weeks and finish the platform's verification if it asks for one — free, 15 minutes."
  ];
  if (cat === "Bridge") return [
    "Bridge $25 from {CHAIN} to another chain through {NAME} — fee about $1-$5, 15 minutes.",
    "Bridge $25 back a week later so your address shows two-way use — fee about $1-$5, 15 minutes."
  ];
  if (cat === "Liquid Staking" || cat === "Liquid Restaking" || cat === "Restaked BTC") return [
    "Stake $25 of {GAS} through {NAME} on {CHAIN} and hold the receipt token — gas about $1-$3, 10 minutes.",
    "Use the receipt token once in a {NAME}-supported pool or vault — gas about $1-$2, 10 minutes."
  ];
  if (cat === "Derivatives" || cat === "Options" || cat === "Prediction Market") return [
    "Open a $25 position on {NAME} ({CHAIN}) with low leverage — gas about $1-$3, 10 minutes.",
    "Close the position after a week and open a second $25 one — gas about $1-$3, 10 minutes."
  ];
  if (cat === "CDP") return [
    "Lock $50 of collateral in a {NAME} vault on {CHAIN} and mint $20 of its stablecoin — gas about $1-$3, 10 minutes.",
    "Repay the $20 and unlock your collateral a week later — gas about $1-$2, 10 minutes."
  ];
  return [
    "Make a $25 test transaction through {NAME} on {CHAIN} — gas about $0.50-$2, 5 minutes.",
    "Use {NAME}'s main feature a second time with $25 a week later — gas about $1, 10 minutes."
  ];
}

// The full farm plan for one protocol row. `row` carries name, cat,
// chains (array), tvl and age from the snapshot. Returns 6 steps.
function farmStepsFor(row) {
  var chain = (row.chains && row.chains.length > 0) ? row.chains[0] : "Ethereum";
  var gas = gasToken(chain);
  var fill = function (s) {
    return s.split("{NAME}").join(row.name).split("{CHAIN}").join(chain).split("{GAS}").join(gas);
  };
  var steps = [];
  steps.push(fill("Set up: create a fresh wallet, fund it with $30 on {CHAIN} (bridge fee about $1-$5, 10 minutes), and keep $5 of {GAS} aside for gas."));
  var mid = catSteps(row.cat || null);
  steps.push(fill(mid[0]));
  steps.push(fill(mid[1]));
  steps.push(fill("Use {NAME} at least once a week for 4 weeks — repeat a small $10 action each week (about 15 minutes a week, gas $0.50-$2 per visit) so your address shows steady use, not one visit."));
  steps.push(fill("Follow {NAME}'s official announcements and finish any profile or waitlist task it lists (free, 10 minutes) so you do not miss a snapshot or claim window."));
  steps.push(fill("Record everything: save each transaction hash and a screenshot after every step (free, 5 minutes) — if a claim opens later, that proof is what you will need."));
  return steps;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    clamp: clamp,
    ageDays: ageDays,
    growthFactor: growthFactor,
    ageFactor: ageFactor,
    tvlTier: tvlTier,
    momentumScore: momentumScore,
    impliedValue: impliedValue,
    isEarly: isEarly,
    fmtUsd: fmtUsd,
    fmtPct: fmtPct,
    fmtAge: fmtAge,
    farmStepsFor: farmStepsFor
  };
}
