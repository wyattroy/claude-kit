#!/usr/bin/env node
/* score.mjs — write one grade into the ledger, or read the standings back.
 *
 * The brief, 2026-09-19: "Make mentors give a score for how well you asked your prompt and how
 * skillfully and how much usage is kind of saved by the skill that you asked your prompt with and
 * how well you integrated past learnings. That should all be part of this cool tracked score...
 * think of it like a grade that a teacher would give you."
 *
 * ONE SIDE IS GRADED, AND IT IS THE ASK. The `critic` subcommand that graded Claude's delivery was
 * removed 2026-09-22: a score only changes behaviour for someone who carries it between rounds, and
 * a fresh model instance does not. The critic still runs — its output is the VERDICT on the work,
 * which is what it was always for.
 *
 * WHY A SCRIPT AND NOT AN INSTRUCTION TO WRITE A LINE OF JSON. Three reasons, each a failure this
 * replaces: a hand-written line drifts from the schema and the dashboard silently drops it; a model
 * computing its own weighted total will get a different answer from the dashboard's; and the weights
 * would end up duplicated in prose. The weights, the XP curve and the schema live in ledger.mjs, and
 * this is the only door into them.
 *
 *   node score.mjs grade --ask="<their words>" --framing=80 --leverage=70 --learning=90 --note="..."
 *   node score.mjs show      # the standings, in the terminal
 *   node score.mjs rubric    # what each dimension means — read it BEFORE grading
 *
 * Every number is 0–100. The weighted total is computed here, never supplied.
 */
import { RUBRIC, DIMS, append, newId, standings, total, xpFor, levelFor, clamp } from "./ledger.mjs";
import { repoRoot } from "./adapter.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (k, d) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const has = (k) => argv.some(s => s === `--${k}` || s.startsWith(`--${k}=`));
const REPO = arg("repo", repoRoot());

const bar = (pct, w = 24) => "█".repeat(Math.round((pct / 100) * w)).padEnd(w, "░");
const die = (m) => { console.error(m); process.exit(2); };

const USAGE = `usage:
  score.mjs grade --ask="<verbatim>" --framing=N --leverage=N --learning=N [--note="..."] [--round=ID] [--session=ID]
  score.mjs show
  score.mjs rubric
All dimension scores are 0-100. It grades THE ASK — how the work was requested, not how it turned out.`;

/* ── rubric ───────────────────────────────────────────────────────────────────────────────── */
if (cmd === "rubric") {
  console.log(`\n${standings(REPO).label} — ${RUBRIC.role}, graded by the ${RUBRIC.graded_by}`);
  for (const [k, d] of Object.entries(RUBRIC.dims))
    console.log(`\n  ${d.label} (--${k}, weight ${Math.round(d.w * 100)}%)\n    ${d.what}`);
  console.log("\n  0-100 each. Be a teacher, not a cheerleader: 70 is competent, 85 is good,");
  console.log("  95+ is rare. A ledger where everything is 90 measures nothing.\n");
  process.exit(0);
}

/* ── show ─────────────────────────────────────────────────────────────────────────────────── */
if (cmd === "show" || cmd === undefined) {
  const d = standings(REPO);
  if (!d.exists) { console.log(`No ledger yet at ${d.file}. Nothing has been graded in this repo.`); process.exit(0); }
  console.log(`\n  SCORECARD — ${d.repo}   ${d.rounds} round(s) graded`);
  console.log(`  ${d.file}\n`);
  if (!d.rounds) console.log("  nothing graded yet\n");
  else {
    const trend = d.trend === null ? "" : `  ${d.trend > 0 ? "▲" : d.trend < 0 ? "▼" : "▬"}${Math.abs(d.trend)} vs previous 5`;
    console.log(`  ${d.label.toUpperCase()}  L${d.level.n} ${d.level.name}`);
    console.log(`    ${bar(d.level.pct)}  ${d.xp} XP` + (d.level.next === null ? "  (max)" : `  ${d.level.toNext} to ${d.level.nextName}`));
    console.log(`    avg ${d.avg}/100 over ${d.rounds}   best ${d.best}   worst ${d.worst}   streak ${d.streak}d${trend}`);
    console.log(`    ${Object.entries(RUBRIC.dims).map(([k, m]) => `${m.label} ${d.dims[k] ?? "—"}`).join("   ")}`);
    if (d.badges.length) console.log(`    ${d.badges.map(b => `${b.icon} ${b.name}`).join("   ")}`);
    console.log("");
    console.log("  LAST ROUNDS");
    for (const e of d.entries.slice(-5))
      console.log(`    ${e.ts.slice(0, 10)}  ${String(e.score).padStart(3)}/100  ${(e.ask || "").slice(0, 52).replace(/\s+/g, " ")}`);
    console.log("");
  }
  /* A malformed row is REPORTED. A ledger that quietly drops rows produces a dashboard that is
     confidently wrong, which is the one outcome this whole kit exists to prevent. */
  if (d.legacy) console.log(`  ${d.legacy} delivery grade(s) from the two-sided era are on file and are NOT scored.\n`);
  if (d.broken.length) {
    console.log(`  ⚠ ${d.broken.length} unreadable line(s) in the ledger — NOT counted above:`);
    for (const b of d.broken) console.log(`    line ${b.line}: ${b.why}`);
    console.log("");
  }
  process.exit(0);
}

/* ── grade ────────────────────────────────────────────────────────────────────────────────── */
/* `mentor` is kept as an alias: it was the subcommand's name for three days and appears in commit
   messages and in a vendored copy or two. An alias costs one line; a stale instruction that
   silently does nothing costs a round. */
/* The retired subcommand answers for itself, and must be checked BEFORE the usage bail — behind
   it, the explanation is unreachable and anyone running the old command gets a generic usage dump
   instead of being told what changed. */
if (cmd === "critic") die("`score.mjs critic` is gone: the critic no longer writes a score, it writes a VERDICT.\nRecord it in the verdicts file named by .claude/KIT.md. See the `critic` skill.");
if (cmd !== "grade" && cmd !== "mentor") die(USAGE);

const missing = DIMS.filter(k => !has(k));
if (missing.length) die(`missing required score(s): ${missing.map(k => `--${k}`).join(" ")}\n\n${USAGE}`);

const scores = {};
for (const k of DIMS) {
  const raw = arg(k);
  if (!/^-?\d+(\.\d+)?$/.test(String(raw))) die(`--${k} must be a number 0-100, got "${raw}"`);
  scores[k] = clamp(raw);
}

const before = levelFor(standings(REPO).xp);

const entry = {
  v: 2,
  ts: new Date().toISOString(),
  round: arg("round") || newId("r"),
  session: arg("session", null),
  side: "human",
  ask: (arg("ask", "") || "").slice(0, 1200) || null,
  scores,
  score: total(scores),
  note: arg("note", null),
};
/* The mentor grades the ask BEFORE the work runs, so a missing --ask means the grade cannot be read
   back against the words it graded. Named, not skipped. */
if (!entry.ask) console.error("⚠ no --ask recorded: this grade cannot be read back against the words it graded.");

const file = append(entry, REPO);
const after = levelFor(standings(REPO).xp);

console.log(`\n  ${standings(REPO).label}: ${entry.score}/100   ` +
  Object.entries(RUBRIC.dims).map(([k, m]) => `${m.label} ${scores[k]}`).join("  "));
console.log(`  +${xpFor(entry.score)} XP → ${after.xp}   round ${entry.round}`);
/* The CURRENT level prints on every path. It used to appear only on a level-up, while the ordinary
   path printed the NEXT level's name — so the mentor, told to take the level "from what score.mjs
   printed", was reading a source that did not emit it. Caught by Critic review 3. */
console.log(`  L${after.n} ${after.name}   ${after.xp} XP` +
  (after.next === null ? "   (max)" : `   ${after.toNext} to ${after.nextName}`));
if (after.n > before.n) console.log(`  ★ LEVEL UP — L${after.n} ${after.name}`);
else if (after.next !== null) console.log(`  ${bar(after.pct)}`);
console.log(`  ${file}\n`);
