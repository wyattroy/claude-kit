#!/usr/bin/env node
/* operator.mjs — who the mentor is coaching, asked once and remembered.
 *
 * THE KIT USED TO HAVE ONE USER'S NAME WELDED THROUGH IT — 27 mentions across the skills and the
 * engines, plus eighty third-person pronouns. It worked perfectly for exactly one person and was
 * strange for everybody else: a stranger installing it got coached as though they were him, and
 * the critic was told its reader "is a founder and designer, not an engineer", which for most
 * readers is simply false.
 *
 * So the name is a VALUE now, resolved at runtime, and asked for once:
 *
 *   1. $CLAUDE_KIT_OPERATOR            — an env var wins, for cloud containers and CI
 *   2. <repo>/.claude/KIT.md           — `- **operator:** Name`, per repo, for a shared checkout
 *   3. ~/.claude/claude-kit/operator.json — the machine-wide answer, written once
 *   4. nothing                         — the mentor ASKS, then calls `set` here
 *
 * WHY A MACHINE-WIDE FILE AND NOT JUST THE REPO. Being asked your own name in every repo you open
 * is not a feature. WHY A PER-REPO OVERRIDE AS WELL: a cloud container has no home directory to
 * read, and a repo two people share should not insist both of them are whoever set it up first.
 *
 *   node operator.mjs get                     # print the name, or nothing (exit 1) if unset
 *   node operator.mjs set --name="Ada"        # remember it, machine-wide and in this repo
 *   node operator.mjs set --name="Ada" --repo-only
 *   node operator.mjs where                   # which of the four sources answered, and why
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

export const GLOBAL_FILE = path.join(os.homedir(), ".claude", "claude-kit", "operator.json");

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try { return execSync("git rev-parse --show-toplevel", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return process.cwd(); }
}

/** A name is a label printed on a scoreboard, not a shell argument. Strip anything that would make
 *  it one, and cap it — an unbounded string here ends up in HTML, in a commit message and in a
 *  hook's injected context. */
export function clean(raw) {
  return String(raw ?? "").replace(/[\r\n\t`$<>"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/* A TEMPLATE PLACEHOLDER IS NOT AN ANSWER. KIT-template.md ships
   `- **operator:** <what the mentor and the scoreboard should call you>`, and a repo that copies
   the template unedited must still be ASKED. Checked on the RAW value, before clean() strips the
   angle brackets that identify it — afterwards it is indistinguishable from a real name. */
export const isPlaceholder = (raw) => /^\s*<.*>\s*$/.test(String(raw ?? ""));

export function resolve(repo = repoRoot()) {
  const envRaw = process.env.CLAUDE_KIT_OPERATOR;
  const env = isPlaceholder(envRaw) ? "" : clean(envRaw);
  if (env) return { name: env, source: "$CLAUDE_KIT_OPERATOR" };

  try {
    const adapter = fs.readFileSync(path.join(repo, ".claude", "KIT.md"), "utf8");
    let inFence = false;
    for (const line of adapter.split("\n")) {
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = line.match(/^\s*[-*]\s*\*\*operator:\*\*\s*(.+?)\s*$/i);
      if (m) {
        const raw = m[1].replace(/^`|`$/g, "");
        if (isPlaceholder(raw)) continue;          // the template, unedited — ask rather than assume
        const n = clean(raw);
        if (n) return { name: n, source: ".claude/KIT.md" };
      }
    }
  } catch { /* no adapter in this repo is normal */ }

  try {
    const n = clean(JSON.parse(fs.readFileSync(GLOBAL_FILE, "utf8")).name);
    if (n) return { name: n, source: GLOBAL_FILE };
  } catch { /* never asked on this machine */ }

  return { name: null, source: null };
}

/** The label the scoreboard prints for the human side. Never empty: an unset kit still works, it
 *  just says "You" until someone answers. */
export const label = (repo) => resolve(repo).name || "You";

export function set(name, { repo = repoRoot(), repoOnly = false } = {}) {
  if (isPlaceholder(name)) throw new Error("that is the template's placeholder, not a name — ask, then pass the answer");
  const n = clean(name);
  if (!n) throw new Error("a name is required, and must contain something after cleaning");
  const wrote = [];

  if (!repoOnly) {
    fs.mkdirSync(path.dirname(GLOBAL_FILE), { recursive: true });
    fs.writeFileSync(GLOBAL_FILE, JSON.stringify({ name: n, set: new Date().toISOString() }, null, 2) + "\n");
    wrote.push(GLOBAL_FILE);
  }

  /* The repo adapter is written only when it already exists. Creating a half-filled KIT.md as a
     side effect of answering your name would hand the critic an adapter nobody wrote — and the
     critic's whole contract is to STOP and ask when the adapter is missing, not to find a stub. */
  const adapterPath = path.join(repo, ".claude", "KIT.md");
  if (fs.existsSync(adapterPath)) {
    let text = fs.readFileSync(adapterPath, "utf8");
    if (/^\s*[-*]\s*\*\*operator:\*\*/im.test(text)) {
      text = text.replace(/^(\s*[-*]\s*\*\*operator:\*\*\s*).*$/im, `$1${n}`);
    } else if (/^## The settings\s*$/m.test(text)) {
      text = text.replace(/^## The settings\s*$/m, `## The settings\n\n- **operator:** ${n}`);
    } else {
      text += `\n- **operator:** ${n}\n`;
    }
    fs.writeFileSync(adapterPath, text);
    wrote.push(adapterPath);
  }
  return { name: n, wrote };
}

/* ── CLI ──────────────────────────────────────────────────────────────────────────────────── */
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const arg = (k) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };

  if (cmd === "get") {
    const r = resolve();
    if (!r.name) process.exit(1);
    console.log(r.name);
  } else if (cmd === "where") {
    const r = resolve();
    console.log(r.name ? `${r.name}  (from ${r.source})` : "unset — no env var, no `- **operator:**` in .claude/KIT.md, no ~/.claude/claude-kit/operator.json");
  } else if (cmd === "set") {
    const raw = arg("name");
    if (!raw) { console.error('usage: operator.mjs set --name="What they want to be called" [--repo-only]'); process.exit(2); }
    try {
      const { name, wrote } = set(raw, { repoOnly: argv.includes("--repo-only") });
      console.log(`operator: ${name}`);
      for (const w of wrote) console.log(`  wrote ${w}`);
    } catch (e) { console.error(String(e.message)); process.exit(2); }
  } else {
    console.error("usage: operator.mjs get | where | set --name=\"...\" [--repo-only]");
    process.exit(2);
  }
}
