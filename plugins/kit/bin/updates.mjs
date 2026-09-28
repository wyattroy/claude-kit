#!/usr/bin/env node
/* updates.mjs — build the operator's UPDATES page: what changed in this build, one card per thing to look at.
 *
 *   node updates.mjs <spec.json> [out.html]      writes the page (default: <updates-dir>/<key>.html), prints its path
 *
 * The page's contract is the one the operator had to ask for twice (Pastry Pirates docs/ARTIFACT-GUIDELINES.md):
 *   - every card has Pass / Problem (the word is Problem, never Fail) and its own comment box;
 *   - a question is a card with options and an "or a better idea" box;
 *   - answers save as they are typed — to the page's shared store (the `db` capability) so the session can READ them,
 *     with this device's storage as the fallback — and "Copy my notes" gives them back as ANSWERS / VERDICTS text;
 *   - pictures are inlined (data: URIs), so the page never depends on a host the viewer's frame blocks;
 *   - phone width first, light and dark both.
 * Publish it with the Artifact tool, capabilities {db:{}}, and RE-USE the same URL for the next build's updates
 * (pass `url`) — one sheet he keeps, not a new link every round.
 *
 * spec.json:
 * { "key": "staging-2026-09-28",                  // names the saved answers; a new build → a new key
 *   "title": "Staging Checklist Four",             // browser tab / gallery name — two to four words
 *   "heading": "What's new on staging",            // the page's H1
 *   "intro": "Play these on <a href='…'>staging</a>. The build stamp must read <b>…@abc123</b>.",   // HTML allowed
 *   "sections": [ { "id": "learn", "title": "Learn to Play", "lede": "What changed and why, one line",
 *       "items": [ { "id": "l1", "look": "What to do (HTML allowed — a tappable link)",
 *                    "right": "What they should see when it is right", "why": "their ruling, or the ticket",
 *                    "pics": ["path/to/real-game-shot.webp"] },
 *                  { "id": "q1", "kind": "pick", "look": "A question only they can answer",
 *                    "options": ["Keep it", "Change it"] } ] } ] }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter, repoRoot } from "./adapter.mjs";

const [specPath, outArg] = process.argv.slice(2);
if (!specPath) { console.error("updates.mjs <spec.json> [out.html]"); process.exit(1); }
const S = JSON.parse(fs.readFileSync(specPath, "utf8"));
const here = path.dirname(fileURLToPath(import.meta.url));
const tpl = fs.readFileSync(path.join(here, "..", "templates", "updates-page.html"), "utf8");
const E = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const base = path.dirname(path.resolve(specPath));
const pic = p => {
  const f = path.resolve(base, p);
  if (!fs.existsSync(f)) { console.error(`  (missing picture, left out: ${p})`); return ""; }
  const uri = `data:${MIME[path.extname(f).toLowerCase()] || "application/octet-stream"};base64,${fs.readFileSync(f).toString("base64")}`;
  return `<figure><img loading="lazy" src="${uri}" alt=""><figcaption>${E(path.basename(p))}</figcaption></figure>`;
};
const card = (it, sid, n) => {
  const id = it.id || `${sid}-${n + 1}`;
  const figs = (it.pics || []).length ? `<div class="figs">${it.pics.map(pic).join("")}</div>` : "";
  if (it.kind === "pick") {
    const opts = (it.options || []).map(o => `<button type="button" class="opt" data-o="${E(o)}">${E(o)}</button>`).join("");
    return `<div class="item q" data-id="${E(id)}"><h3>${it.look}</h3>${it.right ? `<p>${it.right}</p>` : ""}${figs}<div class="opts">${opts}</div><textarea class="ans" placeholder="Or a better idea"></textarea></div>`;
  }
  return `<div class="item" data-id="${E(id)}"><h3>${it.look}</h3>${it.right ? `<p class="pr"><span>Right</span> ${it.right}</p>` : ""}${it.why ? `<p class="also">${it.why}</p>` : ""}${figs}
<div class="vd"><button type="button" class="pass" data-v="pass">Pass</button><button type="button" class="prob" data-v="problem">Problem</button></div>
<textarea class="cm" placeholder="What you saw"></textarea></div>`;
};
const sections = S.sections || [];
const nav = sections.map(s => `<a href="#${E(s.id)}">${E(s.title)}</a>`).join("");
const body = sections.map(s => `<section id="${E(s.id)}"><h2>${E(s.title)}</h2>${s.lede ? `<p class="lede">${s.lede}</p>` : ""}${(s.items || []).map((it, n) => card(it, s.id, n)).join("")}</section>`).join("\n");
const key = S.key || "updates";
const html = tpl.replace("%%TITLE%%", E(S.title || "Updates")).replace("%%HEADING%%", E(S.heading || S.title || "What's new"))
  .replace("%%INTRO%%", S.intro || "").replace("%%NAV%%", nav).replace("%%BODY%%", body)
  .replace("__KEY__", JSON.stringify(`kit-updates-${key}`)).replace("__DOC__", JSON.stringify(`updates/${key}`));
const root = repoRoot();
const dir = loadAdapter(root).values["updates-dir"] || ".planning/updates";
const out = outArg || path.join(root, dir, `${key}.html`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
const items = sections.reduce((n, s) => n + (s.items || []).length, 0);
console.log(`${out}\n${sections.length} section(s), ${items} card(s). Publish with the Artifact tool (capabilities {db:{}}), re-using last round's url.`);
