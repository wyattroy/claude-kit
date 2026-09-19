# claude-kit

Wyatt's personal Claude Code kit. **Two roles, and the point is that they grade opposite halves of
the same round.**

- **mentor** — coaches how he framed the request, inline, *before* the work executes, then **grades
  the ask**: framing, leverage, learnings applied.
- **critic** — after the work, a *fresh* agent judges whether the thing he ASKED for actually
  happened, in its own words, with the previous verdict in hand so a recurring fault gets named —
  then **grades the delivery**: did it happen, was there evidence, did it stay in scope.
- **scorecard** — publishes both scores on one board, with XP, levels, streaks and badges.

Everything ships as **one plugin** (`plugins/kit/`) — a plugin can carry the two mentor hooks and
the engines with it; a bare skill cannot.

## Why two scores

Wyatt, 2026-09-19: *"both critic would get a score and you would get a score and the dashboard would
show both of these... to show how effectively all of the tooling in this pipeline, **including you
as the human prompter**, are working."*

**A pipeline with two operators in it was measuring one of them.** Claude's output has always been
reviewable — you can read the diff. The ask that produced it was not, because it scrolls past and
nobody writes it down. So the mentor grades the words he actually sent, *before* the work runs and
before anyone knows how it turned out, and the critic grades what came back. The gap between them
is the number worth staring at:

| the gap | what it means |
|---|---|
| **ask high, delivery low** | the framing was fine. This is a Claude problem, and the critic should be specific about it. |
| **ask low, delivery high** | it landed anyway — that is luck, and luck is not a process. |
| **both low** | the round was never going to work, and the mentor note says why. |
| **both high** | the pipeline worked. Bank it and look at the streak. |

### What is graded

| | graded by | when | dimensions |
|---|---|---|---|
| **Wyatt** — the prompt | `mentor` | before the work runs | Framing 40% · Leverage 30% · Learnings 30% |
| **Claude** — the delivery | `critic` | after the work runs | Delivery 50% · Evidence 30% · Scope 20% |

Grades go to `.claude/scorecard.jsonl` in **the repo they were earned in** — append-only, one JSON
object per line. Per-repo rather than one global file so it travels with the checkout, which means a
cloud session (which sees none of `~/.claude`) grades into the same record a laptop session does.

**XP, levels, streaks and badges are computed on read, never stored.** A derived number written to
disk is a number that can disagree with the data it came from, and nothing on screen would say which
one is lying.

## The board

`node plugins/kit/bin/dashboard.mjs` renders `.claude/scorecard.html` from the ledger; the
`scorecard` skill publishes it as a private Artifact with a stable URL, recorded in
`.claude/scorecard.url` so every later publish **updates that same board** instead of making a
fourth one nobody can find.

Every number is in the HTML before any script runs, and a section called **WHAT THIS COULD NOT SEE**
names the ungraded side, the unpaired grade and the unreadable ledger line. A dashboard that renders
a confident chart over missing data is the exact failure the critic exists to catch.

## Install

```bash
git clone git@github.com:wyattroy/claude-kit.git ~/Projects/claude-kit
cd ~/Projects/claude-kit && bash install.sh
```

Then, inside Claude Code:

```
/plugin marketplace add ~/Projects/claude-kit
/plugin install kit@claude-kit
```

**Unverified, and the first thing to check after installing:** whether the commands land as
`/mentor`, `/critic`, `/scorecard` or as `/kit:mentor`, `/kit:critic`, `/kit:scorecard`. Type one
and see.

**Cloud sessions see none of `~/.claude`.** For a repo whose kit must work there too:
`bash install.sh vendor /path/to/repo` copies it in, and `bash install.sh check /path/to/repo` says
whether that copy has drifted. Then `SETUP.md`.

## What was removed, 2026-09-19, and why it is listed rather than just deleted

The kit had accumulated a second job — running Pastry Pirates' unattended build — and the machinery
for it outlived the use. Deleting it quietly would leave the same question open every time someone
went looking for it, so:

| gone | what it was | why |
|---|---|---|
| `/ceo` | the old name for the critic | it reviewed; it never ran anything. `/critic` is the honest name |
| `/cto` | supervised an unattended marathon worker | no marathon worker runs any more |
| `/team` + 6 agents | twin leads, measurer, builders, tester, checker, sweeper | built for one repo's playtest waves, never used since |
| the production fence | a hook denying pushes to production while a CTO lock was held | inert without a CTO; there is no CTO |
| `plugins/wyclau/` | the Glass, the Bell, the Door — a watch relay for unattended cloud runs, ~1,700 lines | Pastry Pirates' build, not the kit's. **It keeps its vendored copies; this repo is no longer their upstream** |
| `mentor/CHARTER.md` | the mentor's text, imported into `~/.claude/CLAUDE.md` | it said the same thing as the mentor skill. Two copies of one instruction is one copy that goes stale unread — and `install.sh` now removes the dead import line |
| `.claude/memory/` templates, `examples/` | DECISIONS, OFFICERS, TEAM scaffolding and a filled-in Pastry Pirates example | all of it described a repo this one does not live in |

**What that leaves is the whole kit:** two skills that grade each other's halves, one board that
shows both, and the engines under them.
