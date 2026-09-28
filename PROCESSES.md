# The processes — every word, what it means, and where it lives

**One page so any repo can find any of them by name.** These grew out of daily work on
[`wyattroy/pastrypirates`](https://github.com/wyattroy/pastrypirates) (Aug–Sep 2026), where each was learned the hard way
and most were then made *structural* — a hook or a check — because a rule a session must remember is a rule a session
forgets. The kit ships the ones that travel as **skills**; the rest are documented here with the reference
implementation's paths so another repo can copy what it needs.

**How to use this page:** say the word (the operator types it; the skill or hook expands it), or copy the named files.

## Command words — the operator types one word, and it means a whole process

| word | what it means | where it lives |
|---|---|---|
| **CLOUDFLEET** | "You are the coordinator": triage the whole backlog, split what is left into as many parallel streams as can run without editing the same function, one **cloud session** per stream, and integrate, test and ship what comes back. | **kit skill** `cloudfleet` · PP: `docs/CLOUDFLEET.md`, `.claude/hooks/cloudfleet-word.cjs`, `.planning/FLEET-2026-09-27.md` (seven rounds, worked) |
| **ONEHELM** | "ONE HELM: what?" — before any code: the fact in the product's words, how many places decide it now and after (numbers), and the check that goes red if a second appears; or say `THIS IS A PATCH`. | **kit skill** `onehelm` · PP: `.claude/hooks/onehelm-or-say-patch.cjs` (refuses a commit without it), `scripts/qa/onehelm_rides_the_commit_check.mjs` |
| **SEATRIAL** | Sail the whole product end to end before it ships: ten real voyages (solo/pass-and-play/crew × phone/tablet/desktop × Chromium/WebKit) with a real mouse, structural checks on every screen and a picture judge; the push to the integration branch is refused unless the trial of that exact tree passed (or an override with a written reason). | PP: `scripts/sea_trial.mjs`, `scripts/qa/push_gate.mjs`, `docs/QA-PROCESS.md` |
| **summary** | 100 words of what changed since the last handoff and what is still waiting on the operator, every blocker with a tappable link. | PP: `.claude/skills/summary/`, `.claude/hooks/summary-means-this.sh` |
| **`bug:`** at the start of a message | Check it is not already ruled or fixed; if not, add it to the backlog; then triage it with the rest of the work to fix it (his definition, 2026-09-28). | **kit skill** `bug` · PP: `.claude/CLAUDE.md`, `scripts/backlog.mjs` |

## The kit's skills

| skill | what it does |
|---|---|
| **`mentor`** | Coaches how each request was framed, before the work runs, and grades the ask (framing 40 · leverage 30 · learnings 30) into `.claude/scorecard.jsonl`. |
| **`critic`** | A fresh agent judges the work: did the thing ASKED for actually happen, was each claim backed by a check that could have failed, did it stay in scope. Writes a verdict and a hard-won lesson. |
| **`scorecard`** | Publishes the ask grades as a board — XP, levels, streaks, badges. |
| **`cloudfleet`** | The CLOUDFLEET process above, repo-agnostic, with the shared rules every stream gets. |
| **`onehelm`** | The ONEHELM three answers, and how to make them a commit hook. |
| **`backlog`** | The ticket pipeline, with a repo-agnostic tool: `bin/backlog.mjs` (ids, `Closes:` trailers, the sweep, `--check`). |
| **`bug`** | `bug:` → check ruled / already fixed → file it in their words → triage it with the rest of the work. |
| **`updates`** | The operator's page for judging a build — Pass / Problem and a note per card, picks for their decisions, answers saved for the session; built by `bin/updates.mjs`. |

## Working agreements — how the work is run (reference: PP `.claude/CLAUDE.md`)

| agreement | the rule, in one line | made structural by (PP) |
|---|---|---|
| **The backlog pipeline** (kit skill `backlog`) | Tickets get ids from one tool; **a fix closes its ticket in its own commit** (`Closes: PP-037` on its own line); a sweep moves closed tickets to a graveyard file with the commit that closed them; a gate fails if a closed ticket is still listed. "A mention is not a close." | `scripts/backlog.mjs` (`--check` in the gates), `.planning/BACKLOG.md`, `.planning/BACKLOG-CLOSED.md` |
| **Search the rulings before diagnosing** | A thing that looks broken has usually been ruled on. Grep the decisions and intended-behaviour files first. | `.claude/hooks/ruled-already.cjs`, `rulings-at-start.cjs`, `.claude/memory/DECISIONS.md`, `docs/INTENDED-BEHAVIOUR.md` |
| **Find out whether it is already fixed** | A fixed bug leaves no ruling, it leaves a commit: `git log --all --since=… -i --grep=…` before spending anything. Say the date you checked back to. | `.claude/hooks/already-fixed.cjs` |
| **Work nobody merged is work the product does not have** | At session start, list the unmerged branches touched recently. | `.claude/hooks/unmerged-work-at-start.mjs` |
| **A turn does not end while the list holds work that is mine** | Never end a reply by counting what is open; a deliverable is not a stopping condition. | `.claude/hooks/work-is-not-done.mjs`, `worklist-at-start.mjs`, `parked-work-is-mine.cjs` |
| **Sessions share what they learn** | Every session appends papercuts to a learnings file; the newest are shown at every start. | `.claude/hooks/learnings-at-start.cjs`, `learnings-at-stop.cjs`, `.claude/memory/LEARNINGS.md` |
| **Rulings are recorded verbatim** | The operator's decisions go in a decisions file in their own words; "my most recent ruling always wins". | `.claude/memory/DECISIONS.md` |
| **Play the real product; never pose a visual** | Serve it, reach the moment, photograph that — a mock recreates what you already believe. Compare host and guest in multiplayer. | `.claude/CLAUDE.md`, `docs/DRIVING-THE-GAME.md` |
| **Measure before calling a fault** | "Observed once, not yet measured" until it is. A comment is not a measurement. When a check condemns something known to work, suspect the check. | `docs/QA-PROCESS.md` |
| **Read the subsystem's doc first** | A table maps each area to the doc to read before touching it. | `.claude/hooks/read-the-doc-first.cjs`, the table in `.claude/CLAUDE.md` |
| **Pages for the operator, not files** (kit skill `updates`) | Anything they read, tick or decide is a published page with a tappable link: Pass/Problem per item, a comment box per card, answers saved where the session can read them, and the same sheet re-used. | `docs/ARTIFACT-GUIDELINES.md`, `scripts/qa/artifact_guidelines_check.mjs` |
| **Pick pages and show branches** | Decisions are shown, not described: real photographs of each option on a pick page; exploratory builds on `*-show` branches that never merge. | PP `.planning/FLEET-2026-09-27.md` rounds four and five |
| **A checklist for every build on staging** | After the game changes, the operator gets a checklist for exactly that build (its stamp named). | `.claude/hooks/playtest-checklist-last.cjs` |
| **The integration branch is the source of truth** | Short branches off it, pushed on their first commit, merged back rebased as soon as they work; production merges only on the operator's word. | PP `docs/GIT-AND-DEPLOY.md` |
| **A machine never silently holds work** | Pull on arrival; on leaving, say plainly if anything exists only here. | `.claude/hooks/machine-handoff.cjs` |
| **Kill what you start** | Every headless browser and server, by PID, before replying; never `pkill -f`. | `scripts/qa/stray_probe_check.mjs` |
| **Talk to the operator in their nouns** | Plain words a player would repeat; every proposal says what they will experience, how much of the problem it covers, and what it leaves undone. Times in their zone. Restate every mid-flight instruction. | `.claude/CLAUDE.md` "Working with Wyatt" |
| **Ask 2–5 questions before building, front-loaded** | Only what is genuinely theirs (taste, placement, wording, how much is enough); never sequencing ("do all the work"), never what the code can answer. | `.claude/CLAUDE.md` |
| **A determinism corpus** | Seeded replays of the live engine; a change meant to be inert that moves a replay goes red, and a change meant to move one must say why when it re-cuts the corpus. | `scripts/determinism_corpus.mjs`, `scripts/qa/determinism_corpus_check.mjs` |

## Adopting these in another repo

1. Install the kit (`SETUP.md`) — that brings `mentor`, `critic`, `scorecard`, `cloudfleet`, `onehelm`, `backlog`, `bug` and `updates`.
2. Give the repo its adapter, `.claude/KIT.md` (template: `plugins/kit/templates/KIT-template.md`) — the CLOUDFLEET keys
   are `integration-branch`, `test-command`, `trial-command`, `backlog`, `fleet-record`.
3. Copy the hooks you want from the reference paths above; each file's header says why it exists and what it refuses.
