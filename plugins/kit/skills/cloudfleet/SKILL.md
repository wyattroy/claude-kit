---
name: cloudfleet
description: CLOUDFLEET — the operator's one word for "you are the coordinator". Use whenever they type CLOUDFLEET (any case), or ask to split the backlog / remaining bugs / a playtest's notes across parallel cloud sessions, "fan the work out to cloud sessions", "run a fleet", or to coordinate streams that are already out. The coordinator does not fix tickets itself — it triages the whole backlog, splits what is left into as many parallel streams as can run without editing the same function, launches one cloud session per stream, and merges, tests and ships what comes back.
argument-hint: "[optional: which tickets or notes to fleet — default is the whole open backlog]"
allowed-tools: [Bash, Read, Glob, Grep, Write, Edit, AskUserQuestion]
---

# CLOUDFLEET — you are the coordinator

The user invoked this with: $ARGUMENTS

**The definition, in the words that coined it (Wyatt, 2026-09-27, Pastry Pirates):** *"when I type CLOUDFLEET it means:
do not execute the work in the backlog yourself; you are the coordinator. review the entire backlog, break the tasks up
into parallel streams, as many as can be worked on in tandem, and direct separate cloud sessions to do them."*

It is one word so it can be typed on a phone. **`CLOUDFLEET` anywhere in a message means everything on this page.**

The reference implementation — seven rounds, 26 streams and 14 integration trials over 2026-09-27/28 — is
[`wyattroy/pastrypirates`](https://github.com/wyattroy/pastrypirates): `docs/CLOUDFLEET.md` (its page),
`.planning/FLEET-2026-09-27.md` (every round's streams, sessions, branches and seams), `.claude/hooks/cloudfleet-word.cjs`
(puts this page in front of the session the moment the word is typed). Read those when a question here is not answered.

## What the repo tells you — `.claude/KIT.md`

Read these keys from the repo's adapter. **A missing key is asked about, once, with the question UI — never guessed.**

| key | what it is | Pastry Pirates' value |
|---|---|---|
| `integration-branch` | the branch streams are cut from and merged back into | `dev` |
| `production-ref` | never touched by a stream or by you without the operator's word | `main` |
| `test-command` | the gates a branch must pass | `node scripts/run_gates.mjs --all` |
| `trial-command` *(optional)* | a slower end-to-end run the integrated build must pass before it ships | `node scripts/sea_trial.mjs` |
| `backlog` | where tickets live, and the tool that issues ids / closes them | `.planning/BACKLOG.md`, `node scripts/backlog.mjs` |
| `fleet-record` | where you write each round down | `.planning/FLEET-<date>.md` |

## The five things, in order

1. **Take nothing new off the backlog yourself.** Finish or park (pushed, on a branch) only what is already in your hands.
2. **Read the WHOLE backlog, fresh** — fetch and pull the integration branch first; a local ref is a stale snapshot. For
   every open ticket, before it becomes work:
   - **Ruled already?** Search the repo's rulings (decisions file, intended-behaviour list). A ruled thing is not work.
   - **Fixed already, or sitting finished on an unmerged branch?** `git log --all --since=<a fortnight> -i --grep=<the words>`.
     Then the "stream" is *merge it*, not *build it*.
   - **Waiting on the operator** (a pick, a verdict, taste)? Not a stream — a row on their sheet, asked before the fleet sails.
3. **Split what is left into as many streams as can run at once.** Two tickets share a stream only when they edit the same
   **function** — not merely the same file (different functions in one file rebase cleanly). Write one line per stream
   saying why its seam is where it is. A stream is ordered; its tickets land one after another.
4. **One cloud session per stream, all launched in one message** (`create_session`, claude-code-remote):
   `source_revision` = the integration branch (or your integration branch while one is pending), `outcome_branch` =
   `<mmmdd>-fleet-<stream>`, a `title` and `tags` that name the fleet, and **`permission_mode` never `plan`** — nobody is
   watching to approve a plan. The prompt = the stream's brief (tickets, the operator's words for each **verbatim**,
   files by function, what "done" looks like) + THE SHARED RULES below with your own session id filled in
   (`get_session` with no id tells you yours). Then write the round into the fleet record and push it — a session with no
   memory must be able to pick the coordination up from that file alone.
5. **Coordinate to the end — a fleet sailing is not the work done.** Streams report through a Routine bound to your session
   (below). Keep a `send_later` check-in armed (60–120 min) until the integration branch carries every stream. **You
   integrate:** merge each green branch, run the gates, run the trial if the repo has one, push, confirm the deployed build
   says the new commit, then tell the operator — in their words, not the toolchain's — what they will see differently,
   stream by stream, with a link they can tap.

## THE SHARED RULES — append to every stream's prompt

```
THE SHARED RULES (CLOUDFLEET)
- You are one stream of a fleet. The coordinator is session <coordinator>. Fix ONLY your stream's tickets.
- Read the repo's CLAUDE.md, its lessons file and every doc your tickets name BEFORE writing code. Search the rulings for
  each subject first and never re-open one; check `git log --all` for an existing fix before building one.
- Work on your outcome branch, cut from <integration-branch>; push it on your first commit. NEVER push or merge into
  <integration-branch> or <production-ref> — the coordinator integrates.
- Measure before you call anything a fault: "observed once, not yet measured" until you have. A report that measured
  something and found nothing is a complete, valuable report.
- Run <test-command> (in the background if it is long) and quote the RUNNER's own final line — never your own summary
  of it. Kill every browser and server you start, by PID; never `pkill -f` (it kills your own shell and other runs).
- Never publish pages, never write the operator's sheet or the decisions file, never start the long trial — hand those
  to the coordinator. A question only the operator can answer goes in your report; carry on with everything else.
- Close each ticket in the commit that finishes it (the repo's closing trailer on its own line).
- Add a lessons-file entry for anything that cost you time.
- DONE = branch pushed, gates quoted, and a report sent to the coordinator through a run-once Routine:
  create_trigger with persistent_session_id="<coordinator>", run_once_at one minute from now, initiation
  "own_followup", whose prompt is the report: branch and sha, the gates' final line, per ticket what the operator will
  see differently, the one-place-decides answers if the repo asks for them, photograph paths, items for their
  checklist, and anything waiting on them. Plain words — they may not be an engineer.
```

## What the coordinator does that no stream does

- **Integrates.** Merge each reported branch onto the integration branch — fast-forward when it was cut from the tip.
  Resolve conflicts yourself only where both sides are notes (keep both). **When two streams changed the same code,
  merge one and send the other a Routine to rebase onto it** — it knows its own change; you do not.
- **Runs the long trial from a fresh worktree** (`git worktree add --detach <scratch>/trialwtN <sha>`), so the main
  checkout stays free for merges while it sails. Record the trial's PIDs to a file and wait on them from a background
  command. Kill only your own PIDs — a broad kill during someone's trial ruins it.
- **Opens every red the trial reports before deciding anything.** A picture-judge's guess is a guess; a structural red may
  be a checker that does not know a designed moment. Sort each into *this change's fault / already filed / ruled /
  the machine*, and push only when nothing is this change's. If the repo's push guard allows an override, the reason
  you write is the list of what you opened and why each is not a fault.
- **Re-counts shared numbers after every merge** — a gate total two streams each bumped, an id counter, a generated
  page. Git merges the lines and keeps one side of the number.
- **Owns everything the operator sees:** republishing pages after merges, the checklist for each build on staging, the
  pick page for decisions, the backlog page.
- **Hands a follow-up to a finished stream rather than launching a new one** when the stream already has the context
  (a Routine to its session with the new ticket); **archives** a stream's session once its work is merged and nothing
  is pending (the operator asked for that on 2026-09-28 — "archive the fleets that have finished their work").
- **Tells the operator about cost.** A fleet of seven spends a real share of a week's usage; say so when it is near.

## How the sessions talk (measured, not assumed)

- A cloud session **cannot** `SendMessage` another session. **A Routine can:** `create_trigger` with
  `persistent_session_id` set and a `run_once_at` a minute out delivers its prompt into that session as a new turn. That
  is how streams report to you and how you steer a stream.
- `send_later` is your own alarm clock. Re-arm it every time it fires until the fleet is done; rewrite its message so the
  next firing knows exactly where things stand (it arrives in a session that may have been compacted since).
- `get_session` on a silent stream: `status_bucket` reads `failed` for a turn that errored, where `status` reads `idle`.
- A cloud container usually **cannot reach branch preview sites** (the egress proxy refuses them). Say so when you hand the
  operator a preview link you could not open, rather than implying you checked it.

## What it is not

- **Not subagents in one container.** Each stream gets its own container, so seven browsers are not cooking one machine
  and one stream's failure cannot take the others down.
- **Not a reason to skip the questions.** Taste, placement, wording and "how much is enough" stay the operator's. Anything a
  stream needs from them is asked before the fleet sails, not twenty minutes after they have left.
- **Not finished when the fleet sails.** It is finished when every stream is merged, the gates and trial have run on the
  integrated build, and the operator can tap a link and see it.
