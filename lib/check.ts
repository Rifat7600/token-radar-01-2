// Gate-shape self-check for the board, run by main.ts before writing.
// Mirrors the scorer's board_file / sorted_by_value / coverage /
// farm_steps rows: ranks 1..N once each, implied values non-increasing
// with rank (and not all equal), every watchlist slug covered, farm
// steps 3-12 strings of 20-600 characters, slugs from the snapshot.

interface BoardRowLike {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

export function validateBoard(
  rows: BoardRowLike[],
  watchlist: string[],
  snapshotSlugs: Set<string>,
): void {
  if (rows.length < 100 || rows.length > 4000) {
    throw new Error(`validateBoard: ${rows.length} rows, need 100-4000`);
  }
  const seenSlug = new Set<string>();
  const seenRank = new Set<number>();
  let prevValue = Number.POSITIVE_INFINITY;
  let allEqual = true;
  let firstValue = -1;
  for (const r of rows) {
    if (!snapshotSlugs.has(r.slug)) throw new Error(`validateBoard: unknown slug ${r.slug}`);
    if (seenSlug.has(r.slug)) throw new Error(`validateBoard: duplicate slug ${r.slug}`);
    seenSlug.add(r.slug);
    if (!Number.isInteger(r.rank) || r.rank < 1) throw new Error(`validateBoard: bad rank ${r.rank}`);
    if (seenRank.has(r.rank)) throw new Error(`validateBoard: duplicate rank ${r.rank}`);
    seenRank.add(r.rank);
    if (typeof r.name !== "string" || r.name.length === 0) {
      throw new Error(`validateBoard: empty name for ${r.slug}`);
    }
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      throw new Error(`validateBoard: bad implied value for ${r.slug}`);
    }
    if (firstValue === -1) firstValue = r.implied_value_usd;
    else if (r.implied_value_usd !== firstValue) allEqual = false;
    if (r.implied_value_usd > prevValue) {
      throw new Error(`validateBoard: value rises at rank ${r.rank}`);
    }
    prevValue = r.implied_value_usd;
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      throw new Error(`validateBoard: ${r.slug} has ${r.farm_steps.length} farm steps`);
    }
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) {
        throw new Error(`validateBoard: ${r.slug} step of ${t.length} chars: ${t.slice(0, 60)}`);
      }
    }
  }
  for (let i = 1; i <= rows.length; i++) {
    if (!seenRank.has(i)) throw new Error(`validateBoard: missing rank ${i}`);
  }
  if (allEqual) throw new Error("validateBoard: all implied values equal, not a ranking");
  for (const s of watchlist) {
    if (!seenSlug.has(s)) throw new Error(`validateBoard: watchlist slug missing: ${s}`);
  }
}
