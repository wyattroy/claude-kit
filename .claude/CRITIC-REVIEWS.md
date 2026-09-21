# Critic reviews — the standing record

*(Renamed from CEO-REVIEWS.md on 2026-09-19 along with the role itself. The verdicts below were
written by what was then called the CEO; they are reproduced unedited, because a record you tidy is
a record you cannot use as evidence.)*

**Each new Critic is handed the previous verdict, so it can say whether the same fault is
recurring.**
A verdict nobody recorded is a recurrence check nobody can run.

**APPEND ONLY. Newest at the top. Never edit an old verdict** — a review that was wrong is evidence
about the reviewer and belongs on the record exactly as it was written.

---

## Review 2 — 2026-09-19 · `b19f52d`, the Critic rename, the purge and the scorecard
**Asked, verbatim:** *"Rename CEO to critic / Repackage Claude Kit to remove all trash... / Make
mentors give a score for how well you asked your prompt... / Create a gamified dashboard..."*

**Verdict: PARTIAL.** First review under the new name, and the first to grade the delivery as a
number: **delivery 65 · evidence 82 · scope 72 → 72/100** (the weighted total is computed by `score.mjs`, not by hand — 0.5·65 + 0.3·82 + 0.2·72).

**Its sentence, in its words:**
> *"You asked for a scoreboard and got a scoring machine that has graded exactly one thing, by hand,
> about itself — everything measurable was measured honestly, and the one unmeasured claim is the
> only one that decides whether any of it works: nobody has ever installed this and watched the
> mentor grade a single real prompt."*

### Per item

| asked for | verdict | what it checked |
|---|---|---|
| Rename CEO → Critic | **DONE** | grepped every surviving file for `ceo`/`officers`/`cto`/`wyclau`/`pastry`/`team-*`; nine hits, all deliberate (the removals table, the back-compat fallback, the rename notes, one quoted line of the author's kept as history). "No stray wiring, no half-renamed path." |
| Remove the baggage | **DONE** | ran `vendor` into a scratch repo (13 files hashed), `check` → IN STEP; edited a vendored file → DRIFTED, exit 1; deleted one → caught too. "Word for word what was claimed." |
| Mentor gives a tracked score | **PARTIAL** | weights in `ledger.mjs` match all four documents exactly; all four guards refused bad input with exit 2; out-of-range clamped; two corrupt ledger lines named by line number. **But the mentor has never graded anything** — the one entry was typed by the session that wrote the grader. |
| Gamified dashboard | **PARTIAL** | figures confirmed baked into the HTML before any script runs; it fed the empty Claude side in a scratch copy and the head-to-head worked. **But the chosen deliverable — a published board with a link — did not exist.** "A gamified dashboard nobody can open is a rendering function." |

### The recurrence catch, which is the point of the mechanism

It named the August fault — *a check that looks like vigilance and cannot fail* — **recurring in new
clothing**, and located it precisely: the whole enforcement for "grade every ask" was a hook
injecting text, with nothing anywhere that notices when the grade never arrives. It also caught the
irony, which is the part worth keeping:

> *"The author diagnosed this exact disease one layer up — `hooks.json` says 'A PROMPT YOU ARE
> HOLDING IS A PROMPT YOU CAN SKIP' — and then built the fix out of another prompt."*

It credited the reporting layer for failing loudly (the board announces the ungraded side), which is
why this was a partial recurrence rather than a clean one.

It also found the two findings Review 1 left **OPEN** still open three weeks later, and one of them
**wider**: vendoring now writes three skills beside the plugin's three, not one beside one.

### Fixed after the verdict, in the same session

The grade above stands as written against `b19f52d` — it is not re-scored for work done after it.

| finding | what was done |
|---|---|
| No published board, no `.claude/scorecard.url` | Published; URL recorded and tracked in git. |
| "Palette was validated" rested on the author's word | `plugins/kit/PALETTE.md` now carries the validator's actual output for both modes. |
| "Nothing wired into settings.json" overstated | Qualified in `install.sh` and `SETUP.md`: true of the plugin, false of a vendored copy. |
| **The recurrence** — nothing notices a skipped grade | `bin/mentor_context.mjs` records each prompt and reports when the turn that followed produced no grade, with a running count the **board prints** under "What this could not see". Proved by making it fire: silent with no ledger, fires on an ungraded turn, quiet again once a grade is written. |
| The skill collision, wider | Not fixed — **still open**, and now said out loud on every `vendor` run and recorded in `SETUP.md`. |
| Nobody has installed this | **Not fixable here.** It needs a real laptop and a live session. It is the top item. |

---

## Review 1 — 2026-08-27 · `4e2a14e`, the officers plugin
**Asked, verbatim:** *"i want ceo and cto to be runnable skills across my repos. how do you make
that happen?"*

**Verdict: PARTIAL. One must-fix before this supervises anything.**

**Its sentence, in its words:**
> *"You asked a question and got a finished system instead of an answer — and the system's single
> safety guarantee, that a supervised agent cannot reach real users, is defeated by typing
> `git push origin refs/heads/main`, which I ran against the real hook and watched sail straight
> through."*

### What it caught, all reproduced before being believed

| finding | status |
|---|---|
| **The fence missed `refs/heads/main`.** The pattern required a space, colon, plus or quote before the branch name; a SLASH was not on the list, so the fully-qualified — most careful — spelling walked past, along with `HEAD:refs/heads/main` and `main:refs/heads/main` | **FIXED.** The fence no longer reads the string; it resolves the refspec's destination. 19 cases now pass, 10 deny / 9 allow |
| **`BIN` resolved to `/bin`.** With `CLAUDE_PLUGIN_ROOT` unset, `ls -d "$CLAUDE_PLUGIN_ROOT/bin"` succeeds on every Mac, so the first instruction in both skills silently ran `node /bin/ceo_brief.mjs` | **FIXED.** Both variables are emptiness-checked; a miss now stops and says so |
| **`hooks.json` failed OPEN.** `2>/dev/null \|\| true` meant any crash allowed the command, contradicting the fail-closed logic inside | **FIXED, and worse than reported.** The adapter was a STATIC import, so an unresolvable adapter killed the process *before any guard ran*. It is now a dynamic import inside a guard, and the lock is found with plain `fs` before anything else loads |
| The template shipped Pastry Pirates' real `deploy-staging.sh` for every other repo to copy | **FIXED** |
| Vendoring installs a second `ceo` skill alongside the plugin's, and nothing decides which wins | **OPEN — unverifiable until the plugin is installed** |
| The command may be `/officers:ceo`, not `/ceo` as the README promises | **OPEN — unverifiable until the plugin is installed** |
| The tooling-repo question was answered in chat and recorded nowhere | **FIXED** — recorded in `README.md` |

### The recurrence catch, which is the point of the mechanism

It named a **pattern across two findings in one commit**: *a check that looks like vigilance and
cannot fail.* The session found one instance itself (production defined as "whatever branch I am
standing on") and shipped another (a guard that fires on the obvious spelling and misses the careful
one). **Two instances, one pattern, and nobody named it as a pattern** — because there was no prior
verdict to hold it against. This file is that record now.

**It proved itself again during the fix.** The first attempt at fail-closed used an
`uncaughtException` handler; forcing a crash showed it never fires for a top-level ES-module throw.
The mechanism had looked armed and was not. Same pattern, third instance, caught only because
someone made it fail on purpose.

### Where the review was working from an incomplete brief — recorded, not to excuse it

It wrote that *"twelve hundred lines arrived before you got to weigh in on the approach."* In fact
four questions were put to the author with the question UI **before any code was written** — reach,
adapter, CTO scope, and where verdicts live — and he chose all four recommendations, including
"all three as a plugin". That exchange was **not included in the brief it was given**, which is a
fault in the briefing, not in the reviewer. **Give the next CEO the questions and the answers.**
