---
name: critic
description: Show finished work to a fresh Critic before showing it to the user. Use after any real work — something built, fixed, measured or shipped — to judge whether the thing they ASKED for actually happened, and to grade the delivery into the repo's scorecard. Not after a question answered or a file handed over.
argument-hint: "<the request, VERBATIM — their exact words, not a summary>"
allowed-tools: [Bash, Read, Glob, Grep, Agent, AskUserQuestion, Write, Edit]
---

# /critic — did the thing they asked for happen?

The user invoked this with: $ARGUMENTS

**The sequence is: do the work → run a Critic → relay the Critic's verdict → grade the delivery →
then your own account.**

*(This was called the CEO until 2026-09-19. Same job, honest name: it judges the work, it does not
run anything.)*

## Why this exists, and it is not about honesty

A session once answered a 35-item playtest by shipping 22 fixes, verifying 4, and reporting success.
**Nothing in that report was a lie.** The gap was between what they ASKED for and what was delivered —
and that gap is invisible from inside the work. Adjacent, competent, impressive work that misses the
ask is exactly what this exists to catch.

## Step 1 — is this repo set up?

```bash
# BOTH VARIABLES MUST BE CHECKED FOR EMPTINESS FIRST. With them unset, the obvious one-liner
# `ls -d "$CLAUDE_PLUGIN_ROOT/bin"` resolves to `/bin` — which exists on every Mac — and the next
# line silently runs `node /bin/critic_brief.mjs`. Caught by a review 2026-08-27: a silent wrong
# answer, in the first instruction of a system whose whole claim is that nothing is skipped quietly.
BIN=""
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "$CLAUDE_PROJECT_DIR/.claude/kit/bin" ] && BIN="$CLAUDE_PROJECT_DIR/.claude/kit/bin"
[ -z "$BIN" ] && [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -d "$CLAUDE_PLUGIN_ROOT/bin" ] && BIN="$CLAUDE_PLUGIN_ROOT/bin"
[ -n "$BIN" ] || { echo "STOP: cannot find the kit engines. Neither CLAUDE_PROJECT_DIR/.claude/kit/bin nor CLAUDE_PLUGIN_ROOT/bin resolved. Do not guess a path — say so."; exit 1; }
echo "engine: $BIN"
test -f "$CLAUDE_PROJECT_DIR/.claude/KIT.md" && echo "adapter: yes" || echo "adapter: MISSING"
```

**A repo's own `.claude/kit/bin` wins over the plugin copy when both exist.** That is deliberate: a
repo that carries its own copy (so it survives into a cloud container) must run the copy it can
actually see, not a second one on the laptop. One brain per repo, chosen by presence.

**If the adapter is MISSING, STOP.** Do not run a partial review and present it as a review. Say
it is missing, name what cannot be checked without it, then ask — **with the question UI, never as
prose** — the questions in `templates/KIT-template.md`, and offer to write the file from those
answers. Then continue.

## Step 2 — assemble the brief

```bash
node "$BIN/critic_brief.mjs" --ask="<THEIR EXACT WORDS>"
```

**`--ask` takes their words verbatim.** Not your summary of them. **The summary is where the drift
already happened**, and a reviewer handed a paraphrase grades the paraphrase. If `/critic` was
invoked with no argument, scroll up and take the request from their own message — do not
reconstruct it from what you did.

Fill in the **WHAT WAS DONE, AS CLAIMED** section yourself: files, commits, measurements, **and what
was not done**. Admitting the gaps is not weakness here; a Critic that finds an unadmitted gap
reports a bigger fault than the gap itself.

## Step 3 — hand it to a FRESH agent

Spawn a new general-purpose agent with the brief as its whole prompt.

**FRESH CONTEXT, ALWAYS. Never continue an existing agent, and never review your own work yourself.**
A Critic that inherits your reasoning inherits your blind spot — that is the entire mechanism, and
reusing an agent quietly removes it while looking identical from outside.

## Step 4 — relay the verdict in ITS words

**Especially when it is bad.** A kind paraphrase makes this whole thing theatre, and the paraphraser
is the one with the motive to soften it. Quote its one-sentence headline directly. Then give your
own account, separately, clearly marked as yours.

## Step 5 — record the verdict, or the next review is weaker

Append it to the `verdicts` file named in the adapter (default `.claude/CRITIC-REVIEWS.md`),
**newest at the top, append-only, never edit an old verdict** — a review that turned out wrong is
evidence about the reviewer and belongs on the record exactly as written.

**This step is the one that gets skipped, and skipping it breaks a check nobody will notice is
broken.** Each Critic is handed the previous verdict so it can say whether the same fault is
*recurring*. A verdict nobody recorded is a recurrence check nobody can run.

## Step 6 — grade the delivery into the scorecard

The verdict is prose; the scorecard is the trend. **Both, or the trend is a story you tell yourself.**

```bash
node "$BIN/score.mjs" rubric claude     # what each dimension means, and its weight
node "$BIN/score.mjs" critic \
  --round=<the id the mentor grade printed for THIS ask> \
  --delivery=90 --evidence=70 --scope=100 \
  --verdict=DONE|PARTIAL|NOT_DONE \
  --note="<one line, in the Critic's terms>"
```

| dimension | weight | what it measures |
|---|---|---|
| **Delivery** | 50% | Did the thing they ASKED for actually happen? Not "is this good work." Per item: done, partial, not done. |
| **Evidence** | 30% | Was each claim backed by a check that **could have failed**? A check that cannot fail proves nothing and scores nothing. |
| **Scope** | 20% | Did it stay inside the ask? Unasked-for work costs here, and costs double when it displaced something they did ask for. |

**The scores come from the Critic's findings, not from your sense of how it went.** If the Critic
said PARTIAL, Delivery is not 90. If you cannot find the mentor's round id for this ask, pass
`--round=unpaired` and say so out loud — the dashboard reports unpaired grades rather than hiding
them, and a delivery score floating free of its ask cannot be read against anything.

**Grade like a teacher: 70 is competent, 85 is good, 95+ is rare.** A Claude side that never drops
below 90 is not a high performer, it is a broken instrument.

## Step 7 — refresh the board

```bash
node "$BIN/dashboard.mjs"
```

Then publish or update it per the `scorecard` skill, so the number on screen is the one in the file.
