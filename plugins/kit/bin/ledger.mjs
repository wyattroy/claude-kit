/* ledger.mjs — the scorecard's storage and its game model, in one place.
 *
 * ONE OPERATOR IS SCORED, AND IT IS THE HUMAN ONE. This file used to carry two rubrics: the ask,
 * graded by the mentor, and the delivery, graded by the critic. The second one is gone.
 *
 * Wyatt, 2026-09-22: "I actually want to remove the judgment of claude from this; claude won't use
 * it to get better, so it's wasted effort... The point of claude-kit is to create a suite of tools
 * that make working with claude more effective (by training the user, through mentor, and by giving
 * people an easy way to have claude critique its own work, through critic)."
 *
 * That is the whole argument and it is a good one. A score changes behaviour only for someone who
 * carries it between rounds. Wyatt does; a fresh model instance does not — it starts every session
 * knowing nothing about its average, so grading it was ceremony that cost real tokens and taught
 * nobody. THE CRITIC REMAINS, and it did not lose anything that mattered: its output was always the
 * VERDICT on the work, and the number was only ever a byproduct of it.
 *
 * WHAT IS STORED AND WHAT IS NOT. Stored: the raw dimension scores, the verbatim ask, one note.
 * NOT stored: XP, level, streak, badges, or the weighted total. Every one of those is DERIVED here,
 * on read. A derived value written to disk is a value that can disagree with the data it came from,
 * and nothing on screen would say which one is lying.
 *
 * PER-REPO, BY RULING (2026-09-19). The ledger is `.claude/scorecard.jsonl` inside each repo, not a
 * global file in ~/.claude. It travels with the checkout, so a cloud session — which sees none of
 * ~/.claude — grades into the same record a laptop session does.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadAdapter, repoRoot } from "./adapter.mjs";
import { label as operatorLabel } from "./operator.mjs";

export const LEDGER_DEFAULT = ".claude/scorecard.jsonl";

/* THE RUBRIC. Weights are HERE and nowhere else — one duplicated into a skill's prose is one that
   will be changed in only one of the two places. The skills cite this file. */
export const RUBRIC = {
  /* A PLACEHOLDER, NOT A NAME: the real label is whatever the operator asked to be called,
     resolved per repo in standings(). */
  label: "You",
  role: "the prompt",
  graded_by: "mentor",
  dims: {
    framing:  { w: 0.40, label: "Framing",   what: "Outcome stated rather than steps. Scope fenced. Files and evidence pointed at instead of described. Sized to one coherent piece of work. Every answerable decision answered up front." },
    leverage: { w: 0.30, label: "Leverage",  what: "How much work the ask SAVED. Did it reach for the right skill, tool, delegation rung or existing artifact rather than making Claude rediscover it? Rounds and tokens avoided versus the naive version of the same request." },
    learning: { w: 0.30, label: "Learnings", what: "Did it apply what earlier rounds already established — prior rulings, mentor notes already given, this repo's conventions — instead of re-opening a settled question?" },
  },
};

export const DIMS = Object.keys(RUBRIC.dims);

/* The ladder. Eight named tiers on fixed thresholds. */
export const LEVELS = ["Cold Open", "Scope Setter", "Context Carrier", "Evidence Pointer",
                       "Session Strategist", "Delegation Adept", "Kit Architect", "Grandmaster Prompter"];
export const THRESHOLDS = [0, 60, 180, 380, 650, 1000, 1450, 2000];

export const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** The weighted total, from the raw dimensions. */
export function total(scores) {
  let sum = 0, w = 0;
  for (const [k, d] of Object.entries(RUBRIC.dims)) {
    if (scores[k] === undefined || scores[k] === null) continue;
    sum += clamp(scores[k]) * d.w; w += d.w;
  }
  return w === 0 ? 0 : Math.round(sum / w);
}

/** XP for one graded round: a flat 0–10 from the score, with a bonus band so the difference
 *  between a good round and an excellent one is worth chasing. */
export function xpFor(score) {
  const s = clamp(score);
  return Math.round(s / 10) + (s >= 95 ? 8 : s >= 90 ? 5 : s >= 80 ? 2 : 0);
}

export function levelFor(xp) {
  let i = 0;
  for (let k = 0; k < THRESHOLDS.length; k++) if (xp >= THRESHOLDS[k]) i = k;
  const next = THRESHOLDS[i + 1] ?? null, floor = THRESHOLDS[i];
  return {
    n: i + 1, name: LEVELS[i], xp, floor, next,
    nextName: next === null ? null : LEVELS[i + 1],
    pct: next === null ? 100 : Math.round(((xp - floor) / (next - floor)) * 100),
    toNext: next === null ? 0 : next - xp,
  };
}

const day = (ts) => String(ts).slice(0, 10);

/** Consecutive UTC days ending today or yesterday. A streak that stopped two days ago is 0 —
 *  reporting it as live would be the manufactured confidence the critic exists to catch. */
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

/* ── badges: each one a PATTERN over the ledger, computed fresh ───────────────────────────── */
export const BADGES = [
  { id: "first-grade", icon: "●", name: "On The Board",     what: "First graded round.",
    test: (m) => m.length >= 1 },
  { id: "clean-ask",   icon: "▲", name: "Clean Ask",        what: "Three rounds in a row framed at 85 or better.",
    test: (m) => run(m, e => e.score >= 85) >= 3 },
  { id: "multiplier",  icon: "✳", name: "Force Multiplier", what: "Five rounds scoring 90+ on Leverage — asks that saved real work.",
    test: (m) => m.filter(e => (e.scores.leverage ?? 0) >= 90).length >= 5 },
  { id: "elephant",    icon: "◆", name: "Elephant Memory",  what: "Five rounds scoring 90+ on Learnings — nothing settled got re-opened.",
    test: (m) => m.filter(e => (e.scores.learning ?? 0) >= 90).length >= 5 },
  { id: "fenced",      icon: "■", name: "Scope Fence",      what: "Five rounds scoring 90+ on Framing.",
    test: (m) => m.filter(e => (e.scores.framing ?? 0) >= 90).length >= 5 },
  { id: "climb",       icon: "▶", name: "The Climb",        what: "A round scoring 25 or more above your average at the time.",
    test: (m) => m.some((e, i) => { if (i < 3) return false; const prev = m.slice(0, i); return e.score - (prev.reduce((s, x) => s + x.score, 0) / prev.length) >= 25; }) },
  { id: "perfect",     icon: "★", name: "Perfect Round",    what: "A round scored 100.",
    test: (m) => m.some(e => e.score === 100) },
  { id: "streak-7",    icon: "○", name: "Seven Straight",   what: "Seven consecutive days with a graded round.",
    test: (m) => streakOf(m) >= 7 },
];

/** Length of the current run of `pred`, counting back from the newest entry. */
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
  let legacy = 0;
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!line.trim()) return;
      try {
        const e = JSON.parse(line);
        /* DELIVERY GRADES FROM THE TWO-SIDED ERA. They are left on disk — the ledger is
           append-only, and deleting rows to suit a later design is exactly the tidying that makes
           a record useless as evidence. They are not scored, and they are COUNTED so the board can
           say they are there rather than pretend the file only ever held one kind of row. */
        if (e.side && e.side !== "human") { legacy++; return; }
        e.scores = e.scores || {};
        e.score = e.score ?? total(e.scores);
        entries.push(e);
      } catch (err) { broken.push({ line: i + 1, why: err.message }); }
    });
  }
  entries.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return { file, exists: fs.existsSync(file), entries, broken, legacy };
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
  const { file, exists, entries, broken, legacy } = readLedger(repo);
  const xp = entries.reduce((s, e) => s + xpFor(e.score), 0);
  const avg = entries.length ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : null;
  const mean = (a) => a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : null;
  const recent = mean(entries.slice(-5)), before = mean(entries.slice(-10, -5));
  const dims = {};
  for (const k of DIMS) {
    const vals = entries.map(e => e.scores[k]).filter(v => v !== undefined && v !== null);
    dims[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  return {
    file, exists, broken, legacy, generated: new Date().toISOString(), repo: path.basename(repo),
    label: operatorLabel(repo), rounds: entries.length, xp, avg, dims,
    level: levelFor(xp),
    streak: streakOf(entries),
    best: entries.length ? Math.max(...entries.map(e => e.score)) : null,
    worst: entries.length ? Math.min(...entries.map(e => e.score)) : null,
    trend: recent !== null && before !== null ? Math.round(recent - before) : null,
    badges: BADGES.filter(b => b.test(entries)).map(({ id, icon, name, what }) => ({ id, icon, name, what })),
    entries,
  };
}
