---
name: onehelm
description: ONEHELM — "ONE HELM: what?" The operator's one word for "fix the root, not the symptom, and prove it with a number". Use whenever they type ONEHELM (any case), or ask for an architectural / root-cause fix, "stop fixing it in one place at a time", "why does this keep coming back", or before committing any fix to behaviour that more than one screen, mode or caller shows. Owes three answers before any code — the fact in the product's own words, how many places decide it now and after, and the check that goes red if a second place appears — or an honest "THIS IS A PATCH".
argument-hint: "[the thing being fixed, in the operator's words]"
allowed-tools: [Bash, Read, Glob, Grep]
---

# ONEHELM — "ONE HELM: what?"

The user invoked this with: $ARGUMENTS

**Why it is a word and not an adjective** (Wyatt, 2026-09-20, Pastry Pirates): *"i am sick and tired of typing the word
'architectural' to you — it's clearly not working. what would you instruct ME to say to YOU so that YOU write better code
that solves root issues instead of one-offs?"* The word "architectural" names a QUALITY, and a quality can be agreed with
and then not done. **A number cannot.** So he types one word, and it means three answers are owed **before any code**:

1. **The fact, in the product's own words.** "a coin has arrived in a hold" — not "the coinArrived path". If you cannot
   say what the user would say, you do not yet know what you are fixing.
2. **How many places decide it now, and how many after — as numbers.** "Four before, one after" is checkable; "I fixed
   it properly" is not. Count by reading the code (grep every writer, every branch that chooses), not by memory.
3. **The name of the check that goes red if a second one ever appears** — a real path in the repo, which you run, and
   which you have seen go red on a deliberate mutant (a plant of the second place). A check nobody has seen fail is a
   decoration.

**If you cannot answer all three, it is a patch — say so, in those words: `THIS IS A PATCH`, with the reason.** That is
the operator's own way out, kept exactly: the point was never to forbid patches but to stop one shipping in a root fix's
clothes.

## Where the answers go

In the **commit message** of the change, every time — the commit is the record a later session reads. For example:

```
ONEHELM:
1. The fact: "how big a circle gets when it swells".
2. 2 places before (swellRect and the packer, and they disagreed), 1 after (circlePeak).
3. The check: scripts/qa/fan_never_piles_check.mjs goes red on a second.
```

## Making it structural (optional, recommended)

A rule a session must remember is a rule a session forgets. The reference implementation turns ONEHELM into a
**PreToolUse hook on `git commit`**: it reads what is staged, asks the repo's one definition of "is this product code"
(docs and tooling are never asked), and refuses the commit unless the message carries the three answers — the word, a
number, and a path that exists on disk — or a `THIS IS A PATCH` line. See `wyattroy/pastrypirates`:
`.claude/hooks/onehelm-or-say-patch.cjs`, `.claude/hooks/lib/game-code.cjs`, and the check that proves the hook still
bites, `scripts/qa/onehelm_rides_the_commit_check.mjs`.

**Its two limits, so nobody reads more into it than it does:** it checks the SHAPE of the answers (a word, a number, a
path that exists), not their truth — it stops a silent omission and cannot tell a real ONEHELM from a hollow one. Judging
the substance is what `/critic` is for.

## The questions to ask while answering

- **What makes the two screens / modes / callers agree?** If the answer is "nothing — we keep them in step", that is the
  defect, before a line is written.
- **When a second consumer of the same thing appears, converge:** make the first one go through the new path too. Never
  run two side by side.
- **Nothing is a constant** that the product already computes: derive it, and the elegant version usually deletes code.
