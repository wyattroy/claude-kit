/* adapter.mjs — how the critic learns what THIS repo keeps where.
 *
 * THE PROBLEM IT SOLVES. The critic is ~90% portable judgment and ~10% "where does this repo keep
 * its evidence". Hard-code that 10% and it works in exactly one repo. Ask for it at runtime and you
 * answer the same questions every session. So it lives in one short file the repo owns:
 * `.claude/KIT.md`.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE, and it is the whole point:
 *
 *     A MISSING INPUT IS NAMED OUT LOUD. IT IS NEVER SILENTLY SKIPPED.
 *
 * A review that looks complete while one of its checks never ran is worse than no review, because
 * it manufactures confidence out of its own blindness. So every consumer gets three things back,
 * not one: the value, WHERE it came from (declared / defaulted by convention / absent), and a
 * ready-made block of prose naming everything that could not be seen. Printing that block is not
 * optional politeness — it is the finding.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export const ADAPTER_FILE = ".claude/KIT.md";

export const sh = (cmd, cwd) => {
  try { return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};

/* THE REPO ROOT IS ASKED OF GIT, NOT ASSUMED FROM THIS FILE'S LOCATION. The plugin lives in
   ~/.claude/plugins; a vendored copy would live inside the repo. Deriving the root from __dirname
   would give a different answer for each, which is exactly the kind of split that rots. */
export function repoRoot(start = process.cwd()) {
  return sh("git rev-parse --show-toplevel", start) || path.resolve(start);
}

/* WHAT PRODUCTION MEANS, ASKED OF GIT RATHER THAN GUESSED.
 *
 * THE BUG THIS SHAPE EXISTS TO PREVENT, found by running it 2026-08-27. The fallback used to be
 * `git rev-parse --abbrev-ref HEAD` — the branch you happen to be on. In a repo with no origin/HEAD
 * that made production mean "wherever I am standing", so a check whose subject is defined as its
 * own answer FIRED EVERY TIME AND COULD NEVER FAIL — which reads exactly like vigilance.
 *
 * So there is no guess of last resort. origin/HEAD is the repo's own answer; a real remote branch
 * called main or master is a sound inference; anything else is NULL, and null means the caller must
 * report UNKNOWN rather than grade against a baseline nobody nominated. */
export function defaultBranch(repo) {
  const ref = sh("git symbolic-ref --quiet refs/remotes/origin/HEAD", repo);
  if (ref) return { value: ref.replace(/^refs\/remotes\/origin\//, ""), source: "git (origin/HEAD)" };
  for (const cand of ["main", "master"]) {
    if (sh(`git rev-parse --verify --quiet refs/remotes/origin/${cand}`, repo))
      return { value: cand, source: `inferred — origin/${cand} exists and origin/HEAD is unset` };
  }
  return { value: null, source: "UNKNOWN — no origin/HEAD, no origin/main or origin/master" };
}

/* Keys the kit may ask for. `need` marks the ones whose absence is a FINDING rather than a shrug:
   without them a named check cannot run at all, and the critic must say so. */
export const KEYS = {
  "production-ref":      { need: false, what: "the branch that reaches real users — the critic's diff baseline" },
  "production-url":      { need: false, what: "where real users see it" },
  "build-stamp-command": { need: false, what: "how to tell WHICH build is being judged" },
  "test-command":        { need: true,  what: "how this repo proves itself" },
  "trial-report":        { need: false, what: "where the last full test run wrote its result" },
  "verdicts":            { need: true,  what: "the standing record of past critic verdicts — what makes a RECURRING fault visible" },
  "scorecard":           { need: false, what: "the append-only grade ledger the mentor and critic both write to" },
  "never-touch":         { need: false, what: "files nothing here may modify, whatever the reason" },
};

const DEFAULTS = {
  verdicts:  ".claude/CRITIC-REVIEWS.md",
  scorecard: ".claude/scorecard.jsonl",
};

/* BACK-COMPAT WITHOUT A SECOND CONVENTION. A repo still carrying the pre-rename CEO file keeps
   working, but the adapter reports the path it actually used — so "which file is this reading?" is
   never a question you answer by reading this source. */
const LEGACY = {
  verdicts: [".claude/CEO-REVIEWS.md", ".planning/CEO-REVIEWS.md"],
};

export function loadAdapter(repo = repoRoot()) {
  const file = path.join(repo, ADAPTER_FILE);
  /* The pre-rename adapter is still read if the new one is absent — a repo that has not been
     migrated yet is not a repo the critic should refuse to enter. Which file was used is reported. */
  const legacyFile = path.join(repo, ".claude", "OFFICERS.md");
  const used = fs.existsSync(file) ? file : (fs.existsSync(legacyFile) ? legacyFile : file);
  const exists = fs.existsSync(used);
  const raw = exists ? fs.readFileSync(used, "utf8") : "";

  /* Parsed from `- **key:** value` lines: readable as prose by a human, unambiguous to a machine,
     and no second format to keep in step. Fenced code blocks are skipped so a template's own
     examples never parse as real settings. */
  const declared = {};
  let inFence = false;
  for (const line of raw.split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^\s*[-*]\s*\*\*([a-z0-9-]+):\*\*\s*(.+?)\s*$/i);
    if (m) declared[m[1].toLowerCase()] = m[2].replace(/^`|`$/g, "").trim();
  }

  const values = {}, origin = {}, absent = [];
  for (const key of Object.keys(KEYS)) {
    if (declared[key]) { values[key] = declared[key]; origin[key] = "declared"; continue; }
    const legacyHit = (LEGACY[key] || []).find(p => fs.existsSync(path.join(repo, p)));
    if (legacyHit) { values[key] = legacyHit; origin[key] = "found on disk (pre-rename path)"; continue; }
    if (DEFAULTS[key]) { values[key] = DEFAULTS[key]; origin[key] = "default by convention"; continue; }
    values[key] = null; origin[key] = "absent"; absent.push(key);
  }

  if (!values["production-ref"]) {
    const d = defaultBranch(repo);
    values["production-ref"] = d.value; origin["production-ref"] = d.source;
    const i = absent.indexOf("production-ref");
    if (d.value && i >= 0) absent.splice(i, 1);            // resolved; stop calling it absent
    if (!d.value && i < 0) absent.push("production-ref");  // still unknown; it must be NAMED
  }

  const p = (k) => (values[k] ? path.join(repo, values[k]) : null);
  const readFile = (k) => { const f = p(k); try { return f ? fs.readFileSync(f, "utf8") : null; } catch { return null; } };

  return {
    repo, file: used, exists, legacy: exists && used === legacyFile, values, origin, absent, path: p, read: readFile,

    /* THE BLOCK EVERY REPORT MUST PRINT. Not a footnote — the honest edge of what was checked.
       A report that omits this is claiming coverage it does not have. */
    blindSpots() {
      const lines = [];
      if (!exists) {
        lines.push(`**This repo has no \`${ADAPTER_FILE}\`.** Everything below was derived from git and`);
        lines.push("convention alone. The critic does not know how this repo is tested, what reaches real");
        lines.push("users, or where past verdicts live — so any check needing those did NOT run.");
      }
      if (exists && used === legacyFile) {
        lines.push("- This repo still declares its settings in the pre-rename `.claude/OFFICERS.md`. It was read,");
        lines.push(`  but rename it to \`${ADAPTER_FILE}\` — two conventions is how one of them goes stale unnoticed.`);
      }
      for (const key of absent) {
        if (!KEYS[key]) continue;
        const flag = KEYS[key].need ? "**CHECK CANNOT RUN**" : "not available";
        lines.push(`- \`${key}\` — ${KEYS[key].what}: ${flag}.`);
      }
      for (const key of Object.keys(KEYS)) {
        const f = p(key);
        if (f && /^(verdicts|scorecard|trial-report)$/.test(key) && !fs.existsSync(f)) {
          lines.push(`- \`${key}\` points at \`${values[key]}\`, which is **not on disk**. Whatever it records is UNKNOWN.`);
        }
      }
      return lines.length
        ? `**WHAT THIS COULD NOT SEE — read this before trusting anything above:**\n${lines.join("\n")}`
        : "_Every input the critic asks for was declared and present._";
    },

    provenance() {
      return Object.keys(KEYS)
        .map(k => `- \`${k}\`: ${values[k] ? `\`${values[k]}\`` : "—"}  _(${origin[k]})_`)
        .join("\n");
    },
  };
}

/* THE MESSAGE THE CRITIC PRINTS WHEN THE ADAPTER IS MISSING. Ruled 2026-08-27: it STOPS,
   asks with the question UI, and offers to write the file. A half-configured repo is never entered
   silently. */
export const NO_ADAPTER_NOTICE = `
━━━ NO ADAPTER — STOP AND ASK BEFORE GRADING ANYTHING ━━━
This repo has no \`${ADAPTER_FILE}\`, so the critic does not know how it is tested, what reaches
real users, or where past verdicts live.

DO NOT quietly proceed with a partial review. Instead:
  1. Say the file is missing and what it costs (name the checks that cannot run).
  2. Ask them — with the question UI, never as prose — the questions in the template.
  3. Offer to write \`${ADAPTER_FILE}\` from their answers, then run again.

The template is at \`templates/KIT-template.md\` beside this script.
`.trim();
