---
name: bug
description: File a bug into the backlog, then triage it with the rest of the work. Use whenever the operator's message starts with "bug:" (their shorthand for "file this in the backlog"), says "file this", "log this bug", "add this to the backlog", or reports a fault in passing that nobody is fixing right now. Checks it is not already ruled or already fixed; if not, records their words verbatim as a ticket with an id, and triages it with the rest of the open work — ranked, grouped into a stream, and fixed in that order (not jumped to the front).
argument-hint: "<the fault, in their words>"
allowed-tools: [Bash, Read, Edit, Grep, Glob]
---

# /bug — check, file, triage

The user invoked this with: $ARGUMENTS

**What the word means** (Wyatt, Pastry Pirates, 2026-09-28 — his definition, verbatim): *"Bug: should mean check if it
isn't already ruled or fixed, then if not, add this ticket to the backlog; and triage it with the rest of the work to fix
it."* Three steps, in that order. **Filing is not the deliverable; the fix is** — but the fix is scheduled with everything
else, not done ahead of it. The ticket exists so a session with no memory can see the fault, and so the commit that fixes
it can close it.

## In order

1. **Is it already ruled?** Search the repo's rulings (decisions file, intended-behaviour list) for the subject. If it is
   ruled as intended, say so with the quote and the date — do not file it.
2. **Is it already fixed?** `git log --all --since="<a fortnight>" -i --grep="<their words>"` and the log of the file it
   would live in. A fixed bug leaves no ruling, it leaves a commit. **Say the date you checked back to.** If the fix is
   on an unmerged branch, the ticket is "merge it", not "build it".
3. **File it** — title in THEIR nouns (what a player/user sees), body with their words **verbatim** in quotes, where and
   when they saw it (device, screen size, build stamp if they gave one), and every screenshot read pixel by pixel:
   ```bash
   node "$CLAUDE_PLUGIN_ROOT/bin/backlog.mjs" add "THE SAIL BUTTON DOES NOTHING ON A PHONE" \
        --severity red --body "Their words, 2026-09-28: \"…\" · seen at 375×667, build …@abc123"
   ```
   Severity: `red` stops the product or loses work · `yellow` visible and wrong · `note` polish. Commit the backlog.
4. **Measure before calling it confirmed.** Until you have reproduced it in the real product, the ticket says
   **"observed once, not yet measured"**. A comment in the code is not a measurement.
5. **Triage it with the rest of the work.** Rank it against every open ticket (does it stop the product? is it visible? is
   it under the floor? is it waiting on them?) and place it: into the stream that already works that part of the product
   (a Routine to that session), into the next stream to launch, or — when you work alone — in its place in your own
   order. A fault that stops the product still goes first; everything else waits its turn. If it is theirs to decide
   (taste, wording, placement), it goes on their sheet with the options, not into a stream.
6. **Fix it in that order.** The fixing commit carries `Closes: PFX-NNN` on its own line; then `backlog.mjs` to sweep,
   and commit that.
7. **Tell them in one line:** the id, whether it was already ruled or fixed (with the date checked back to), and where it
   sits in the work — which stream has it, or what comes before it.

## What it is not

- Not a place to park your own findings silently: anything you file that you are not fixing now, you name in your reply.
- Not a substitute for asking: a report that is really a design question gets the question, with a recommendation.
