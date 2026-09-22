#!/usr/bin/env node
/* playbook.mjs — is the coaching still current, and who says so?
 *
 * Wyatt, 2026-09-22: "'Every day it researches the newest best practices… and teaches you new
 * tricks.' That daily research runs in your own setup here, but it isn't part of the published kit,
 * so a reader who clones it won't get it. This MUST be part of Mentor -- it's the whole point."
 *
 * WHAT WAS THERE BEFORE, AND WHY IT WAS NOT ENOUGH. The mentor skill carried one sentence: "last
 * refreshed 2026-08-22. If this looks stale (more than ~2 weeks old)... check the docs changelog
 * with web search." That is a prompt asking a model to notice a date and act on it — and a model
 * that skips the note skips the noticing too. Nothing measured the age, so nothing could report it.
 *
 * SO THE DATE IS MACHINE-READABLE NOW. PLAYBOOK.md carries `last-refreshed:` in front matter, this
 * reads it, and the SessionStart hook injects a RESEARCH block when it is overdue. It is still the
 * model that does the research — but it is no longer the model that decides whether research is
 * due, and that is the half that was failing.
 *
 * TWO FILES, ONE ANSWER. The shipped PLAYBOOK.md is the baseline every clone gets. Refreshes are
 * appended to it where it is writable (a kit checkout) and to ~/.claude/claude-kit/playbook.md
 * where it is not (a plugin install). The effective date is the NEWER of the two, so a plugin user
 * who refreshes is not told forever that the shipped baseline is stale.
 *
 *   node playbook.mjs status [--json]
 *   node playbook.mjs path
 *   node playbook.mjs stamp --date=YYYY-MM-DD   # record that a refresh happened
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHIPPED = path.resolve(HERE, "..", "PLAYBOOK.md");
export const LOCAL = path.join(os.homedir(), ".claude", "claude-kit", "playbook.md");

const DAY = 864e5;

function frontMatter(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return {};
    const out = {};
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([a-z-]+):\s*(.+?)\s*$/i);
      if (kv) out[kv[1]] = kv[2];
    }
    return out;
  } catch { return {}; }
}

export function status() {
  const shipped = frontMatter(SHIPPED);
  const local = frontMatter(LOCAL);
  const dates = [shipped["last-refreshed"], local["last-refreshed"]]
    .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const last = dates.length ? dates[dates.length - 1] : null;
  const every = Number(shipped["refresh-every-days"] || local["refresh-every-days"] || 7);
  /* NO DATE MEANS OVERDUE, NOT FINE. A playbook whose age cannot be established is exactly the
     case where confident stale advice is most likely, so it fails towards doing the research. */
  const ageDays = last ? Math.floor((Date.now() - Date.parse(last + "T00:00:00Z")) / DAY) : null;
  return {
    shippedFile: SHIPPED, localFile: LOCAL,
    localExists: fs.existsSync(LOCAL),
    last, every, ageDays,
    stale: ageDays === null || ageDays >= every,
    sources: (fs.existsSync(SHIPPED) ? fs.readFileSync(SHIPPED, "utf8") : "")
      .split("\n").filter(l => /^\s+- https?:\/\//.test(l)).map(l => l.trim().slice(2)),
  };
}

/** Record that a refresh happened: stamp the shipped file if writable, else the machine-local one. */
export function stamp(date = new Date().toISOString().slice(0, 10)) {
  const bump = (file) => {
    const text = fs.readFileSync(file, "utf8");
    if (!/^---\n[\s\S]*?last-refreshed:/m.test(text)) return false;
    fs.writeFileSync(file, text.replace(/^(last-refreshed:\s*).+$/m, `$1${date}`));
    return true;
  };
  try { if (fs.existsSync(SHIPPED)) { fs.accessSync(SHIPPED, fs.constants.W_OK); if (bump(SHIPPED)) return SHIPPED; } } catch {}
  fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
  if (!fs.existsSync(LOCAL)) fs.writeFileSync(LOCAL,
    `---\nlast-refreshed: ${date}\n---\n\n# Playbook refreshes (machine-local)\n\nAppended when the shipped PLAYBOOK.md is not writable — a plugin install rather than a checkout.\n\n`);
  else bump(LOCAL);
  return LOCAL;
}

/** The block the SessionStart hook injects when the playbook is overdue. */
export function refreshBlock() {
  const s = status();
  if (!s.stale) return null;
  return [
    "",
    s.last
      ? `⚠ THE PLAYBOOK IS ${s.ageDays} DAYS OLD (refresh every ${s.every}). Claude Code ships weekly, and`
      : "⚠ THE PLAYBOOK HAS NO DATE, so its age cannot be established. Treat it as overdue:",
    "stale advice delivered confidently is worse than none. BEFORE coaching this session, refresh it:",
    "",
    "1. WebSearch / WebFetch the sources below for anything new since " + (s.last || "the baseline") + ".",
    ...s.sources.map(u => "     " + u),
    "2. Append ONE entry to the `Recent changes` section of the playbook — what actually changed and",
    "   what it means for the advice. \"No material change\" is a real entry: it records that the",
    "   check ran, which is the difference between a refresh and a gap.",
    "3. Stamp it so the clock resets:",
    '     node "$CLAUDE_PLUGIN_ROOT/bin/playbook.mjs" stamp',
    "",
    "Then coach with what you found. If the search turns up nothing relevant, say so in one clause",
    "rather than inventing a trick — a mentor that manufactures novelty to seem useful is worse than",
    "a quiet one.",
  ];
}

/* ── CLI ──────────────────────────────────────────────────────────────────────────────────── */
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || "status";
  const arg = (k) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
  const s = status();
  if (cmd === "path") console.log(s.shippedFile + (s.localExists ? "\n" + s.localFile : ""));
  else if (cmd === "stamp") console.log("stamped: " + stamp(arg("date") || undefined));
  else if (argv.includes("--json")) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`\n  playbook last refreshed: ${s.last || "NEVER (no date on file)"}`);
    console.log(`  age: ${s.ageDays === null ? "unknown" : s.ageDays + " day(s)"}   refresh every: ${s.every}`);
    console.log(`  ${s.stale ? "STALE — the mentor will ask for a refresh this session" : "current"}`);
    console.log(`  sources:`); s.sources.forEach(u => console.log("    " + u));
    console.log("");
  }
}
