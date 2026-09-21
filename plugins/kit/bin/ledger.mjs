/* ledger.mjs — the scorecard's storage and its game model, in one place.
 *
 * TWO SCORES, ONE ROUND. A "round" is one work request. The MENTOR grades the human side of it
 * (how the ask was framed) before the work runs; the CRITIC grades the Claude side (what was
 * actually delivered) after. Both land in the same append-only ledger, joined by `round`, so the
 * dashboard can show them head to head — which is the whole point: this pipeline has two
 * operators in it, and only one of them has ever been measured.
 *
 * WHAT IS STORED AND WHAT IS NOT. Stored: the raw dimension scores, the verbatim ask, one note.
 * NOT stored: XP, level, streak, badges, or the weighted total. Every one of those is DERIVED
 * here, on read. A derived value written to disk is a value that can disagree with the data it
 * came from, and nothing on screen would say which one is lying.
 *
 * PER-REPO, BY RULING (2026-09-19). The ledger is `.claude/scorecard.jsonl` inside each
 * repo, not a global file in ~/.claude. It travels with the checkout, so a cloud session — which
 * sees none of ~/.claude — grades into the same record a laptop session does.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadAdapter, repoRoot } from "./adapter.mjs";
import { label as operatorLabel } from "./operator.mjs";

export const LEDGER_DEFAULT = ".claude/scorecard.jsonl";

/* ── the two rubrics ──────────────────────────────────────────────────────────────────────────
   Weights are HERE and nowhere else. A rubric duplicated in a skill's prose and in the code is a
   rubric that will be changed in one of the two places. The skills cite this file. */
export const RUBRIC = {
  human: {
    /* A PLACEHOLDER, NOT A NAME. The real label is whatever the operator asked to be called,
       resolved per repo in standings() — this kit had one person's name welded through it once,
       and it read as somebody else's tool to everyone else. "You" is what an unanswered kit says. */
    label: "You",
    role: "the prompt",
    graded_by: "mentor",
    dims: {
      framing:  { w: 0.40, label: "Framing",   what: "Outcome stated rather than steps. Scope fenced. Files and evidence pointed at instead of described. Sized to one coherent piece of work. Answerable decisions answered up front." },
      leverage: { w: 0.30, label: "Leverage",  what: "How much work the ask SAVED. Did it reach for the right skill, tool, delegation rung or existing artifact rather than making Claude rediscover it? Rounds and tokens avoided versus the naive version of the same request." },
      learning: { w: 0.30, label: "Learnings", what: "Did it apply what earlier rounds already established — prior rulings, mentor notes already given, this repo's conventions — instead of re-opening a settled question?" },
    },
  },
  claude: {
    label: "Claude",
    role: "the delivery",
    graded_by: "critic",
    dims: {
      delivery: { w: 0.50, label: "Delivery",  what: "Did the thing they ASKED for actually happen? Not 'is this good work.' Per item: done, partial, or not done." },
      evidence: { w: 0.30, label: "Evidence",  what: "Was each claim backed by a check that could have failed? A check that cannot fail proves nothing and scores nothing." },
      scope:    { w: 0.20, label: "Scope",     what: "Did it stay inside the ask? Unasked-for work costs here, and costs double when it displaced something they did ask for." },
    },
  },
};

export const SIDES = Object.keys(RUBRIC);

/* ── the ladders ──────────────────────────────────────────────────────────────────────────────
   Same thresholds both sides so the two bars are comparable; different names so the dashboard
   reads like two careers rather than one scoreboard duplicated. */
export const LEVELS = {
  human:  ["Cold Open", "Scope Setter", "Context Carrier", "Evidence Pointer", "Session Strategist", "Delegation Adept", "Kit Architect", "Grandmaster Prompter"],
  claude: ["Intern", "Junior", "Contributor", "Senior", "Staff", "Principal", "Distinguished", "Fellow"],
};
export const THRESHOLDS = [0, 60, 180, 380, 650, 1000, 1450, 2000];

export const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** The weighted total for one side, from its raw dimensions. */
export function total(side, scores) {
  const dims = RUBRIC[side].dims;
  let sum = 0, w = 0;
  for (const [k, d] of Object.entries(dims)) {
    if (scores[k] === undefined || scores[k] === null) continue;
    sum += clamp(scores[k]) * d.w; w += d.w;
  }
  return w === 0 ? 0 : Math.round(sum / w);
}

/** XP for one graded round. Flat 0–10 from the score, with a bonus band on top so the
 *  difference between a good round and an excellent one is worth chasing. */
export function xpFor(score) {
  const s = clamp(score);
  return Math.round(s / 10) + (s >= 95 ? 8 : s >= 90 ? 5 : s >= 80 ? 2 : 0);
}

export function levelFor(side, xp) {
  let i = 0;
  for (let k = 0; k < THRESHOLDS.length; k++) if (xp >= THRESHOLDS[k]) i = k;
  const next = THRESHOLDS[i + 1] ?? null;
  const floor = THRESHOLDS[i];
  return {
    n: i + 1,
    name: LEVELS[side][i],
    xp,
    floor,
    next,
    nextName: next === null ? null : LEVELS[side][i + 1],
    pct: next === null ? 100 : Math.round(((xp - floor) / (next - floor)) * 100),
    toNext: next === null ? 0 : next - xp,
  };
}

const day = (ts) => String(ts).slice(0, 10);

/** Consecutive UTC days ending today or yesterday. A streak that stopped two days ago is 0 —
 *  reporting it as live would be the same manufactured confidence the critic exists to catch. */
export function streakOf(entries) {
  const days = [...new Set(entries.map(e => day(e.ts)))].sort().reverse();
  if (!days.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yest) return 0;
  let n = 1, cursor = new Date(days[0] + "T00:00:00Z");
  for (let i = 1; i < days.length; i++) {
    cursor = new Date(cursor.getTime() - 864e5);
    if (days[i] === cursor.toISOString().slice(0, 10)) n++; else break;
  }
  return n;
}

/* ── badges ───────────────────────────────────────────────────────────────────────────────────
   Each one is a PATTERN over the ledger, computed fresh. `test` receives the side's own entries
   (newest last) plus the full ledger, and returns true or false. */
export const BADGES = [
  { id: "first-grade", side: "both",   icon: "●", name: "On The Board",      what: "First graded round on this side.",
    test: (mine) => mine.length >= 1 },
  { id: "clean-ask",   side: "human",  icon: "▲", name: "Clean Ask",         what: "Three rounds in a row framed at 85 or better.",
    test: (mine) => run(mine, e => e.score >= 85) >= 3 },
  { id: "multiplier",  side: "human",  icon: "✳", name: "Force Multiplier",  what: "Five rounds scoring 90+ on Leverage — asks that saved real work.",
    test: (mine) => mine.filter(e => (e.scores.leverage ?? 0) >= 90).length >= 5 },
  { id: "elephant",    side: "human",  icon: "◆", name: "Elephant Memory",   what: "Five rounds scoring 90+ on Learnings — nothing settled got re-opened.",
    test: (mine) => mine.filter(e => (e.scores.learning ?? 0) >= 90).length >= 5 },
  { id: "no-drift",    side: "claude", icon: "▶", name: "No Drift",          what: "Five consecutive critic verdicts of DONE.",
    test: (mine) => run(mine, e => e.verdict === "DONE") >= 5 },
  { id: "receipts",    side: "claude", icon: "■", name: "Receipts",          what: "Five rounds scoring 90+ on Evidence.",
    test: (mine) => mine.filter(e => (e.scores.evidence ?? 0) >= 90).length >= 5 },
  { id: "perfect",     side: "both",   icon: "★", name: "Perfect Round",     what: "A round scored 100.",
    test: (mine) => mine.some(e => e.score === 100) },
  { id: "streak-7",    side: "both",   icon: "○", name: "Seven Straight",    what: "Seven consecutive days with a graded round.",
    test: (mine) => streakOf(mine) >= 7 },
  { id: "bite",        side: "system", icon: "⚠", name: "The Critic Bites",  what: "A critic round scored the delivery under 60 — the mechanism caught a real miss, which is it working, not failing.",
    test: (_, all) => all.some(e => e.side === "claude" && e.score < 60) },
];

/** Length of the current run of `pred` counting back from the newest entry. */
function run(entries, pred) {
  let n = 0;
  for (let i = entries.length - 1; i >= 0; i--) { if (pred(entries[i])) n++; else break; }
  return n;
}

/* ── storage ──────────────────────────────────────────────────────────────────────────────────
   JSONL: one entry per line, append-only. A malformed line is REPORTED, never skipped silently —
   a ledger that quietly drops rows produces a dashboard that is confidently wrong. */
export function ledgerPath(repo = repoRoot()) {
  let declared = null;
  try { declared = loadAdapter(repo).values["scorecard"] || null; } catch { /* no adapter is fine */ }
  return path.join(repo, declared || LEDGER_DEFAULT);
}

export function readLedger(repo = repoRoot()) {
  const file = ledgerPath(repo);
  const entries = [], broken = [];
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!line.trim()) return;
      try {
        const e = JSON.parse(line);
        if (!SIDES.includes(e.side)) throw new Error(`unknown side "${e.side}"`);
        e.scores = e.scores || {};
        e.score = e.score ?? total(e.side, e.scores);
        entries.push(e);
      } catch (err) { broken.push({ line: i + 1, why: err.message }); }
    });
  }
  entries.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return { file, exists: fs.existsSync(file), entries, broken };
}

export function append(entry, repo = repoRoot()) {
  const file = ledgerPath(repo);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  return file;
}

export const newId = (p) => `${p}-${crypto.randomBytes(4).toString("hex")}`;

/* ── the standings the dashboard and the terminal both read ───────────────────────────────── */
export function standings(repo = repoRoot()) {
  const { file, exists, entries, broken } = readLedger(repo);
  const sides = {};
  for (const side of SIDES) {
    const mine = entries.filter(e => e.side === side);
    const xp = mine.reduce((s, e) => s + xpFor(e.score), 0);
    const avg = mine.length ? Math.round(mine.reduce((s, e) => s + e.score, 0) / mine.length) : null;
    const last5 = mine.slice(-5);
    const prev5 = mine.slice(-10, -5);
    const mean = (a) => a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : null;
    const recent = mean(last5), before = mean(prev5);
    const dims = {};
    for (const k of Object.keys(RUBRIC[side].dims)) {
      const vals = mine.map(e => e.scores[k]).filter(v => v !== undefined && v !== null);
      dims[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    }
    sides[side] = {
      side, label: side === "human" ? operatorLabel(repo) : RUBRIC[side].label,
      rounds: mine.length, xp, avg, dims,
      level: levelFor(side, xp),
      streak: streakOf(mine),
      best: mine.length ? Math.max(...mine.map(e => e.score)) : null,
      worst: mine.length ? Math.min(...mine.map(e => e.score)) : null,
      trend: recent !== null && before !== null ? Math.round(recent - before) : null,
      badges: BADGES.filter(b => (b.side === side || b.side === "both") && b.test(mine, entries))
                    .map(({ id, icon, name, what }) => ({ id, icon, name, what })),
      entries: mine,
    };
  }
  const system = BADGES.filter(b => b.side === "system" && b.test([], entries))
                       .map(({ id, icon, name, what }) => ({ id, icon, name, what }));

  /* Rounds where BOTH sides were graded. The gap is the number worth staring at: a well-framed
     ask that still missed is a Claude problem; a vague ask that landed anyway was luck. */
  const byRound = new Map();
  for (const e of entries) {
    if (!e.round) continue;
    const r = byRound.get(e.round) || { round: e.round, ts: e.ts, ask: e.ask };
    r[e.side] = e;
    r.ts = r.ts || e.ts; r.ask = r.ask || e.ask;
    byRound.set(e.round, r);
  }
  const paired = [...byRound.values()].filter(r => r.human && r.claude)
    .map(r => ({ ...r, gap: r.human.score - r.claude.score }));

  return {
    file, exists, broken, generated: new Date().toISOString(),
    repo: path.basename(repo), sides, system, paired,
    rounds: byRound.size, entries,
  };
}
