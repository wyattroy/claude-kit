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
four questions were put to Wyatt with the question UI **before any code was written** — reach,
adapter, CTO scope, and where verdicts live — and he chose all four recommendations, including
"all three as a plugin". That exchange was **not included in the brief it was given**, which is a
fault in the briefing, not in the reviewer. **Give the next CEO the questions and the answers.**
