#!/usr/bin/env node
/* score.mjs — write one grade into the ledger, or read the standings back.
 *
 * The brief, 2026-09-19: "Make mentors give a score for how well you asked your prompt and how
 * skillfully and how much usage is kind of saved by the skill that you asked your prompt with and
 * how well you integrated past learnings. That should all be part of this cool tracked score...
 * think of it like a grade that a teacher would give you."
 *
 * WHY A SCRIPT AND NOT AN INSTRUCTION TO WRITE A LINE OF JSON. Three reasons, each one a failure
 * this replaces: a hand-written line drifts from the schema and the dashboard silently drops it;
 * a model computing its own weighted total will get a different answer from the dashboard's; and a
 * grade appended with no round id can never be paired with the other side of the same round. The
 * weights, the XP curve and the schema live in ledger.mjs, and this is the only door into them.
 *
 *   node score.mjs mentor --ask="<their words>" --framing=80 --leverage=70 --learning=90 --note="..."
 *   node score.mjs critic --round=r-1a2b3c4d --delivery=90 --evidence=70 --scope=100 \
 *                         --verdict=PARTIAL --note="..."
 *   node score.mjs show            # the standings, in the terminal
 *   node score.mjs rubric [side]   # what each dimension means — read it BEFORE grading
 *
 * Every number is 0–100. The weighted total is computed here, never supplied.
 */
import { RUBRIC, SIDES, append, newId, standings, total, xpFor, levelFor, clamp, readLedger } from "./ledger.mjs";
import { repoRoot } from "./adapter.mjs";
import { label as operatorLabel } from "./operator.mjs";
const LBL = (side) => (side === "human" ? operatorLabel(REPO) : RUBRIC[side].label);

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (k, d) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const has = (k) => argv.some(s => s === `--${k}` || s.startsWith(`--${k}=`));
const REPO = arg("repo", repoRoot());

const bar = (pct, w = 24) => "█".repeat(Math.round((pct / 100) * w)).padEnd(w, "░");
const die = (m) => { console.error(m); process.exit(2); };

const USAGE = `usage:
  score.mjs mentor --ask="<verbatim>" --framing=N --leverage=N --learning=N [--note="..."] [--round=ID] [--session=ID]
  score.mjs critic --round=ID --delivery=N --evidence=N --scope=N --verdict=DONE|PARTIAL|NOT_DONE [--note="..."] [--ask="<verbatim>"]
  score.mjs show
  score.mjs rubric [human|claude]
All dimension scores are 0-100. "mentor" grades the ASK. "critic" grades the DELIVERY.`;

/* ── rubric ───────────────────────────────────────────────────────────────────────────────── */
if (cmd === "rubric") {
  const want = argv[1] ? [argv[1]] : SIDES;
  for (const side of want) {
    const R = RUBRIC[side];
    if (!R) die(`unknown side "${side}" (known: ${SIDES.join(", ")})`);
    console.log(`\n${LBL(side)} — ${R.role}, graded by the ${R.graded_by}`);
    for (const [k, d] of Object.entries(R.dims))
      console.log(`\n  ${d.label} (--${k}, weight ${Math.round(d.w * 100)}%)\n    ${d.what}`);
  }
  console.log("\n  0-100 each. Be a teacher, not a cheerleader: 70 is competent, 85 is good,");
  console.log("  95+ is rare. A ledger where everything is 90 measures nothing.\n");
  process.exit(0);
}

/* ── show ─────────────────────────────────────────────────────────────────────────────────── */
if (cmd === "show" || cmd === undefined) {
  const s = standings(REPO);
  if (!s.exists) { console.log(`No ledger yet at ${s.file}. Nothing has been graded in this repo.`); process.exit(0); }
  console.log(`\n  SCORECARD — ${s.repo}   ${s.rounds} round(s), ${s.entries.length} grade(s)`);
  console.log(`  ${s.file}\n`);
  for (const side of SIDES) {
    const d = s.sides[side];
    if (!d.rounds) { console.log(`  ${d.label.padEnd(8)} — nothing graded yet\n`); continue; }
    const trend = d.trend === null ? "" : `  ${d.trend > 0 ? "▲" : d.trend < 0 ? "▼" : "▬"}${Math.abs(d.trend)} vs previous 5`;
    console.log(`  ${d.label.toUpperCase()}  L${d.level.n} ${d.level.name}`);
    console.log(`    ${bar(d.level.pct)}  ${d.xp} XP` + (d.level.next === null ? "  (max)" : `  ${d.level.toNext} to ${d.level.nextName}`));
    console.log(`    avg ${d.avg}/100 over ${d.rounds}   best ${d.best}   worst ${d.worst}   streak ${d.streak}d${trend}`);
    console.log(`    ${Object.entries(RUBRIC[side].dims).map(([k, m]) => `${m.label} ${d.dims[k] ?? "—"}`).join("   ")}`);
    if (d.badges.length) console.log(`    ${d.badges.map(b => `${b.icon} ${b.name}`).join("   ")}`);
    console.log("");
  }
  if (s.system.length) console.log(`  SYSTEM  ${s.system.map(b => `${b.icon} ${b.name}`).join("   ")}\n`);
  if (s.paired.length) {
    console.log("  HEAD TO HEAD (rounds graded on both sides)");
    for (const r of s.paired.slice(-5))
      console.log(`    ${r.ts.slice(0, 10)}  ask ${String(r.human.score).padStart(3)}  delivery ${String(r.claude.score).padStart(3)}  gap ${r.gap > 0 ? "+" : ""}${r.gap}  ${r.claude.verdict || ""}`);
    console.log("");
  }
  /* A malformed row is REPORTED. A ledger that quietly drops rows produces a dashboard that is
     confidently wrong, which is the one outcome this whole kit exists to prevent. */
  if (s.broken.length) {
    console.log(`  ⚠ ${s.broken.length} unreadable line(s) in the ledger — NOT counted above:`);
    for (const b of s.broken) console.log(`    line ${b.line}: ${b.why}`);
    console.log("");
  }
  process.exit(0);
}

/* ── grade ────────────────────────────────────────────────────────────────────────────────── */
const side = cmd === "mentor" ? "human" : cmd === "critic" ? "claude" : null;
if (!side) die(USAGE);

const dims = Object.keys(RUBRIC[side].dims);
const missing = dims.filter(k => !has(k));
if (missing.length) die(`missing required score(s): ${missing.map(k => `--${k}`).join(" ")}\n\n${USAGE}`);

const scores = {};
for (const k of dims) {
  const raw = arg(k);
  if (!/^-?\d+(\.\d+)?$/.test(String(raw))) die(`--${k} must be a number 0-100, got "${raw}"`);
  scores[k] = clamp(raw);
}

/* THE CRITIC MUST NAME THE ROUND IT IS GRADING. Without it the delivery score floats free of the
   ask that produced it, and the head-to-head — the reason there are two scores at all — cannot be
   drawn. If the mentor never graded this round, say so with --round=unpaired rather than omitting. */
let round = arg("round");
if (!round) {
  if (side === "claude") die(`--round is required for a critic grade.\nUse the id the mentor grade printed, or --round=unpaired if the ask was never graded.`);
  round = newId("r");
}

const before = levelFor(side, standings(REPO).sides[side].xp);

const entry = {
  v: 1,
  ts: new Date().toISOString(),
  round,
  session: arg("session", null),
  side,
  ask: (arg("ask", "") || "").slice(0, 1200) || null,  /* a real multi-part ask must survive whole; the board truncates for display, the record does not */
  scores,
  score: total(side, scores),
  note: arg("note", null),
};
if (side === "claude") {
  const v = (arg("verdict", "") || "").toUpperCase().replace(/[\s-]+/g, "_");
  if (!["DONE", "PARTIAL", "NOT_DONE"].includes(v)) die(`--verdict must be DONE, PARTIAL or NOT_DONE (got "${arg("verdict", "")}")`);
  entry.verdict = v === "NOT_DONE" ? "NOT DONE" : v;
}
/* The mentor grades the ask BEFORE the work runs, so a missing --ask means the grade cannot be
   read back against what was actually asked. Named, not skipped. */
if (side === "human" && !entry.ask) console.error("⚠ no --ask recorded: this grade cannot be read back against the words it graded.");

const file = append(entry, REPO);
const after = levelFor(side, standings(REPO).sides[side].xp);
const gained = xpFor(entry.score);

console.log(`\n  ${LBL(side)}: ${entry.score}/100   ` +
  Object.entries(RUBRIC[side].dims).map(([k, m]) => `${m.label} ${scores[k]}`).join("  ") +
  (entry.verdict ? `   [${entry.verdict}]` : ""));
console.log(`  +${gained} XP → ${after.xp}   round ${round}`);
if (after.n > before.n) console.log(`  ★ LEVEL UP — L${after.n} ${after.name}`);
else if (after.next !== null) console.log(`  ${bar(after.pct)}  ${after.toNext} XP to ${after.nextName}`);
console.log(`  ${file}\n`);
