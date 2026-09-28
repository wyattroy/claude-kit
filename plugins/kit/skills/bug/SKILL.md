---
name: bug
description: File a bug into the backlog — then fix it. Use whenever the operator's message starts with "bug:" (their shorthand for "file this in the backlog"), says "file this", "log this bug", "add this to the backlog", or reports a fault in passing that nobody is fixing right now. Records their words verbatim, checks it is not already ruled or already fixed, issues it an id, and — unless they said only to file it — goes on to fix it.
argument-hint: "<the fault, in their words>"
allowed-tools: [Bash, Read, Edit, Grep, Glob]
---

# /bug — file it, then fix it

The user invoked this with: $ARGUMENTS

**What the word means** (Wyatt, Pastry Pirates, 2026-09-25): *"`bug:` in his message = file this in the backlog"* — the
tool issues the id, **then fix it.** Filing is not the deliverable; the fix is. The ticket exists so a session with no
memory can see the fault, and so the commit that fixes it can close it.

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
5. **Fix it** — unless they said only to file it, or it is theirs to decide (taste, wording, placement: ask, with the
   options). The fixing commit carries `Closes: PFX-NNN` on its own line; then `backlog.mjs` to sweep, and commit that.
6. **Tell them in one line** what they will see differently, and the id.

## What it is not

- Not a place to park your own findings silently: anything you file that you are not fixing now, you name in your reply.
- Not a substitute for asking: a report that is really a design question gets the question, with a recommendation.
