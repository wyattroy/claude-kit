#!/usr/bin/env node
/* dashboard.mjs — render the scorecard as a self-contained page.
 *
 * ONE OPERATOR, AND IT IS THE HUMAN ONE. The board was a head-to-head until 2026-09-22, when the
 * delivery grade was removed: a score only changes behaviour for someone who carries it between
 * rounds, and a fresh model instance does not. What is left is a record of how well the work was
 * ASKED for, over time — the half nobody could see before, because a prompt scrolls past and
 * nobody writes it down.
 *
 * THE PAGE IS RENDERED HERE, NOT IN THE BROWSER. Every number, bar and mark is in the HTML before
 * any script runs, so the still frame — the thumbnail, the shared link, the reader who never
 * scrolls — is the whole report. The inline script adds hover readouts and nothing else.
 *
 * IT SAYS WHAT IT COULD NOT SEE. An empty ledger, an unreadable line, a turn that went ungraded and
 * the delivery grades left over from the two-sided era are all named on the page. A dashboard that
 * renders a confident chart over missing data is the exact manufactured confidence the critic
 * exists to catch.
 *
 *   node dashboard.mjs [--repo=/abs/path] [--out=.claude/scorecard.html]
 */
import fs from "node:fs";
import path from "node:path";
import { standings, RUBRIC, DIMS, LEVELS, THRESHOLDS, BADGES } from "./ledger.mjs";
import { repoRoot } from "./adapter.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const REPO = arg("repo", repoRoot());
const D = standings(REPO);
const OUT = path.resolve(REPO, arg("out", ".claude/scorecard.html"));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v) => (v === null || v === undefined ? "—" : String(v));
const pct = (v) => Math.max(0, Math.min(100, v));

/* ── the trend plot ───────────────────────────────────────────────────────────────────────────
   One scale, 0-100, rounds in the order they happened. Under three points a line is a decoration
   rather than a trend, so the marks carry it and the path is drawn only once there are two points
   to join. The last point is direct-labelled, so the reading never rests on colour alone. */
function plot(entries) {
  const W = 760, H = 240, L = 40, R = 60, T = 18, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (entries.length <= 1 ? iw / 2 : (i / (entries.length - 1)) * iw);
  const y = (v) => T + ih - (v / 100) * ih;

  const grid = [0, 25, 50, 75, 100].map(v =>
    `<line class="grid" x1="${L}" x2="${L + iw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>` +
    `<text class="tick" x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`).join("");

  const d = entries.map((e, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(e.score).toFixed(1)}`).join(" ");
  const last = entries[entries.length - 1];
  const series = (entries.length > 1 ? `<path class="ln" d="${d}" fill="none"/>` : "")
    + entries.map((e, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(e.score).toFixed(1)}" r="5"/>`).join("")
    + `<text class="dl" x="${(x(entries.length - 1) + 11).toFixed(1)}" y="${(y(last.score) + 4).toFixed(1)}">${last.score}</text>`;

  const xlabels = entries.map((e, i) =>
    (entries.length <= 8 || i % Math.ceil(entries.length / 8) === 0)
      ? `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(String(e.ts).slice(5, 10))}</text>` : "").join("");

  const hit = entries.map((e, i) =>
    `<rect class="hit" x="${(x(i) - 14).toFixed(1)}" y="${T}" width="28" height="${ih}" data-i="${i}" tabindex="0"
       aria-label="${esc(String(e.ts).slice(0, 10))}: ${e.score} out of 100"/>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Score out of 100 for each graded round"
    preserveAspectRatio="xMidYMid meet" id="plot">
    ${grid}<line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${T + ih}"/>
    <line class="cross" id="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" style="opacity:0"/>
    ${series}${xlabels}${hit}</svg>`;
}

/* ── the panels ───────────────────────────────────────────────────────────────────────────── */
function panel(d) {
  if (!d.rounds) return `<section class="op blank">
      <header><span class="who">${esc(d.label)}</span><span class="role">${esc(RUBRIC.role)}</span></header>
      <p class="none"><strong>Nothing graded yet.</strong> The ${esc(RUBRIC.graded_by)} has not written a
      grade in this repo, so every figure here is unknown rather than zero.</p>
    </section>`;

  const dims = Object.entries(RUBRIC.dims).map(([k, m]) => `
    <div class="dim">
      <div class="dimhead"><span class="dimname">${esc(m.label)}</span>
        <span class="dimw">${Math.round(m.w * 100)}%</span>
        <span class="dimval">${n(d.dims[k])}</span></div>
      <div class="track"><div class="fill" style="width:${pct(d.dims[k] ?? 0)}%"></div></div>
      <p class="dimwhat">${esc(m.what)}</p>
    </div>`).join("");

  const ladder = LEVELS.map((name, i) => {
    const got = d.xp >= THRESHOLDS[i], here = d.level.n === i + 1;
    return `<li class="${got ? "got" : "locked"}${here ? " here" : ""}">
      <span class="lvn">${i + 1}</span><span class="lvname">${esc(name)}</span>
      <span class="lvxp">${THRESHOLDS[i]}</span></li>`;
  }).join("");

  const got = new Set(d.badges.map(b => b.id));
  const badges = BADGES.map(b => `<li class="${got.has(b.id) ? "got" : "locked"}">
      <span class="bi" aria-hidden="true">${b.icon}</span><span class="bn">${esc(b.name)}</span>
      <span class="bw">${esc(b.what)}</span></li>`).join("");

  const trend = d.trend === null
    ? `<span class="trend flat">no trend yet — a direction needs six rounds</span>`
    : `<span class="trend ${d.trend > 0 ? "up" : d.trend < 0 ? "down" : "flat"}">${d.trend > 0 ? "▲" : d.trend < 0 ? "▼" : "▬"} ${Math.abs(d.trend)} vs previous five</span>`;

  return `<section class="op">
    <header><span class="who">${esc(d.label)}</span><span class="role">${esc(RUBRIC.role)}</span></header>
    <div class="readout">
      <div class="big"><span class="num">${d.avg}</span><span class="den">/100</span>
        <span class="cap">average over ${d.rounds} round${d.rounds === 1 ? "" : "s"}</span></div>
      <dl class="mini">
        <div><dt>best</dt><dd>${n(d.best)}</dd></div>
        <div><dt>worst</dt><dd>${n(d.worst)}</dd></div>
        <div><dt>streak</dt><dd>${d.streak}<span class="u">d</span></dd></div>
      </dl>
    </div>
    ${trend}
    <div class="lvl">
      <div class="lvlhead"><span class="tier">L${d.level.n}</span><span class="tiername">${esc(d.level.name)}</span>
        <span class="xp">${d.xp} XP</span></div>
      <div class="track xpbar"><div class="fill" style="width:${pct(d.level.pct)}%"></div></div>
      <p class="tonext">${d.level.next === null ? "Top of the ladder." : `${d.level.toNext} XP to <strong>${esc(d.level.nextName)}</strong>`}</p>
    </div>
  </section>
  <section class="op side">
    <h3 class="sub">What is being graded</h3>
    <div class="dims">${dims}</div>
  </section>
  <section class="op side">
    <h3 class="sub">Ladder</h3>
    <ol class="ladder">${ladder}</ol>
    <h3 class="sub">Badges <span class="cnt">${d.badges.length}/${BADGES.length}</span></h3>
    <ul class="badges">${badges}</ul>
  </section>`;
}

function log(d) {
  const rows = [...d.entries].reverse();
  if (!rows.length) return "";
  return `<table class="log">
    <caption>Every graded round, newest first. The score grades <strong>the ask</strong> — how the work was requested, not how it turned out.</caption>
    <thead><tr><th scope="col">When</th><th scope="col">The ask</th><th scope="col">Score</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
        <td class="when"><time datetime="${esc(r.ts)}">${esc(String(r.ts).slice(0, 10))}</time></td>
        <td class="ask">${r.ask ? `<q>${esc(r.ask.length > 160 ? r.ask.slice(0, 160) + "…" : r.ask)}</q>` : `<span class="none">not recorded</span>`}
            ${r.note ? `<span class="note">${esc(r.note)}</span>` : ""}
            <span class="dimstrip">${Object.entries(RUBRIC.dims).map(([k, m]) => `${esc(m.label)} ${r.scores[k] ?? "—"}`).join(" · ")}</span></td>
        <td class="sc"><span class="scv">${r.score}</span></td>
      </tr>`).join("")}</tbody></table>`;
}

function blind(d) {
  const lines = [];
  if (!d.exists) lines.push(`There is no ledger at <code>${esc(path.relative(REPO, d.file))}</code>. <strong>Nothing in this repo has ever been graded</strong> — every figure on this page is absent, not zero.`);
  else if (!d.rounds) lines.push(`The ledger exists but holds no graded rounds.`);
  /* The skipped-grade counter, read from the same file the prompt hook writes. This is where the
     one check that can fail comes to land: a mentor that stops grading is visible HERE, on the
     board, rather than only in a hook nobody reads. */
  try {
    const st = JSON.parse(fs.readFileSync(path.join(REPO, ".claude", ".mentor-turn"), "utf8"));
    if (st.skipped > 0) lines.push(`<strong>${st.skipped} turn${st.skipped === 1 ? "" : "s"} went ungraded.</strong> The mentor hook saw a prompt and no grade followed it. Some were trivial messages, which are supposed to go ungraded — but the count is not zero, so this board is a sample of the work, not all of it.`);
  } catch { /* no counter yet: the hook has never run here, which is not a finding about the data */ }
  if (d.legacy) lines.push(`${d.legacy} delivery grade${d.legacy === 1 ? "" : "s"} from the two-sided era ${d.legacy === 1 ? "is" : "are"} still on file and <strong>not counted anywhere on this page</strong>. The ledger is append-only, so they were left rather than deleted.`);
  for (const b of d.broken) lines.push(`Ledger line ${b.line} could not be read (<code>${esc(b.why)}</code>) and is <strong>not counted anywhere on this page</strong>.`);
  if (!lines.length) return `<p class="clean">Every grade in the ledger was readable, and no turn has gone ungraded.</p>`;
  return `<ul class="gaps">${lines.map(l => `<li>${l}</li>`).join("")}</ul>`;
}

const TIP_DATA = JSON.stringify(D.entries.map(e => ({ ts: e.ts, ask: e.ask, score: e.score, scores: e.scores })));
const DIM_LABELS = JSON.stringify(Object.fromEntries(DIMS.map(k => [k, RUBRIC.dims[k].label])));

const HTML = `<title>${esc(D.repo)} Scorecard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&family=Public+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700;800&display=swap">
<style>
:root{
  color-scheme:light;
  --ground:#F1F3F0; --surface:#FFFFFF; --sunk:#E7EAE5; --rule:#D5D9D2;
  --ink:#15181A; --ink2:#51575C; --ink3:#828A90;
  --accent:#C2410C; --good:#15803D; --bad:#BE123C;
  --shadow:0 1px 2px rgba(20,24,20,.06),0 8px 24px -16px rgba(20,24,20,.30);
  --disp:"Archivo","Helvetica Neue",Arial,sans-serif;
  --body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  color-scheme:dark;
  --ground:#0F1216; --surface:#171A1F; --sunk:#1F242A; --rule:#2B3138;
  --ink:#F1F4F5; --ink2:#A7AFB6; --ink3:#727B82;
  --accent:#D9762A; --good:#3FA76A; --bad:#E06B85;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 10px 28px -18px rgba(0,0,0,.9);
}}
:root[data-theme="dark"]{
  color-scheme:dark;
  --ground:#0F1216; --surface:#171A1F; --sunk:#1F242A; --rule:#2B3138;
  --ink:#F1F4F5; --ink2:#A7AFB6; --ink3:#727B82;
  --accent:#D9762A; --good:#3FA76A; --bad:#E06B85;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 10px 28px -18px rgba(0,0,0,.9);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--body);
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding-inline:20px;padding-block:32px 72px}
h1,h2,h3{margin:0;font-family:var(--disp);font-variation-settings:"wdth" 112;text-wrap:balance}
q{quotes:"\\201C" "\\201D"}
.num,.scv,.xp,.lvxp,.dimval,.mini dd,.tick,.dl,.den{font-family:var(--mono);font-variant-numeric:tabular-nums}
.mast{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 18px;
  border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:26px}
.mast h1{font-size:clamp(26px,5vw,40px);font-weight:900;font-variation-settings:"wdth" 118;
  letter-spacing:-.015em;line-height:1}
.mast .repo{color:var(--ink3);font-weight:700;font-variation-settings:"wdth" 100}
.mast .meta{margin-left:auto;font-family:var(--mono);font-size:11.5px;color:var(--ink3);
  text-align:right;line-height:1.5}
.lede{font-size:16px;color:var(--ink2);max-width:66ch;margin:0 0 30px}
.lede strong{color:var(--ink)}
.board{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:18px;margin-bottom:30px;align-items:start}
@media (max-width:860px){.board{grid-template-columns:1fr 1fr}}
@media (max-width:620px){.board{grid-template-columns:1fr}}
.op{background:var(--surface);border-radius:4px;box-shadow:var(--shadow);padding:20px 20px 24px;
  border-top:4px solid var(--accent)}
.op.side{border-top:4px solid var(--rule)}
.op header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.who{font-family:var(--disp);font-size:24px;font-weight:900;font-variation-settings:"wdth" 120;
  letter-spacing:-.01em;color:var(--accent)}
.role{font-size:11px;text-transform:uppercase;letter-spacing:.11em;color:var(--ink3);font-weight:700}
.op.blank .none{color:var(--ink2);font-size:14px;margin:0}
.readout{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.big .num{font-size:clamp(46px,9vw,62px);font-weight:800;line-height:.9;letter-spacing:-.04em}
.big .den{font-size:17px;color:var(--ink3);margin-left:2px}
.big .cap{display:block;font-size:11.5px;color:var(--ink3);margin-top:6px;
  text-transform:uppercase;letter-spacing:.07em;font-weight:700}
.mini{display:flex;gap:16px;margin:0}
.mini div{text-align:right}
.mini dt{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink3);font-weight:700}
.mini dd{margin:0;font-size:19px;font-weight:700}
.mini .u{font-size:12px;color:var(--ink3)}
.trend{display:inline-block;margin-top:10px;font-size:12px;font-weight:700;color:var(--ink2)}
.trend.up{color:var(--good)} .trend.down{color:var(--bad)}
.lvl{margin-top:18px;padding-top:16px;border-top:1px solid var(--rule)}
.lvlhead{display:flex;align-items:baseline;gap:8px}
.tier{font-family:var(--mono);font-weight:800;font-size:12px;background:var(--accent);color:var(--surface);
  padding:2px 6px;border-radius:2px}
.tiername{font-family:var(--disp);font-weight:800;font-size:17px;font-variation-settings:"wdth" 108}
.lvlhead .xp{margin-left:auto;font-size:13px;font-weight:700;color:var(--ink2)}
.track{height:8px;background:var(--sunk);border-radius:2px;overflow:hidden;margin-top:8px}
.track .fill{height:100%;background:var(--accent);border-radius:2px}
.xpbar{height:12px}
.tonext{margin:7px 0 0;font-size:12.5px;color:var(--ink3)}
.tonext strong{color:var(--ink2)}
.sub{font-size:11px;text-transform:uppercase;letter-spacing:.11em;color:var(--ink3);
  font-weight:800;font-variation-settings:"wdth" 100;margin:0 0 10px}
.op.side .sub:not(:first-child){margin-top:22px}
.sub .cnt{font-family:var(--mono);color:var(--ink2);letter-spacing:0}
.dims{display:flex;flex-direction:column;gap:14px}
.dimhead{display:flex;align-items:baseline;gap:8px;font-size:13px}
.dimname{font-weight:700}
.dimw{font-size:10.5px;color:var(--ink3);font-weight:700}
.dimval{margin-left:auto;font-weight:700}
.dimwhat{margin:6px 0 0;font-size:11.5px;color:var(--ink3);line-height:1.45}
.ladder{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.ladder li{display:flex;align-items:baseline;gap:9px;font-size:13px;padding:3px 7px;border-radius:2px}
.ladder .lvn{font-family:var(--mono);font-size:10.5px;color:var(--ink3);width:1.1em}
.ladder .lvname{font-weight:500}
.ladder .lvxp{margin-left:auto;font-size:11px;color:var(--ink3)}
.ladder .locked{color:var(--ink3);opacity:.55}
.ladder .got .lvname{font-weight:700;color:var(--ink)}
.ladder .here{background:var(--sunk)}
.ladder .here .lvname{color:var(--accent)}
.badges{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.badges li{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:baseline;
  padding:8px 10px;background:var(--sunk);border-radius:3px}
.badges .bi{grid-row:span 2;font-size:15px;color:var(--accent);line-height:1.2}
.badges .bn{font-weight:700;font-size:12.5px}
.badges .bw{font-size:11px;color:var(--ink3);line-height:1.35}
.badges .locked{opacity:.42}
.badges .locked .bi{color:var(--ink3)}
.card{background:var(--surface);border-radius:4px;box-shadow:var(--shadow);padding:20px;margin-bottom:30px}
.card > h2{font-size:19px;font-weight:800;font-variation-settings:"wdth" 114;margin-bottom:4px}
.card > .say{font-size:13.5px;color:var(--ink2);margin:0 0 14px;max-width:70ch}
.plotbox{overflow-x:auto}
#plot{width:100%;min-width:520px;height:auto;display:block}
.grid,.axis{stroke:var(--rule);stroke-width:1}
.cross{stroke:var(--ink3);stroke-width:1;stroke-dasharray:3 3}
.tick{fill:var(--ink3);font-family:var(--mono);font-size:10.5px}
.ln{stroke-width:2;stroke-linejoin:round;stroke-linecap:round;stroke:var(--accent)}
.pt{fill:var(--accent);stroke:var(--surface);stroke-width:2}
.dl{font-family:var(--mono);font-size:11.5px;font-weight:700;fill:var(--accent)}
.hit{fill:transparent;cursor:crosshair}
.hit:focus-visible{fill:var(--sunk);outline:none}
.tip{position:absolute;pointer-events:none;background:var(--ink);color:var(--ground);
  padding:8px 10px;border-radius:3px;font-size:12px;line-height:1.45;opacity:0;transition:opacity .1s;
  box-shadow:0 6px 20px -8px rgba(0,0,0,.6);max-width:280px;z-index:5}
.tip b{font-family:var(--mono)}
.plotwrap{position:relative}
.log{width:100%;min-width:600px;border-collapse:collapse;font-size:13.5px}
.log caption{text-align:left;font-size:12.5px;color:var(--ink3);margin-bottom:10px;caption-side:top}
.log th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink3);font-weight:800;border-bottom:1.5px solid var(--rule);padding:0 10px 7px 0}
.log th:last-child,.log td:last-child{text-align:right}
.log td{padding:11px 10px 11px 0;border-bottom:1px solid var(--rule);vertical-align:top}
.log .when{color:var(--ink3);font-family:var(--mono);font-size:12px;white-space:nowrap}
.log .ask q{color:var(--ink2)}
.log .note{display:block;font-size:11.5px;color:var(--ink3);margin-top:4px}
.log .dimstrip{display:block;font-family:var(--mono);font-size:11px;color:var(--ink3);margin-top:4px}
.log .scv{font-weight:700;font-size:15px}
.log tr:hover td{background:var(--sunk)}
.log .none{color:var(--ink3);font-size:12px;font-style:italic}
.tablescroll{overflow-x:auto}
.blind{border:1.5px solid var(--ink);border-radius:4px;padding:18px 20px}
.blind h2{font-size:14px;text-transform:uppercase;letter-spacing:.1em;font-weight:900;margin-bottom:8px}
.gaps{margin:0;padding-left:20px;font-size:13.5px;color:var(--ink2)}
.gaps li{margin-bottom:6px}
.gaps strong{color:var(--ink)}
.clean{margin:0;font-size:13.5px;color:var(--ink2)}
code{font-family:var(--mono);font-size:.9em;background:var(--sunk);padding:1px 4px;border-radius:2px}
footer{margin-top:26px;font-size:11.5px;color:var(--ink3);font-family:var(--mono);line-height:1.6}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="wrap">
  <div class="mast">
    <h1>Scorecard</h1><span class="repo">${esc(D.repo)}</span>
    <div class="meta">${D.rounds} round${D.rounds === 1 ? "" : "s"} graded<br>
      generated ${esc(D.generated.slice(0, 16).replace("T", " "))} UTC</div>
  </div>

  <p class="lede">This grades <strong>the ask</strong>, not the answer. Claude's output has always
  been reviewable — you can read the diff. The request that produced it was not, because it scrolls
  past and nobody writes it down. The <strong>mentor</strong> grades it before the work runs, into
  <code>${esc(path.relative(REPO, D.file))}</code>, and this board is that file.</p>

  <div class="board">${panel(D)}</div>

  <div class="card plotwrap">
    <h2>Every round</h2>
    <p class="say">One scale, 0 to 100, in the order the rounds happened. The line is the only thing
    here that can tell you whether the framing is actually improving.</p>
    ${D.rounds ? `<div class="plotbox">${plot(D.entries)}</div><div class="tip" id="tip"></div>`
      : `<p class="clean">No rounds on record yet. Grade one with <code>score.mjs grade</code> and this fills in.</p>`}
  </div>

  <div class="card"><h2>The rounds</h2>
    <p class="say">Every grade, with the words it was given for.</p>
    <div class="tablescroll">${log(D) || `<p class="clean">Nothing graded yet.</p>`}</div>
  </div>

  <div class="blind"><h2>What this could not see</h2>${blind(D)}</div>

  <footer>claude-kit · the mentor grades the ask; the critic judges the work and writes a verdict, not a score<br>
    ledger ${esc(path.relative(REPO, D.file))} · regenerate with <code>node dashboard.mjs</code></footer>
</div>

<script>
(function(){
  var ROUNDS = ${TIP_DATA};
  var LBL = ${DIM_LABELS};
  var svg = document.getElementById("plot"), tip = document.getElementById("tip"),
      cross = document.getElementById("cross");
  if (!svg || !tip) return;
  var wrap = svg.closest(".plotwrap");
  function show(i, cx){
    var r = ROUNDS[i]; if(!r) return;
    var dims = Object.keys(r.scores||{}).map(function(k){ return (LBL[k]||k) + " " + r.scores[k]; }).join(" \\u00b7 ");
    tip.innerHTML = "<div style='opacity:.7;margin-bottom:4px'>" + r.ts.slice(0,10) + "</div>" +
      "<div><b>" + r.score + "</b>/100</div>" +
      "<div style='opacity:.7'>" + dims + "</div>" +
      (r.ask ? "<div style='margin-top:5px;opacity:.85'>" + r.ask.slice(0,90).replace(/</g,"&lt;") + "</div>" : "");
    tip.style.opacity = 1;
    var box = wrap.getBoundingClientRect();
    var px = cx - box.left, py = svg.getBoundingClientRect().top - box.top;
    tip.style.left = Math.max(8, Math.min(box.width - tip.offsetWidth - 8, px - tip.offsetWidth/2)) + "px";
    tip.style.top = (py + 8) + "px";
    var p = svg.querySelector('.hit[data-i="' + i + '"]');
    if (cross && p) { var xx = +p.getAttribute("x") + +p.getAttribute("width")/2;
      cross.setAttribute("x1", xx); cross.setAttribute("x2", xx); cross.style.opacity = .6; }
  }
  function hide(){ tip.style.opacity = 0; if (cross) cross.style.opacity = 0; }
  svg.querySelectorAll(".hit").forEach(function(h){
    h.addEventListener("mouseenter", function(ev){ show(+h.dataset.i, ev.clientX); });
    h.addEventListener("mousemove", function(ev){ show(+h.dataset.i, ev.clientX); });
    h.addEventListener("focus", function(){ show(+h.dataset.i, h.getBoundingClientRect().left + 14); });
    h.addEventListener("blur", hide);
  });
  svg.addEventListener("mouseleave", hide);
})();
</script>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, HTML);

const urlFile = path.join(REPO, ".claude", "scorecard.url");
const known = fs.existsSync(urlFile) ? fs.readFileSync(urlFile, "utf8").trim() : null;
console.log(`wrote ${OUT}  (${D.rounds} round(s) graded)`);
if (D.broken.length) console.error(`⚠ ${D.broken.length} unreadable ledger line(s) were NOT counted — see the page's "What this could not see".`);
console.log(known ? `publish over the existing board: ${known}` : `no artifact recorded yet — publish this file, then save the URL to .claude/scorecard.url`);
