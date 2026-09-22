#!/usr/bin/env node
/* mentor_context.mjs — what the mentor hooks inject, and the one check that can actually fail.
 *
 * THE FINDING THIS ANSWERS, Critic review 2, 2026-09-19:
 *
 *   "The entire enforcement for 'the mentor grades every ask' is one file that injects text telling
 *    Claude to write a grade. If Claude ignores it, NOTHING ANYWHERE NOTICES... That is precisely
 *    the old pattern: a mechanism that looks armed and cannot fire. The author diagnosed this exact
 *    disease one layer up — hooks.json says 'A PROMPT YOU ARE HOLDING IS A PROMPT YOU CAN SKIP' —
 *    and then built the fix out of another prompt."
 *
 * It was right, and a third prompt would not fix it. So this one LOOKS.
 *
 * On every user prompt it records the moment, and on the next prompt it asks whether any human-side
 * grade was written in between. If none was, it says so — with a running count of how many turns
 * have gone ungraded, and the dashboard reads the same file and prints the same count in its
 * blind-spot block. That is still not enforcement: nothing can stop a model from ignoring it. But
 * it is a CHECK THAT FAILS WHEN THE THING FAILS, and the failure ends up somewhere they look,
 * which is the whole difference between a guard and a decoration.
 *
 * A skipped grade is not automatically wrong — a trivial message ("yes", "ship it") is supposed to
 * go ungraded. So this REPORTS rather than accuses, and asks for the one-line reason.
 *
 *   node mentor_context.mjs [session-start]
 *
 * Always exits 0 and always prints one valid hook JSON object. A mentor that breaks the session it
 * is coaching has done more harm than the note was worth.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { resolve as resolveOperator } from "./operator.mjs";
import { standings } from "./ledger.mjs";

const FIRST_TURN = process.argv[2] === "session-start";

function repo() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return process.cwd(); }
}

/** The state the check runs on: when the last prompt arrived, and how many have gone ungraded.
 *  Read the ledger's newest human grade; if it is older than the last prompt, that prompt's turn
 *  produced nothing. Every failure mode here degrades to "say nothing extra", never to a crash. */
function watch() {
  const R = repo();
  const stateFile = path.join(R, ".claude", ".mentor-turn");
  const ledgerFile = path.join(R, ".claude", "scorecard.jsonl");
  const now = new Date().toISOString();
  let prev = null, skipped = 0;
  try { const s = JSON.parse(fs.readFileSync(stateFile, "utf8")); prev = s.last || null; skipped = s.skipped || 0; }
  catch { /* no state yet, or unreadable — treat as a first turn rather than as a finding */ }

  let newestGrade = null;
  try {
    for (const line of fs.readFileSync(ledgerFile, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { const e = JSON.parse(line); if (e.side === "human" && (!newestGrade || e.ts > newestGrade)) newestGrade = e.ts; }
      catch { /* a malformed line is the ledger's problem; score.mjs and the board both name it */ }
    }
  } catch { /* no ledger in this repo — nothing is being tracked here, so nothing was skipped */ }

  /* THE GATE, AND THE BUG IT REPLACES. This used to require the ledger FILE to exist before it
     would count a skipped grade — so a repo that had never been graded could never register a
     skip, and the check was blind in exactly the case that matters most: grading that never
     started at all. Caught 2026-09-22 by running the plugin live, where the model skipped the
     grade twice and the counter sat at 0. The same disease this whole file was written to cure.

     The gate is now "is this repo set up for the kit" — a declared adapter, or a ledger already
     on disk. An unconfigured repo stays silent; a configured one is watched from its first turn. */
  const ledgerExists = fs.existsSync(ledgerFile);
  const usesKit = ledgerExists || fs.existsSync(path.join(R, ".claude", "KIT.md"));
  const missed = Boolean(prev && usesKit && (!newestGrade || newestGrade <= prev));
  if (missed) skipped += 1;

  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ last: now, skipped, updated: now }) + "\n");
  } catch { /* an unwritable state file costs the check, not the session */ }

  return { missed, skipped, ledgerExists, newestGrade };
}

/* WHO IS THIS FOR? — asked once, then never again.
 *
 * The kit cannot coach "you" in the second person and then call you by someone else's name on the
 * board. So when nothing has answered — no env var, no repo adapter line, no machine-wide file —
 * every turn carries the question until it is answered. Not just the first turn: if turn one is
 * "yes" or "ship it", a first-turn-only ask is a question nobody ever hears. */
function askWhoBlock() {
  return [
    "",
    "⚠ THIS KIT DOES NOT KNOW WHAT TO CALL YOU YET, and it puts a name on the scoreboard.",
    "BEFORE you do the work, ask — with the question UI, one question, not as prose — what they",
    "would like the mentor and the scoreboard to call them. Offer their git name as one option:",
    '  git config user.name',
    "Then record it, in the same turn:",
    '  node "$CLAUDE_PLUGIN_ROOT/bin/operator.mjs" set --name="<their answer>"',
    "That writes ~/.claude/claude-kit/operator.json (once per machine) and this repo's",
    ".claude/KIT.md if it exists. Until then the board just says \"You\", which works but is a",
    "worse read. Do not guess a name from the git log, the repo owner or the directory path —",
    "what someone wants to be called is theirs to say, and it is one question.",
  ];
}

/* THE SCORE, IN THE REPLY. Asked for 2026-09-22: a score in the mentor's replies, and a short
 * link to the board. A grade written only to a file is a grade nobody reads — the
 * whole point of a score is that it lands where the coaching lands. So the note now ends with one
 * line carrying this round's grade, the level, Claude's side, and the board.
 *
 * Both sides are shown deliberately. The critic runs only when invoked, so Claude's side goes
 * stale while the human's fills up — and a scoreboard that only ever measures one operator is the
 * exact asymmetry this kit was built to remove. Printing "Claude ungraded" every turn is the
 * honest way to make that visible instead of quietly showing one number. */
function boardLine(repo) {
  try {
    const S = standings(repo);
    const h = S.sides.human, c = S.sides.claude;
    let url = null;
    try { url = fs.readFileSync(path.join(repo, ".claude", "scorecard.url"), "utf8").trim() || null; } catch {}
    const parts = [];
    parts.push(h.rounds ? `so far: ${h.label} avg ${h.avg}/100 over ${h.rounds}, L${h.level.n} ${h.level.name}, ${h.xp} XP, streak ${h.streak}d`
                        : "so far: nothing graded on the human side yet");
    parts.push(c.rounds ? `Claude avg ${c.avg}/100 over ${c.rounds}` : "Claude UNGRADED (the critic has never run here)");
    /* THE ASYMMETRY, MEASURED RATHER THAN FELT. The mentor grades every ask; the critic grades
       only when it is invoked. So the human side fills up while Claude's goes stale, and the board
       slowly becomes what this kit exists to prevent — a scoreboard measuring one operator. The
       gap is a number, so it is reported as one instead of left to be noticed. */
    const behind = h.rounds - c.rounds;
    if (behind >= 2) parts.push(`Claude is ${behind} rounds behind: the critic has not judged the last ${behind} pieces of work. Say so in the note and offer /critic on the most recent substantive one.`);
    if (url) parts.push(`board: ${url}`);
    return parts;
  } catch { return []; }
}

const NOTE_FORMAT = [
  "END the Mentor note with ONE line, exactly this shape, after you have written the grade:",
  "",
  "  **Ask N/100** · framing N · leverage N · learnings N · L<k> <Level>, <xp> XP · Claude <M>/100 · [board](<url>)",
  "",
  "Take every number from what score.mjs printed — it prints the score, the level and the XP on",
  "one line — and do not recompute any of them. Use the board URL",
  "below if one is given; omit the [board](...) segment entirely if none is. If Claude's side has",
  "no grade, write `Claude ungraded` rather than a number: never invent one, and never reuse the",
  "human score for it. One line, at the end of the note, not a table.",
];

const BEATS = [
  "1. One line restating what you understood them to be asking.",
  "2. If the framing will cost rounds — vague scope, missing context they could have given, a task",
  "   that should be split, backgrounded, or planned first — say so plainly and QUOTE the sharper",
  "   message they could have sent, so they learn the pattern.",
  "3. If the framing was already good, name in a few words what made it work — or skip the note.",
  "   Silence is fine; filler praise is not.",
];

const GRADE = [
  "THEN GRADE THE ASK into this repo's ledger, in the SAME turn — a grade deferred to the end of",
  "the work is a grade written by someone who now knows what they meant:",
  '  node "$CLAUDE_PLUGIN_ROOT/bin/score.mjs" mentor --ask="<their exact words>" \\',
  '       --framing=N --leverage=N --learning=N --note="<the one thing that would raise it>"',
  "Framing 40% / Leverage 30% (work the ask SAVED) / Learnings 30% (what it applied). 0-100 each,",
  "teacher-strict: 70 competent, 85 good, 95+ rare. Keep the round id it prints — the critic",
  "attaches the delivery grade to it. Full rubric: the `mentor` skill.",
];

let lines;
if (FIRST_TURN) {
  lines = [
    "## mentor — FIRST TURN OF THIS SESSION",
    "",
    "The standing mentor is loaded (claude-kit). This is turn 1.",
    "",
    "Your first reply opens as their mentor: say hi in ONE line, in your own voice, then go",
    "straight into coaching the framing of the prompt they just sent, then do the work.",
    "",
    "Do NOT print a standalone greeting block, a recap of the charter, or a list of what you can",
    "do. They are already asking you something. Greet them inside the answer to that.",
    "",
    "If this repo has a ledger (.claude/scorecard.jsonl), read the last few grades before you write",
    "one — the Learnings dimension asks what they applied from earlier rounds, and that cannot be",
    "judged by a grader who has not read them.",
  ];
  if (!resolveOperator().name) lines.push(...askWhoBlock());
} else {
  const w = watch();
  lines = ["## mentor — active", "",
    "Treat this as a work request unless it is trivial (\"yes\", \"ship it\", a question back).",
    "If it is a work request, OPEN your reply with a Mentor note — 2-4 lines, BEFORE any tool call",
    "THAT DOES THE WORK. Going straight into the work is the failure this hook exists for.",
    "",
    "The ONE tool call allowed ahead of the note is score.mjs itself: the note ends with the score,",
    "the score comes from that call, so it necessarily runs first. That is the grading, not the work.",
    "", ...BEATS, "", ...GRADE, "",
    "One coaching beat. Coach the FRAMING, not the taste. Never a lecture, never a list of tips.",
    "", ...NOTE_FORMAT];

  const bl = boardLine(repo());
  if (bl.length) lines.push("", ...bl.map(x => "  " + x));

  if (!resolveOperator().name) lines.push(...askWhoBlock());

  if (w.missed) {
    lines.push("",
      `⚠ THE PREVIOUS TURN PRODUCED NO GRADE. ${w.skipped} turn${w.skipped === 1 ? " has" : "s have"} gone ungraded in this repo.`,
      "This is correct ONLY if that message was trivial. If it was a work request, say so in one line",
      "and grade it now with the round it belonged to — do not let it disappear. The board reads the",
      "same counter and prints it under 'What this could not see', so this does not stay between us.");
  }
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: FIRST_TURN ? "SessionStart" : "UserPromptSubmit",
    additionalContext: lines.join("\n"),
    mentor: FIRST_TURN ? "first-turn" : "active",
  },
}));
