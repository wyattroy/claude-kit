#!/usr/bin/env node
/* lessons.mjs — Hard Won Lessons: what the critic teaches Claude.
 *
 * Wyatt, 2026-09-22: "the intention: that mentor teaches ME, and Critic teaches YOU. we both need
 * to learn how to do our part of the work better."
 *
 * THE ASYMMETRY THIS CLOSES. The mentor's coaching lands on a person who remembers it — Wyatt
 * carries a note from Tuesday into Thursday. The critic's verdicts landed on a model that does not:
 * every session starts empty, so a fault named in review 2 was met fresh in review 3 and named
 * again. The verdicts file made a RECURRENCE visible to the next critic; it did nothing to stop the
 * recurrence happening.
 *
 * So the verdict is now distilled into a LESSON — short, imperative, durable — and the SessionStart
 * hook reads the lessons back into context before any work begins. That is the whole mechanism:
 * a critic that only accuses teaches nobody; a critic whose findings are read at the start of the
 * next session teaches the only student it has.
 *
 * WHY THIS FILE IS SHORT AND STAYS SHORT. It is injected into EVERY session, so every line is a tax
 * on every session. A lesson that is really a paragraph of context is a lesson nobody keeps. The
 * cap is enforced here rather than hoped for: the newest lessons win, and the hook says out loud
 * when older ones were left out rather than silently truncating the file's own advice.
 *
 *   node lessons.mjs add --lesson="..." [--why="..."] [--from="Review 3"]
 *   node lessons.mjs show [--max=12] [--plain]
 *   node lessons.mjs path
 */
import fs from "node:fs";
import path from "node:path";
import { loadAdapter, repoRoot } from "./adapter.mjs";

export const LESSONS_DEFAULT = ".claude/HARD-WON-LESSONS.md";
/* Injected every session, so bounded on both axes. Twelve lessons is roughly a page — past that a
   reader skims, which is the same as not reading. */
export const MAX_LESSONS = 12;
export const MAX_CHARS = 2600;

const HEADER = `# Hard Won Lessons

**What the critic teaches Claude.** The mentor coaches the person asking; this file is the other
half — the findings from past reviews, read back at the start of every session so a fault named
once is not met fresh next time.

**Newest first. Append-only.** A lesson that turned out wrong is evidence about the reviewer and
stays on the record; write a newer lesson that corrects it rather than editing the old one.

**Every line here is read into every session, so keep them short and imperative.** If it needs a
paragraph of context it is not a lesson yet — it is a verdict, and verdicts live in the reviews file.

---
`;

export function lessonsPath(repo = repoRoot()) {
  let declared = null;
  try { declared = loadAdapter(repo).values["lessons"] || null; } catch { /* no adapter is fine */ }
  return path.join(repo, declared || LESSONS_DEFAULT);
}

/** Parse the file back into entries. Anything that is not a `## ` block is prose the reader wrote,
 *  and is left alone rather than reformatted — this file is theirs to edit. */
export function readLessons(repo = repoRoot()) {
  const file = lessonsPath(repo);
  if (!fs.existsSync(file)) return { file, exists: false, lessons: [] };
  const text = fs.readFileSync(file, "utf8");
  /* SPLIT, NOT A LOOKAHEAD REGEX. The first version ended its blocks with `(?=^## |\Z)` — `\Z` is
     Python, not JavaScript, so it matched nothing and the LAST lesson in the file was silently
     dropped every time. Found by adding two lessons and getting one back. A parser that quietly
     loses the oldest entry is worse than one that throws, because the file still looks right. */
  const lessons = text.split(/^## /m).slice(1).map(chunk => {
    const nl = chunk.indexOf("\n");
    return nl < 0
      ? { title: chunk.trim(), body: "" }
      : { title: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1).trim() };
  }).filter(l => l.title);
  return { file, exists: true, lessons };
}

export function add({ lesson, why, from }, repo = repoRoot()) {
  const file = lessonsPath(repo);
  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const title = clean(lesson);
  if (!title) throw new Error("a lesson is required");

  fs.mkdirSync(path.dirname(file), { recursive: true });
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : HEADER;
  if (!text.includes("# Hard Won Lessons")) text = HEADER + text;

  const stamp = new Date().toISOString().slice(0, 10);
  const meta = [from ? clean(from) : null, stamp].filter(Boolean).join(" · ");
  const block = `## ${title}\n${why ? clean(why) + "\n" : ""}_${meta}_\n\n`;

  /* NEWEST FIRST, inserted after the header rather than appended at the end — the hook reads from
     the top, and a lesson added to the bottom of a long file is a lesson that never gets injected. */
  const marker = "\n---\n";
  const i = text.indexOf(marker);
  text = i >= 0 ? text.slice(0, i + marker.length) + "\n" + block + text.slice(i + marker.length).replace(/^\n+/, "")
                : text + "\n" + block;
  fs.writeFileSync(file, text);
  return { file, title };
}

/** The block the SessionStart hook injects. Bounded, and it SAYS when it left something out. */
export function contextBlock(repo = repoRoot(), max = MAX_LESSONS) {
  const { exists, lessons } = readLessons(repo);
  if (!exists || !lessons.length) return null;
  const lines = [];
  let used = 0, shown = 0;
  for (const l of lessons.slice(0, max)) {
    const line = `- ${l.title}`;
    if (used + line.length > MAX_CHARS) break;
    lines.push(line); used += line.length; shown++;
  }
  const left = lessons.length - shown;
  return {
    shown, total: lessons.length, left,
    lines: [
      "## Hard won lessons — read these before you work",
      "",
      "Findings from past critic reviews IN THIS REPO. They are here because the critic judged work",
      "that had already gone wrong once; meeting the same fault fresh is the failure this prevents.",
      "",
      ...lines,
      ...(left > 0 ? ["", `(${left} older lesson${left === 1 ? "" : "s"} not shown — the full file is the one named in .claude/KIT.md.)`] : []),
    ],
  };
}

/* ── CLI ──────────────────────────────────────────────────────────────────────────────────── */
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const arg = (k) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };

  if (cmd === "path") { console.log(lessonsPath()); }
  else if (cmd === "add") {
    try {
      const { file, title } = add({ lesson: arg("lesson"), why: arg("why"), from: arg("from") });
      console.log(`  lesson recorded: ${title}`);
      console.log(`  ${file}`);
    } catch (e) { console.error(String(e.message)); process.exit(2); }
  } else if (cmd === "show") {
    const max = Number(arg("max")) || MAX_LESSONS;
    const b = contextBlock(undefined, max);
    if (!b) { console.log("No lessons recorded in this repo yet."); process.exit(0); }
    console.log(argv.includes("--plain") ? b.lines.slice(4).join("\n") : b.lines.join("\n"));
  } else {
    console.error('usage: lessons.mjs add --lesson="..." [--why="..."] [--from="Review 3"] | show [--max=N] | path');
    process.exit(2);
  }
}
