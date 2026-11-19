// Token Launch Radar — discovery-first board of pre-token protocols.
// Reads /input/snapshot.json, ranks pre-token protocols by a momentum
// model (7-day growth x TVL tier x age running with no token), writes
// /output/board.json, the dashboard data, copies dashboard/ and
// screenshots/ to /output, and writes /output/dossier.json.
// Node 22, standard library only. Deterministic: no clock, no randomness,
// ties break by slug, so two runs write identical bytes.

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-board.ts";
import { validateBoard } from "./lib/check.ts";
import model from "./dashboard/model.js";

const { ageDays, impliedValue, isEarly, farmStepsFor } = model as unknown as {
  ageDays: (listedAt: string | null, asOf: string) => number;
  impliedValue: (tvl: number, growth: number | null, days: number) => number;
  isEarly: (days: number, growth: number | null) => boolean;
  farmStepsFor: (row: { name: string; cat: string | null; chains: string[] }) => string[];
};

const ROOT = dirname(fileURLToPath(import.meta.url));

interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

interface DashRow {
  slug: string;
  name: string;
  rank: number;
  value: number;
  tvl: number;
  g: number | null;
  age: number;
  cat: string | null;
  ch: string[];
  early: number;
}

const BOARD_ROWS = 200;

function parseArgs(argv: string[]): { input: string; outDir: string } {
  let input = "/input/snapshot.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) input = argv[i + 1] as string;
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  return { input, outDir };
}

// A protocol "records no token" when DefiLlama carries neither a
// CoinGecko id nor a ticker for it. That is the pre-token set.
function isPreToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

function buildRows(snap: Snapshot): { board: BoardRow[]; dash: DashRow[] } {
  const bySlug = new Map<string, Protocol>();
  for (const p of snap.protocols) bySlug.set(p.slug, p);

  // Score every pre-token protocol, best first, ties by slug.
  const scored = snap.protocols
    .filter(isPreToken)
    .map((p) => {
      const age = ageDays(p.listed_at, snap.as_of);
      const value = impliedValue(p.tvl_usd, p.change_7d, age);
      return { p, age, value };
    })
    .sort((a, b) => b.value - a.value || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  // Take the top 200, then force in any watchlist slug the model left
  // out: replace the lowest-ranked non-watchlist rows with them.
  const watch = new Set(snap.watchlist);
  let top = scored.slice(0, BOARD_ROWS);
  const have = new Set(top.map((r) => r.p.slug));
  const missing = snap.watchlist.filter((s) => !have.has(s));
  if (missing.length > 0) {
    const keep = top.filter((r) => watch.has(r.p.slug));
    const droppable = top.filter((r) => !watch.has(r.p.slug));
    const addBack = missing
      .map((s) => scored.find((r) => r.p.slug === s))
      .filter((r): r is (typeof scored)[number] => r !== undefined);
    top = [...keep, ...droppable.slice(0, droppable.length - addBack.length), ...addBack].sort(
      (a, b) => b.value - a.value || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
    );
  }

  const board: BoardRow[] = top.map((r, i) => ({
    slug: r.p.slug,
    name: r.p.name,
    rank: i + 1,
    implied_value_usd: r.value,
    farm_steps: farmStepsFor({ name: r.p.name, cat: r.p.category, chains: r.p.chains }),
  }));
  const dash: DashRow[] = top.map((r, i) => ({
    slug: r.p.slug,
    name: r.p.name,
    rank: i + 1,
    value: r.value,
    tvl: r.p.tvl_usd,
    g: r.p.change_7d,
    age: r.age,
    cat: r.p.category,
    ch: r.p.chains.slice(0, 2),
    early: isEarly(r.age, r.p.change_7d) ? 1 : 0,
  }));
  return { board, dash };
}

function main(): void {
  const { input, outDir } = parseArgs(process.argv.slice(2));
  const snap = JSON.parse(readFileSync(input, "utf8")) as Snapshot;
  const { board, dash } = buildRows(snap);

  // The gate's own shape, checked before anything is written.
  validateBoard(board, snap.watchlist, new Set(snap.protocols.map((p) => p.slug)));

  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "dashboard"), { recursive: true });
  mkdirSync(join(outDir, "screenshots"), { recursive: true });

  writeFileSync(join(outDir, "board.json"), JSON.stringify({ rows: board }, null, 2) + "\n", "utf8");

  // Dashboard: copy the page, then write its data beside it.
  cpSync(join(ROOT, "dashboard"), join(outDir, "dashboard"), { recursive: true });
  const dataJs =
    "const DATA = " +
    JSON.stringify({ asOf: snap.as_of, floor: snap.floor_usd, rows: dash }) +
    ";\n";
  writeFileSync(join(outDir, "dashboard", "data.js"), dataJs, "utf8");

  // Screenshots ship in the repository and are copied through.
  const shots = join(ROOT, "screenshots");
  if (existsSync(shots)) cpSync(shots, join(outDir, "screenshots"), { recursive: true });

  writeFileSync(join(outDir, "dossier.json"), buildDossier(outDir, { text_max_bytes: 65536 }));
}

main();
