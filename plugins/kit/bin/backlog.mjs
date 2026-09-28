#!/usr/bin/env node
/* backlog.mjs — the backlog's one bookkeeper: ids in, closed tickets OUT. Any repo; settings from .claude/KIT.md.
 *
 *   node backlog.mjs                      issue ids to new tickets, and SWEEP closed ones into the graveyard
 *   node backlog.mjs --check              the gate: exit 1 if a ticket git says is closed is still listed
 *   node backlog.mjs add "TITLE" [--body "…"] [--severity red|yellow|note]   file a ticket (the `bug` skill)
 *   node backlog.mjs close ID --why "…"   close by hand (done, wrong, or no longer wanted) — for a close no commit made
 *   node backlog.mjs list                 the open tickets, one line each
 *
 * WHY IT EXISTS (Pastry Pirates, 2026-09-21 — the operator's words are the specification): "design a PROPER
 * documentation pipeline whereby tickets are added to the backlog by either you or me, and ONCE SOLVED THEY ARE
 * REMOVED FROM THE BACKLOG." The backlog was append-only prose: adding had a mechanism, closing had none, so the list
 * only grew, and a session with no memory cannot tell "still true" from "never cleaned up".
 *
 * THE PIPELINE, and the fact it rests on — "this ticket is done" is decided in ONE place, the commit that did the work:
 *   IN    anyone adds a `# ` heading to the backlog; this tool issues it the next id, `[PFX-NNN]`, never reused.
 *   OUT   the commit that fixes it carries a trailer on its own line:   Closes: PFX-037
 *         A MENTION IS NOT A CLOSE — "PFX-037" in prose is a citation; only the trailer closes anything.
 *   SWEEP closed entries MOVE to the graveyard file, stamped with the sha, date and subject that closed them — removed
 *         from the list, and the write-up survives, because "read the graveyard before re-running a settled argument".
 *   GATE  --check fails if a closed ticket is still listed. Put it in the repo's test command.
 *
 * Settings (.claude/KIT.md, `- **key:** value`): backlog (default .planning/BACKLOG.md), backlog-closed
 * (.planning/BACKLOG-CLOSED.md), ticket-prefix (default T). The id ledger sits beside the backlog as backlog-ids.json.
 * Closes are read from commits REACHABLE FROM HEAD only — a `Closes:` on an unmerged branch must not take a ticket
 * off a list whose branch does not have the fix.
 */
import fs from "node:fs";
import path from "node:path";
import { loadAdapter, repoRoot, sh } from "./adapter.mjs";

const ROOT = repoRoot();
const A = loadAdapter(ROOT);
const PFX = (A.values["ticket-prefix"] || "T").replace(/[^A-Za-z0-9]/g, "");
const BACKLOG = path.join(ROOT, A.values.backlog || ".planning/BACKLOG.md");
const CLOSED = path.join(ROOT, A.values["backlog-closed"] || ".planning/BACKLOG-CLOSED.md");
const LEDGER = path.join(path.dirname(BACKLOG), "backlog-ids.json");
const ID = new RegExp(`\\[(${PFX}-\\d{3,})\\]`);
const argv = process.argv.slice(2);
const verb = argv[0] && !argv[0].startsWith("--") ? argv[0] : null;
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const read = f => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const HEADER = `# BACKLOG\n\nOne \`# \` heading per ticket. Ids are issued by the kit's backlog tool; a ticket leaves this file when a commit\ncarries \`Closes: ${PFX}-NNN\` on its own line (or \`backlog.mjs close\`). Closed tickets live in the graveyard file.\n`;
/* entries = every `# ` heading to the next `# ` heading; the text above the first is the file's own header */
function split(text) {
  const lines = text.split("\n"), heads = [];
  let fence = false;
  lines.forEach((l, i) => { if (/^\s*```/.test(l)) fence = !fence; if (!fence && /^# (?!BACKLOG\b)/.test(l)) heads.push(i); });
  const head = lines.slice(0, heads.length ? heads[0] : lines.length).join("\n") || HEADER;
  const entries = heads.map((h, k) => {
    const body = lines.slice(h, k + 1 < heads.length ? heads[k + 1] : lines.length).join("\n").replace(/\n+---\s*\n*$/, "").trimEnd();
    const m = body.match(ID);
    return { text: body, id: m ? m[1] : null, title: lines[h].replace(/^# /, "").replace(ID, "").trim() };
  });
  return { head, entries };
}
const join = (head, entries) => head.replace(/\s*$/, "\n\n") + entries.map(e => e.text).join("\n\n---\n\n") + (entries.length ? "\n" : "");

let ledger = { next: 1, issued: {} };
try { ledger = JSON.parse(read(LEDGER)) || ledger; } catch {}
const saveLedger = () => { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + "\n"); };

/* closes reachable from HEAD: id -> {sha, date, subject} */
function closesFromGit() {
  const out = {};
  const log = sh(`git log --format=%H%x1f%ad%x1f%s%x1f%B%x1e --date=short HEAD`, ROOT) || "";
  for (const rec of log.split("\x1e")) {
    const [sha, date, subject, body = ""] = rec.replace(/^\n/, "").split("\x1f");
    if (!sha) continue;
    for (const m of body.matchAll(new RegExp(`^\\s*Closes:\\s*(${PFX}-\\d{3,})\\s*$`, "gim"))) {
      const id = m[1].toUpperCase();
      if (!out[id]) out[id] = { sha: sha.slice(0, 8), date, subject };
    }
  }
  for (const [id, c] of Object.entries(ledger.closedByHand || {})) if (!out[id]) out[id] = c;
  return out;
}

function issue(entries) {
  let n = 0;
  for (const e of entries) {
    if (e.id) { ledger.issued[e.id] = ledger.issued[e.id] || e.title; continue; }
    const id = `${PFX}-${String(ledger.next++).padStart(3, "0")}`;
    e.text = e.text.replace(/^# /, `# [${id}] `); e.id = id; ledger.issued[id] = e.title; n++;
  }
  return n;
}

const { head, entries } = split(read(BACKLOG));

if (verb === "add") {
  const title = argv[1];
  if (!title) { console.error(`What is it?  backlog.mjs add "WHAT THE PLAYER SEES, IN THEIR WORDS" --body "…"`); process.exit(1); }
  const sev = { red: "🔴 ", yellow: "🟡 ", note: "" }[opt("--severity") || "note"] ?? "";
  const e = { text: `# ${sev}${title}\n\n${opt("--body") || ""}`.trimEnd(), id: null, title };
  entries.push(e); issue([e]); saveLedger();
  fs.mkdirSync(path.dirname(BACKLOG), { recursive: true }); fs.writeFileSync(BACKLOG, join(head, entries));
  console.log(`${e.id}  ${title}`); process.exit(0);
}
if (verb === "close") {
  const id = (argv[1] || "").toUpperCase(), why = opt("--why");
  if (!ID.test(`[${id}]`) || !why) { console.error(`backlog.mjs close ${PFX}-037 --why "done / wrong / no longer wanted, and why"`); process.exit(1); }
  ledger.closedByHand = ledger.closedByHand || {};
  ledger.closedByHand[id] = { sha: "by hand", date: new Date().toISOString().slice(0, 10), subject: why };
  saveLedger(); console.log(`${id} closed by hand — ${why}\nNow run:  node backlog.mjs     (to sweep the file)`); process.exit(0);
}

const closed = closesFromGit();
const stale = entries.filter(e => e.id && closed[e.id]);
if (argv.includes("--check")) {
  const ids = entries.map(e => e.id).filter(Boolean), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (stale.length || dup.length) {
    for (const e of stale) console.error(`  STILL LISTED, CLOSED by ${closed[e.id].sha}: ${e.id} ${e.title.slice(0, 70)}`);
    for (const d of dup) console.error(`  DUPLICATE ID: ${d}`);
    console.error(`FAIL backlog — run \`node backlog.mjs\` to sweep`); process.exit(1);
  }
  console.log(`PASS backlog — ${entries.length} open, unique ids; none of the ${Object.keys(closed).length} closed still listed`); process.exit(0);
}
if (verb === "list") { for (const e of entries) console.log(`${e.id || "(no id yet)"}  ${e.title.slice(0, 100)}`); process.exit(0); }

const issued = issue(entries);
const keep = entries.filter(e => !(e.id && closed[e.id]));
if (stale.length) {
  const prior = read(CLOSED) || `# BACKLOG — CLOSED\n\nTickets that are done, and what closed them. Read this before re-running a settled argument.\n`;
  const add = stale.map(e => { const c = closed[e.id]; return e.text.replace(/^(# .*)$/m, `$1\n\n**CLOSED by commit \`${c.sha}\` (${c.date}) — ${c.subject}**`); });
  fs.mkdirSync(path.dirname(CLOSED), { recursive: true });
  fs.writeFileSync(CLOSED, prior.replace(/\s*$/, "\n\n---\n\n") + add.join("\n\n---\n\n") + "\n");
}
if (issued || stale.length) { fs.mkdirSync(path.dirname(BACKLOG), { recursive: true }); fs.writeFileSync(BACKLOG, join(head, keep)); }
saveLedger();
if (issued) console.log(`Issued ${issued} id(s).`);
if (stale.length) console.log(`Swept ${stale.length} closed ticket(s) into ${path.relative(ROOT, CLOSED)}:\n  ` + stale.map(e => `${e.id}  ${e.title.slice(0, 80)}`).join("\n  "));
console.log(`${keep.length} open · ${Object.keys(closed).length} closed · next is ${PFX}-${String(ledger.next).padStart(3, "0")}`);
