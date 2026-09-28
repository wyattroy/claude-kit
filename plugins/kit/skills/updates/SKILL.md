---
name: updates
description: The operator's UPDATES page — a published page (never a file path, never a wall of chat) that shows what changed in a build and lets them judge each thing: Pass / Problem and a note per card, a pick for each decision that is theirs, answers saved where the session can read them. Use after work reaches somewhere they can try it (a staging build, a preview), when they ask "what's new", "what should I test", "give me a checklist", "updates", or when a round of decisions needs their picks. Re-uses the same page URL round after round.
argument-hint: "[what to cover — default: everything that reached the test build since the last updates page]"
allowed-tools: [Bash, Read, Write, Edit, Grep, Glob]
---

# /updates — the page they judge the build on

The user invoked this with: $ARGUMENTS

**Why a page** (Pastry Pirates, learned many times): the operator plays the product on a phone and answers from it. A file
path is something they cannot open; a long chat message is something they cannot tick. **Anything they are meant to read,
tick or decide is a published page with a link they can tap** — and they had to ask for its rules twice, so the rules are
built into the tool rather than remembered.

## The contract (built in — `bin/updates.mjs` writes it this way)

- **One card per thing to look at**, each saying: *what to do* (with a tappable link to exactly where), *what "right"
  looks like*, and *why* (their ruling, or the ticket). **Pass / Problem** on every card — the word is Problem, never
  Fail — and **a note box on every card**, not one at the bottom.
- **A question only they can answer is a pick card**: the options as buttons (mark your recommendation), plus "or a
  better idea". Their better third answer is often the most valuable thing on the page.
- **Pictures come from the real product**, played to the moment — never a mock-up — at their device's size, inlined.
- **Answers save as they type**, to the page's shared store so the session can read them back (`db` capability), with
  the device as fallback; **Copy my notes** returns them as ANSWERS / VERDICTS text they can paste.
- **The build it is for is named at the top** (the stamp they should see), so they never judge the wrong build.
- **One sheet, re-used:** publish the next round to the same URL; a new link every round is a link they lose.

## How

1. **Collect what changed** since the last page: merged work, each change's one-line "what you will see", its ruling or
   ticket, the real-product photographs the work took, and every open question that is theirs. Check the test build
   actually carries the commit (its stamp) before writing "play this".
2. **Write the spec** (`<scratch>/updates.json` — see the header of `bin/updates.mjs` for the shape): sections by area
   of the product, in their nouns.
3. **Build:** `node "$CLAUDE_PLUGIN_ROOT/bin/updates.mjs" <scratch>/updates.json` → `<updates-dir>/<key>.html`.
4. **Publish** with the Artifact tool — `capabilities: {db: {}}`, `url` = last round's page to re-use it — and give them
   the link. Record the URL where the next session will find it (a line in the repo's publish record).
5. **Read their answers back** when they say they are done (the page's `updates/<key>` document, or the notes they
   paste), record rulings verbatim in the decisions file, and turn each Problem into a ticket (`bug` skill).

## What it is not

- Not the backlog (that is the `backlog` skill's page) and not a report of what the session did — it is what *they* can
  now try, and how to tell whether it is right.
