# claude-kit

A personal Claude Code kit. **Two roles, and the point is that they grade opposite halves of the
same round.**

| | what it does | when it runs |
|---|---|---|
| **`mentor`** | coaches how the request was framed, then **grades the ask** | before the work executes |
| **`critic`** | a *fresh* agent judges whether the thing he ASKED for actually happened, then **grades the delivery** | after the work executes |
| **`scorecard`** | publishes both scores on one board — XP, levels, streaks, badges | on demand |

Everything ships as **one plugin** (`plugins/kit/`) — a plugin can carry the two mentor hooks and
the engines with it; a bare skill cannot.

## Why two scores

The brief that produced it, 2026-09-19: *"both critic would get a score and you would get a score
and the dashboard would show both of these... to show how effectively all of the tooling in this
pipeline, **including you as the human prompter**, are working."*

**A pipeline with two operators in it was measuring one of them.** Claude's output has always been
reviewable — you can read the diff. The ask that produced it was not, because it scrolls past and
nobody writes it down. So the mentor grades the words he actually sent, *before* the work runs and
before anyone knows how it turned out, and the critic grades what came back. The gap between them is
the number worth staring at:

| the gap | what it means |
|---|---|
| **ask high, delivery low** | the framing was fine. This is a Claude problem, and the critic should be specific about it. |
| **ask low, delivery high** | it landed anyway — that is luck, and luck is not a process. |
| **both low** | the round was never going to work, and the mentor note says why. |
| **both high** | the pipeline worked. Bank it and look at the streak. |

### What is graded

| | graded by | dimensions |
|---|---|---|
| **You** — the prompt | `mentor`, before the work runs | Framing 40% · Leverage 30% · Learnings 30% |
| **Claude** — the delivery | `critic`, after the work runs | Delivery 50% · Evidence 30% · Scope 20% |

Grades go to `.claude/scorecard.jsonl` in **the repo they were earned in** — append-only, one JSON
object per line, both sides of a round joined by a round id. Per-repo rather than one global file so
it travels with the checkout, which means a cloud session (which sees none of `~/.claude`) grades
into the same record a laptop session does.

**XP, levels, streaks and badges are computed on read, never stored.** A derived number written to
disk is a number that can disagree with the data it came from, and nothing on screen would say which
one is lying. Eight tiers per side on shared thresholds (0 → 2000 XP), nine badges, and a streak
that breaks honestly — one that stopped two days ago reads 0, not its old length.

## Who it is coaching

**The kit asks, once, and remembers.** The first time the mentor runs with nothing on file, it asks
— with the question UI, one question — what you would like it to call you, and records the answer.
It never guesses from the git log, the repo owner or the directory name; what someone wants to be
called is theirs to say.

The name resolves in this order, first hit wins:

| source | for |
|---|---|
| `$CLAUDE_KIT_OPERATOR` | cloud containers and CI, which have no home directory to read |
| `- **operator:** Name` in `.claude/KIT.md` | one repo, overriding the machine — a shared checkout, or a repo you maintain for someone else |
| `~/.claude/claude-kit/operator.json` | the machine-wide answer, written once |
| nothing | the board says **You** and the mentor keeps asking |

Nothing anywhere in the kit hardcodes a person. `node plugins/kit/bin/operator.mjs where` says which
source answered and why. This mattered more than it sounds: the kit spent its first month with one
person's name welded through the skills and engines, which made it read as somebody else's tool to
everybody else — and told every Critic that its reader "is a founder and designer, not an engineer,"
which for most readers is simply false.

## The one check that can actually fail

Every other guard here is a prompt, and **a prompt you are holding is a prompt you can skip.** The
kit's own hooks say so in capitals, and a Critic caught the irony on 2026-09-19: the entire
enforcement for *"grade every ask"* was a hook injecting more text, with nothing anywhere that
noticed when no grade followed.

> *"The author diagnosed this exact disease one layer up — `hooks.json` says 'A PROMPT YOU ARE
> HOLDING IS A PROMPT YOU CAN SKIP' — and then built the fix out of another prompt."*

So `bin/mentor_context.mjs` **looks** instead. It records the moment of every prompt, and on the next
one asks whether any grade was written in between. If none was, it says so, with a running count —
and `dashboard.mjs` reads the same counter and prints it on the board under *What this could not
see*. That is still not enforcement; nothing can stop a model ignoring it. But it is a check that
**fails when the thing fails**, and the failure lands somewhere you look. That is the whole
difference between a guard and a decoration.

## The board

`node plugins/kit/bin/dashboard.mjs` renders `.claude/scorecard.html` from the ledger; the
`scorecard` skill publishes it as a private Artifact and records the URL in `.claude/scorecard.url`,
so every later publish **updates that same board** instead of making a fourth one nobody can find.

Every number is in the HTML before any script runs — the still frame is the whole report. The
palette is validated rather than eyeballed; `plugins/kit/PALETTE.md` carries the validator's actual
output for both light and dark, because that claim once rested on nothing but the author's word.

**A section called *What this could not see*** names the ungraded side, the unpaired grade, the
ungraded turns and the unreadable ledger line by line number. A dashboard that renders a confident
chart over missing data is the exact failure the critic exists to catch.

## What is in here

```
.claude-plugin/marketplace.json     the marketplace — one plugin, `kit`
install.sh                          removes the pre-plugin layout; vendor / check for cloud repos
plugins/kit/
  .claude-plugin/plugin.json        the plugin manifest
  skills/mentor/SKILL.md            coach the framing, then grade the ask
  skills/critic/SKILL.md            fresh-context review, then grade the delivery
  skills/scorecard/SKILL.md         show / publish / open the board
  hooks/hooks.json                  SessionStart + UserPromptSubmit, carried by the plugin
  hooks/*.sh                        two-line wrappers; the payload lives in bin/
  bin/mentor_context.mjs            the hook payload AND the skipped-grade check
  bin/ledger.mjs                    rubrics, weights, XP curve, ladders, badges, standings
  bin/score.mjs                     the only door into the ledger: mentor / critic / show / rubric
  bin/dashboard.mjs                 renders the board, server-side
  bin/critic_brief.mjs              assembles the brief a fresh Critic is handed
  bin/adapter.mjs                   what THIS repo keeps where, and what it could not see
  templates/                        KIT.md and CRITIC-REVIEWS.md for a new repo
  PALETTE.md                        the palette validator's output, recorded not recalled
.claude/                            the kit dogfoods itself: its own adapter, verdicts and ledger
```

About 1,450 lines of engine and installer. The kit reviews itself: `.claude/CRITIC-REVIEWS.md`
carries two real verdicts, newest at the top, append-only — including the one that graded this
rewrite **PARTIAL, 72/100** and was right.

## Install

```bash
git clone https://github.com/wyattroy/claude-kit.git ~/Projects/claude-kit
cd ~/Projects/claude-kit && bash install.sh
```

`install.sh` installs nothing — it **removes what the old layout left behind** (the symlinked mentor
skill, the retired team symlinks, the dead `@CHARTER.md` import in `~/.claude/CLAUDE.md`). Then,
inside Claude Code:

```
/plugin marketplace add ~/Projects/claude-kit
/plugin install kit@claude-kit
```

That carries the skills, the engines and both hooks — nothing goes into `settings.json` by hand.
**That is true of the plugin only:** a vendored copy has no manifest, so its two hooks are wired
manually. `SETUP.md` has the JSON.

**Cloud sessions see none of `~/.claude`.** For a repo whose kit must work there too:
`bash install.sh vendor /path/to/repo` copies it in, and `bash install.sh check /path/to/repo` says
whether that copy has drifted.

## Open, and known

**Nothing is hidden here on purpose. A known hole that is quiet is the thing this kit exists to
prevent.**

| open | state |
|---|---|
| **Nobody has installed this.** Whether the skills land as `/critic` or `/kit:critic`, and whether Claude Code runs `SessionStart`/`UserPromptSubmit` hooks from a plugin manifest at all, is unverified | **the top item.** Every other claim rests on it. The scripts were proved to emit valid hook JSON; that the harness runs them was not proved |
| **Vendoring collides with the plugin.** `vendor` writes `.claude/skills/{critic,mentor,scorecard}/SKILL.md` while the plugin ships its own copy of each. On a machine with both, each exists twice and nothing decides which wins | open since 2026-08-27 and **wider now** — three skills, not one. Harmless in a cloud container (no plugin there). `install.sh vendor` says so on every run; `install.sh check` catches drift |

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
| `mentor/CHARTER.md` | the mentor's text, imported into `~/.claude/CLAUDE.md` | it said the same thing as the mentor skill. Two copies of one instruction is one copy that goes stale unread — and `install.sh` removes the dead import line |
| `.claude/memory/` templates, `examples/` | DECISIONS, OFFICERS, TEAM scaffolding and a filled-in Pastry Pirates example | all of it described a repo this one does not live in |

**What that leaves is the whole kit:** two skills that grade each other's halves, one board that
shows both, and the engines under them.
