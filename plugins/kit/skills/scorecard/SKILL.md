---
name: scorecard
description: Show the gamified scorecard — how well the user is asking, how well Claude is delivering, both scored out of 100 with XP, levels, streaks and badges. Use when they ask how they are doing, how their prompting is scoring, what their level or streak is, to see or refresh the dashboard, or after a mentor or critic grade has been written and the board is now out of date.
argument-hint: "[show | publish | open]"
allowed-tools: [Bash, Read, Artifact]
---

# /scorecard — the board both operators are on

The user invoked this with: $ARGUMENTS

**Two scores, because this pipeline has two operators in it.** The `mentor` grades how the ask was
framed; the `critic` grades what Claude delivered. Until this existed, only one of them was ever
measured — and it was not the one holding the keyboard.

```bash
BIN=""
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "$CLAUDE_PROJECT_DIR/.claude/kit/bin" ] && BIN="$CLAUDE_PROJECT_DIR/.claude/kit/bin"
[ -z "$BIN" ] && [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -d "$CLAUDE_PLUGIN_ROOT/bin" ] && BIN="$CLAUDE_PLUGIN_ROOT/bin"
[ -n "$BIN" ] || { echo "STOP: cannot find the kit engines. Do not guess a path — say so."; exit 1; }
```

## show — the fast answer, in the terminal

```bash
node "$BIN/score.mjs" show
```

Levels, XP, streaks, per-dimension averages, badges, and the last five head-to-head rounds. **Read
it back in one short paragraph, and lead with the number that moved**, not with a recap of the
layout they are already looking at.

## publish — the board itself

The dashboard is a **published Artifact**: one private page with a stable URL, openable from
anywhere, not a file living only on the laptop that did the grading.

```bash
node "$BIN/dashboard.mjs"        # writes .claude/scorecard.html from the ledger
cat .claude/scorecard.url 2>/dev/null   # the URL, if this repo already has a board
```

**Then use the `Artifact` tool, not a browser and not a copy-paste:**

- **A URL came back** → publish with `url` set to it, and the same `file_path`. That **updates the
  existing board in place**, so the link they have already opened keeps working. Read it first, as the
  tool requires, before publishing over it.
- **No URL** → publish fresh with `icon: "scoreboard"` and a one-sentence `description`. Then write
  the returned URL to `.claude/scorecard.url` **in the same turn**:

  ```bash
  echo "<the url>" > .claude/scorecard.url
  ```

  **Skipping that write is how a repo ends up with four boards and no history.** Each later publish
  makes a new artifact, the old links rot, and nothing on screen says which one is current.

The page is rendered server-side by `dashboard.mjs` — every number is in the HTML before any script
runs. **Do not hand-edit `.claude/scorecard.html`.** It is regenerated from the ledger on every run,
so an edit is lost at the next grade and, until then, shows a number the ledger does not agree
with.

## open — show them the one that exists

```bash
cat .claude/scorecard.url
```

Then `Artifact` with `action: "open"` and that URL. Do not regenerate or republish first unless a
grade has been written since it was last built — `score.mjs show` says how many grades exist, and
the board's own masthead says when it was generated.

## What the numbers mean

| | graded by | dimensions (weight) |
|---|---|---|
| **The operator** — the prompt | `mentor`, before the work runs | Framing 40% · Leverage 30% · Learnings 30% |
| **Claude** — the delivery | `critic`, after the work runs | Delivery 50% · Evidence 30% · Scope 20% |

XP is earned per round from the score (0–10, with a bonus band at 80/90/95), and eight named tiers
sit on the same thresholds for both sides. Streaks count consecutive days with a graded round, and
break honestly — a streak that stopped two days ago reads 0, not its old length.

**The gap column is the one to point at.** Ask score minus delivery score, per round: a well-framed
ask that still missed is a Claude problem; a vague ask that landed anyway was luck, and luck is not
a process.

## Never fill a hole to make the board look finished

If a side has no grades, the page says so in **What this could not see**, and that block is the most
honest thing on it. Do not seed the ledger with invented rounds, do not grade Claude's work
yourself to fill the empty half, and do not average away a bad round. **A dashboard that renders a
confident chart over missing data is the exact failure the critic exists to catch** — committed by
the scoreboard.
