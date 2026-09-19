#!/usr/bin/env node
/* dashboard.mjs — render the scorecard as a self-contained page.
 *
 * Wyatt, 2026-09-19: "both critic would get a score and you would get a score and the dashboard
 * would show both of these... to show how effectively all of the tooling in this pipeline,
 * INCLUDING YOU AS THE HUMAN PROMPTER, are working to execute the work."
 *
 * TWO OPERATORS, ONE BOARD. That is the whole idea and the reason the page is shaped as a
 * head-to-head rather than a stack of KPIs. The pipeline has a human in it and a model in it, and
 * until now only one of them was ever measured.
 *
 * THE PAGE IS RENDERED HERE, NOT IN THE BROWSER. Every number, bar and mark is in the HTML before
 * any script runs, so the still frame — the thumbnail, the shared link, the reader who never
 * scrolls — is the whole report. The inline script adds hover readouts and nothing else.
 *
 * IT SAYS WHAT IT COULD NOT SEE. An ungraded side draws no chart and prints why; an unreadable
 * ledger line is named with its line number. A dashboard that renders a confident empty chart over
 * missing data is the exact manufactured confidence the critic exists to catch.
 *
 *   node dashboard.mjs [--repo=/abs/path] [--out=.claude/scorecard.html]
 */
import fs from "node:fs";
import path from "node:path";
import { standings, RUBRIC, SIDES, LEVELS, THRESHOLDS, BADGES } from "./ledger.mjs";
import { repoRoot } from "./adapter.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const REPO = arg("repo", repoRoot());
const S = standings(REPO);
const OUT = path.resolve(REPO, arg("out", ".claude/scorecard.html"));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v) => (v === null || v === undefined ? "—" : String(v));
const pct = (v) => Math.max(0, Math.min(100, v));

/* ── the head-to-head plot ────────────────────────────────────────────────────────────────────
   Rounds on x in the order they happened, score 0-100 on y. One scale, one axis, both series on
   it — they measure the same thing (a score out of 100), which is the only condition under which
   two series belong on one chart at all.

   Under three points a line is a decoration rather than a trend, so the marks carry it and the
   path is only drawn once there are two or more points to join. Every series is direct-labelled
   at its last point, so identity never rests on colour alone. */
function plot(rounds) {
  const W = 760, H = 240, L = 40, R = 86, T = 18, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (rounds.length <= 1 ? iw / 2 : (i / (rounds.length - 1)) * iw);
  const y = (v) => T + ih - (v / 100) * ih;

  const grid = [0, 25, 50, 75, 100].map(v =>
    `<line class="grid" x1="${L}" x2="${L + iw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>` +
    `<text class="tick" x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`).join("");

  const series = SIDES.map(side => {
    const pts = rounds.map((r, i) => (r[side] ? { i, v: r[side].score, e: r[side] } : null)).filter(Boolean);
    if (!pts.length) return "";
    const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const last = pts[pts.length - 1];
    return (pts.length > 1 ? `<path class="ln ${side}" d="${d}" fill="none"/>` : "")
      + pts.map(p => `<circle class="pt ${side}" cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5" data-side="${side}" data-i="${p.i}"/>`).join("")
      + `<text class="dl ${side}" x="${(x(last.i) + 12).toFixed(1)}" y="${(y(last.v) + 4).toFixed(1)}">${RUBRIC[side].label} ${last.v}</text>`;
  }).join("");

  const xlabels = rounds.map((r, i) =>
    (rounds.length <= 8 || i % Math.ceil(rounds.length / 8) === 0)
      ? `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(String(r.ts).slice(5, 10))}</text>` : "").join("");

  const hit = rounds.map((r, i) =>
    `<rect class="hit" x="${(x(i) - 14).toFixed(1)}" y="${T}" width="28" height="${ih}" data-i="${i}" tabindex="0"
       aria-label="${esc(String(r.ts).slice(0, 10))}: ask ${r.human ? r.human.score : "ungraded"}, delivery ${r.claude ? r.claude.score : "ungraded"}"/>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ask score and delivery score for each round"
    preserveAspectRatio="xMidYMid meet" id="plot">
    ${grid}<line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${T + ih}"/>
    <line class="cross" id="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" style="opacity:0"/>
    ${series}${xlabels}${hit}</svg>`;
}

/* ── a side's panel ───────────────────────────────────────────────────────────────────────── */
function panel(side) {
  const d = S.sides[side], R = RUBRIC[side];
  if (!d.rounds) return `<section class="op ${side} blank">
      <header><span class="who">${esc(R.label)}</span><span class="role">${esc(R.role)}</span></header>
      <p class="none"><strong>Nothing graded yet.</strong> The ${esc(R.graded_by)} has not written a
      grade for this side in this repo, so every figure for ${esc(R.label)} is unknown rather than zero.</p>
    </section>`;

  const dims = Object.entries(R.dims).map(([k, m]) => `
    <div class="dim">
      <div class="dimhead"><span class="dimname">${esc(m.label)}</span>
        <span class="dimw">${Math.round(m.w * 100)}%</span>
        <span class="dimval">${n(d.dims[k])}</span></div>
      <div class="track"><div class="fill" style="width:${pct(d.dims[k] ?? 0)}%"></div></div>
    </div>`).join("");

  const ladder = LEVELS[side].map((name, i) => {
    const got = d.xp >= THRESHOLDS[i];
    const here = d.level.n === i + 1;
    return `<li class="${got ? "got" : "locked"}${here ? " here" : ""}">
      <span class="lvn">${i + 1}</span><span class="lvname">${esc(name)}</span>
      <span class="lvxp">${THRESHOLDS[i]}</span></li>`;
  }).join("");

  const all = BADGES.filter(b => b.side === side || b.side === "both");
  const got = new Set(d.badges.map(b => b.id));
  const badges = all.map(b => `<li class="${got.has(b.id) ? "got" : "locked"}" title="${esc(b.what)}">
      <span class="bi" aria-hidden="true">${b.icon}</span><span class="bn">${esc(b.name)}</span>
      <span class="bw">${esc(b.what)}</span></li>`).join("");

  const trend = d.trend === null
    ? `<span class="trend flat">no trend yet — a direction needs six rounds</span>`
    : `<span class="trend ${d.trend > 0 ? "up" : d.trend < 0 ? "down" : "flat"}">${d.trend > 0 ? "▲" : d.trend < 0 ? "▼" : "▬"} ${Math.abs(d.trend)} vs previous five</span>`;

  return `<section class="op ${side}">
    <header><span class="who">${esc(R.label)}</span><span class="role">${esc(R.role)}</span></header>
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
    <h3 class="sub">What is being graded</h3>
    <div class="dims">${dims}</div>
    <h3 class="sub">Ladder</h3>
    <ol class="ladder">${ladder}</ol>
    <h3 class="sub">Badges <span class="cnt">${d.badges.length}/${all.length}</span></h3>
    <ul class="badges">${badges}</ul>
  </section>`;
}

/* ── the round log ────────────────────────────────────────────────────────────────────────── */
function log() {
  const byRound = new Map();
  for (const e of S.entries) {
    const k = e.round || `solo-${e.ts}`;
    const r = byRound.get(k) || { round: k, ts: e.ts, ask: null };
    r[e.side] = e; r.ask = r.ask || e.ask; if (e.ts < r.ts) r.ts = e.ts;
    byRound.set(k, r);
  }
  const rows = [...byRound.values()].sort((a, b) => b.ts.localeCompare(a.ts));
  if (!rows.length) return "";
  const cell = (e) => e
    ? `<td class="sc"><span class="scv">${e.score}</span>${e.verdict ? `<span class="pill v-${e.verdict.replace(/\s/g, "_")}">${esc(e.verdict)}</span>` : ""}</td>`
    : `<td class="sc none">ungraded</td>`;
  return `<table class="log">
    <caption>Every graded round, newest first. <span class="gapkey">Gap = ask minus delivery: positive means the ask was framed better than the work that came back.</span></caption>
    <thead><tr><th scope="col">When</th><th scope="col">The ask</th><th scope="col">Ask</th><th scope="col">Delivery</th><th scope="col">Gap</th></tr></thead>
    <tbody>${rows.map(r => {
      const gap = r.human && r.claude ? r.human.score - r.claude.score : null;
      const note = [r.human?.note, r.claude?.note].filter(Boolean).join(" · ");
      return `<tr>
        <td class="when"><time datetime="${esc(r.ts)}">${esc(String(r.ts).slice(0, 10))}</time></td>
        <td class="ask">${r.ask ? `<q>${esc(r.ask.length > 150 ? r.ask.slice(0, 150) + "…" : r.ask)}</q>` : `<span class="none">not recorded</span>`}
            ${note ? `<span class="note">${esc(note)}</span>` : ""}</td>
        ${cell(r.human)}${cell(r.claude)}
        <td class="sc gap">${gap === null ? `<span class="none">—</span>` : `<span class="${gap > 0 ? "pos" : gap < 0 ? "neg" : ""}">${gap > 0 ? "+" : ""}${gap}</span>`}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

/* ── what this could not see ──────────────────────────────────────────────────────────────── */
function blind() {
  const lines = [];
  if (!S.exists) lines.push(`There is no ledger at <code>${esc(path.relative(REPO, S.file))}</code>. <strong>Nothing in this repo has ever been graded</strong> — every figure on this page is absent, not zero.`);
  for (const side of SIDES) if (S.exists && !S.sides[side].rounds)
    lines.push(`<strong>${esc(RUBRIC[side].label)} has no grades.</strong> The ${esc(RUBRIC[side].graded_by)} has never written to this ledger, so the head-to-head cannot be drawn and half this board is unknown.`);
  /* THE SKIPPED-GRADE COUNTER, read from the same file the prompt hook writes. This is where the
     one check that can fail comes to land: a mentor that stops grading is now visible HERE, on the
     board, rather than only in a hook nobody reads. */
  try {
    const st = JSON.parse(fs.readFileSync(path.join(REPO, ".claude", ".mentor-turn"), "utf8"));
    if (st.skipped > 0) lines.push(`<strong>${st.skipped} user turn${st.skipped === 1 ? "" : "s"} went ungraded.</strong> The mentor hook saw a prompt and no grade followed it. Some of those were trivial messages, which are supposed to go ungraded — but the count is not zero, so this board is a sample of the work, not all of it.`);
  } catch { /* no counter yet: the hook has never run here, which is not a finding about the data */ }
  const unpaired = S.entries.filter(e => e.round === "unpaired").length;
  if (unpaired) lines.push(`${unpaired} grade${unpaired === 1 ? " was" : "s were"} filed as <code>unpaired</code> — recorded, but not attached to the ask that produced ${unpaired === 1 ? "it" : "them"}, so ${unpaired === 1 ? "it does" : "they do"} not appear in the gap column.`);
  for (const b of S.broken) lines.push(`Ledger line ${b.line} could not be read (<code>${esc(b.why)}</code>) and is <strong>not counted anywhere on this page</strong>.`);
  if (!lines.length) return `<p class="clean">Every grade in the ledger was readable, and both sides are on the board.</p>`;
  return `<ul class="gaps">${lines.map(l => `<li>${l}</li>`).join("")}</ul>`;
}

const rounds = (() => {
  const m = new Map();
  for (const e of S.entries) {
    const k = e.round || `solo-${e.ts}`;
    const r = m.get(k) || { round: k, ts: e.ts };
    r[e.side] = e; if (e.ts < r.ts) r.ts = e.ts; m.set(k, r);
  }
  return [...m.values()].sort((a, b) => a.ts.localeCompare(b.ts));
})();
const plottable = rounds.filter(r => r.human || r.claude);
const both = SIDES.every(s => S.sides[s].rounds > 0);

const HTML = `<title>${esc(S.repo)} Scorecard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&family=Public+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;700;800&display=swap">
<style>
:root{
  color-scheme:light;
  --ground:#F1F3F0; --surface:#FFFFFF; --sunk:#E7EAE5; --rule:#D5D9D2;
  --ink:#15181A; --ink2:#51575C; --ink3:#828A90;
  --human:#C2410C; --claude:#0369A1;
  --good:#15803D; --warn:#A16207; --bad:#BE123C;
  --shadow:0 1px 2px rgba(20,24,20,.06),0 8px 24px -16px rgba(20,24,20,.30);
  --disp:"Archivo","Helvetica Neue",Arial,sans-serif;
  --body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  color-scheme:dark;
  --ground:#0F1216; --surface:#171A1F; --sunk:#1F242A; --rule:#2B3138;
  --ink:#F1F4F5; --ink2:#A7AFB6; --ink3:#727B82;
  --human:#D9762A; --claude:#2795C4;
  --good:#3FA76A; --warn:#C08A22; --bad:#E06B85;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 10px 28px -18px rgba(0,0,0,.9);
}}
:root[data-theme="dark"]{
  color-scheme:dark;
  --ground:#0F1216; --surface:#171A1F; --sunk:#1F242A; --rule:#2B3138;
  --ink:#F1F4F5; --ink2:#A7AFB6; --ink3:#727B82;
  --human:#D9762A; --claude:#2795C4;
  --good:#3FA76A; --warn:#C08A22; --bad:#E06B85;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 10px 28px -18px rgba(0,0,0,.9);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--body);
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding-inline:20px;padding-block:32px 72px}
h1,h2,h3{margin:0;font-family:var(--disp);font-variation-settings:"wdth" 112;text-wrap:balance}
q{quotes:"\\201C" "\\201D"}
.num,.scv,.xp,.lvxp,.dimval,.gap span,.mini dd,.tick,.dl,.den{font-family:var(--mono);font-variant-numeric:tabular-nums}

/* masthead */
.mast{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 18px;
  border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:26px}
.mast h1{font-size:clamp(26px,5vw,40px);font-weight:900;font-variation-settings:"wdth" 118;
  letter-spacing:-.015em;line-height:1}
.mast .repo{color:var(--ink3);font-weight:700;font-variation-settings:"wdth" 100}
.mast .meta{margin-left:auto;font-family:var(--mono);font-size:11.5px;color:var(--ink3);
  text-align:right;line-height:1.5}
.lede{font-size:16px;color:var(--ink2);max-width:66ch;margin:0 0 30px}
.lede strong{color:var(--ink)}

/* operator panels */
.board{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:30px;align-items:start}
@media (max-width:760px){.board{grid-template-columns:1fr}}
.op{background:var(--surface);border-radius:4px;box-shadow:var(--shadow);padding:20px 20px 24px;
  border-top:4px solid var(--accent)}
.op.human{--accent:var(--human)} .op.claude{--accent:var(--claude)}
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
  font-weight:800;font-variation-settings:"wdth" 100;margin:22px 0 10px}
.sub .cnt{font-family:var(--mono);color:var(--ink2);letter-spacing:0}
.dims{display:flex;flex-direction:column;gap:11px}
.dimhead{display:flex;align-items:baseline;gap:8px;font-size:13px}
.dimname{font-weight:700}
.dimw{font-size:10.5px;color:var(--ink3);font-weight:700}
.dimval{margin-left:auto;font-weight:700}

.ladder{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.ladder li{display:flex;align-items:baseline;gap:9px;font-size:13px;padding:3px 7px;border-radius:2px}
.ladder .lvn{font-family:var(--mono);font-size:10.5px;color:var(--ink3);width:1.1em}
.ladder .lvname{font-weight:500}
.ladder .lvxp{margin-left:auto;font-size:11px;color:var(--ink3)}
.ladder .locked{color:var(--ink3);opacity:.55}
.ladder .got .lvname{font-weight:700;color:var(--ink)}
.ladder .here{background:var(--sunk)}
.ladder .here .lvname{color:var(--accent)}

.badges{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:7px}
@media (max-width:430px){.badges{grid-template-columns:1fr}}
.badges li{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:baseline;
  padding:8px 10px;background:var(--sunk);border-radius:3px}
.badges .bi{grid-row:span 2;font-size:15px;color:var(--accent);line-height:1.2}
.badges .bn{font-weight:700;font-size:12.5px}
.badges .bw{font-size:11px;color:var(--ink3);line-height:1.35}
.badges .locked{opacity:.42}
.badges .locked .bi{color:var(--ink3)}

/* plot */
.card{background:var(--surface);border-radius:4px;box-shadow:var(--shadow);padding:20px;margin-bottom:30px}
.card > h2{font-size:19px;font-weight:800;font-variation-settings:"wdth" 114;margin-bottom:4px}
.card > .say{font-size:13.5px;color:var(--ink2);margin:0 0 14px;max-width:70ch}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 6px;font-size:12px;font-weight:700}
.legend span{display:inline-flex;align-items:center;gap:6px;color:var(--ink2)}
.legend i{width:11px;height:11px;border-radius:50%;display:inline-block}
.plotbox{overflow-x:auto}
#plot{width:100%;min-width:520px;height:auto;display:block}
.grid{stroke:var(--rule);stroke-width:1}
.axis{stroke:var(--rule);stroke-width:1}
.cross{stroke:var(--ink3);stroke-width:1;stroke-dasharray:3 3}
.tick{fill:var(--ink3);font-family:var(--mono);font-size:10.5px}
.ln{stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.ln.human,.pt.human{stroke:var(--human)} .pt.human{fill:var(--human)}
.ln.claude,.pt.claude{stroke:var(--claude)} .pt.claude{fill:var(--claude)}
.pt{stroke:var(--surface);stroke-width:2}
.dl{font-family:var(--mono);font-size:11.5px;font-weight:700}
.dl.human{fill:var(--human)} .dl.claude{fill:var(--claude)}
.hit{fill:transparent;cursor:crosshair}
.hit:focus-visible{fill:var(--sunk);outline:none}
.tip{position:absolute;pointer-events:none;background:var(--ink);color:var(--ground);
  padding:8px 10px;border-radius:3px;font-size:12px;line-height:1.45;opacity:0;transition:opacity .1s;
  box-shadow:0 6px 20px -8px rgba(0,0,0,.6);max-width:260px;z-index:5}
.tip b{font-family:var(--mono)}
.plotwrap{position:relative}

/* log */
/* A table allowed to shrink to phone width does not stay readable — it crushes the ask
   column to one word per line. Tables are the documented exception to the no-sideways-scroll
   rule: give it a floor and let .tablescroll carry it. */
.log{width:100%;min-width:600px;border-collapse:collapse;font-size:13.5px}
.log caption{text-align:left;font-size:12.5px;color:var(--ink3);margin-bottom:10px;caption-side:top}
.log .gapkey{display:block;margin-top:3px}
.log th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink3);font-weight:800;border-bottom:1.5px solid var(--rule);padding:0 10px 7px 0}
.log th:nth-child(n+3),.log td:nth-child(n+3){text-align:right}
.log td{padding:11px 10px 11px 0;border-bottom:1px solid var(--rule);vertical-align:top}
.log .when{color:var(--ink3);font-family:var(--mono);font-size:12px;white-space:nowrap}
.log .ask q{color:var(--ink2)}
.log .note{display:block;font-size:11.5px;color:var(--ink3);margin-top:3px}
.log .scv{font-weight:700;font-size:15px}
.log tr:hover td{background:var(--sunk)}
.log .none{color:var(--ink3);font-size:12px;font-style:italic}
.log .gap .pos{color:var(--good)} .log .gap .neg{color:var(--bad)}
.pill{display:inline-block;margin-left:7px;font-size:10px;font-weight:800;letter-spacing:.06em;
  padding:2px 5px;border-radius:2px;vertical-align:1px;white-space:nowrap}
.v-DONE{background:color-mix(in srgb,var(--good) 16%,transparent);color:var(--good)}
.v-PARTIAL{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}
.v-NOT_DONE{background:color-mix(in srgb,var(--bad) 16%,transparent);color:var(--bad)}
.tablescroll{overflow-x:auto}

/* blind spots */
.blind{border:1.5px solid var(--ink);border-radius:4px;padding:18px 20px;background:transparent}
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
    <h1>Scorecard</h1><span class="repo">${esc(S.repo)}</span>
    <div class="meta">${S.rounds} round${S.rounds === 1 ? "" : "s"} · ${S.entries.length} grade${S.entries.length === 1 ? "" : "s"}<br>
      generated ${esc(S.generated.slice(0, 16).replace("T", " "))} UTC</div>
  </div>

  <p class="lede">Two operators run this pipeline. The <strong>mentor</strong> grades how the work was
  asked for; the <strong>critic</strong> grades what came back. Both write to
  <code>${esc(path.relative(REPO, S.file))}</code>, and this board is that file — nothing here is
  typed in by hand, and nothing that could not be read is quietly left out.</p>

  <div class="board">${panel("human")}${panel("claude")}</div>

  <div class="card plotwrap">
    <h2>Head to head</h2>
    <p class="say">One scale, both operators: a score out of 100 for every round.
    ${both ? "The distance between the lines is the interesting part — a well-framed ask that still missed is a delivery problem; a vague ask that landed anyway was luck." : "Only one side has grades, so there is no distance to read yet."}</p>
    <div class="legend">${SIDES.map(s => `<span><i style="background:var(--${s})"></i>${esc(RUBRIC[s].label)} — ${esc(RUBRIC[s].role)}</span>`).join("")}</div>
    ${plottable.length ? `<div class="plotbox">${plot(plottable)}</div><div class="tip" id="tip"></div>`
      : `<p class="clean">No rounds on record yet. Grade one with <code>score.mjs mentor</code> and this fills in.</p>`}
  </div>

  <div class="card"><h2>The rounds</h2>
    <p class="say">Every grade, with the words it was given for.</p>
    <div class="tablescroll">${log() || `<p class="clean">Nothing graded yet.</p>`}</div>
  </div>

  <div class="blind"><h2>What this could not see</h2>${blind()}</div>

  <footer>claude-kit · mentor grades the ask, critic grades the delivery<br>
    ledger ${esc(path.relative(REPO, S.file))} · regenerate with <code>node dashboard.mjs</code></footer>
</div>

<script>
(function(){
  var ROUNDS = ${JSON.stringify(plottable.map(r => ({
    ts: r.ts, ask: r.ask || r.human?.ask || r.claude?.ask || null,
    human: r.human ? { score: r.human.score, scores: r.human.scores, note: r.human.note } : null,
    claude: r.claude ? { score: r.claude.score, scores: r.claude.scores, note: r.claude.note, verdict: r.claude.verdict } : null,
  })))};
  var LBL = ${JSON.stringify(Object.fromEntries(SIDES.map(s => [s, { label: RUBRIC[s].label, dims: Object.fromEntries(Object.entries(RUBRIC[s].dims).map(([k, m]) => [k, m.label])) }])))};
  var svg = document.getElementById("plot"), tip = document.getElementById("tip"),
      cross = document.getElementById("cross");
  if (!svg || !tip) return;
  var wrap = svg.closest(".plotwrap");
  function line(side, r){
    var e = r[side]; if(!e) return "<div>" + LBL[side].label + ": <b>ungraded</b></div>";
    var parts = Object.keys(e.scores||{}).map(function(k){ return (LBL[side].dims[k]||k) + " " + e.scores[k]; });
    return "<div>" + LBL[side].label + ": <b>" + e.score + "</b>" + (e.verdict ? " " + e.verdict : "") +
           "<br><span style='opacity:.7'>" + parts.join(" · ") + "</span></div>";
  }
  function show(i, cx){
    var r = ROUNDS[i]; if(!r) return;
    tip.innerHTML = "<div style='opacity:.7;margin-bottom:4px'>" + r.ts.slice(0,10) + "</div>" +
                    line("human", r) + line("claude", r);
    tip.style.opacity = 1;
    var box = wrap.getBoundingClientRect();
    var x = cx - box.left, y = svg.getBoundingClientRect().top - box.top;
    tip.style.left = Math.max(8, Math.min(box.width - tip.offsetWidth - 8, x - tip.offsetWidth/2)) + "px";
    tip.style.top = (y + 8) + "px";
    if (cross) { var p = svg.querySelector('.hit[data-i="' + i + '"]');
      if (p) { var xx = +p.getAttribute("x") + +p.getAttribute("width")/2;
        cross.setAttribute("x1", xx); cross.setAttribute("x2", xx); cross.style.opacity = .6; } }
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
console.log(`wrote ${OUT}  (${S.rounds} round(s), ${S.entries.length} grade(s))`);
if (S.broken.length) console.error(`⚠ ${S.broken.length} unreadable ledger line(s) were NOT counted — see the page's "What this could not see".`);
console.log(known ? `publish over the existing board: ${known}` : `no artifact recorded yet — publish this file, then save the URL to .claude/scorecard.url`);
