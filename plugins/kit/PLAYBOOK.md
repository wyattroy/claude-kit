---
last-refreshed: 2026-09-22
refresh-every-days: 7
sources:
  - https://code.claude.com/docs/en/release-notes
  - https://code.claude.com/docs/en/overview
  - https://www.anthropic.com/engineering
---

# The mentor's playbook

**What the coaching is grounded in.** Distilled from Anthropic's official guidance — the Claude Code
docs and the Anthropic engineering blog.

**This file has a date on it because advice about a tool that ships weekly goes stale, and stale
advice delivered confidently is worse than none.** `bin/playbook.mjs status` reports its age; the
mentor's SessionStart hook reads that and asks for a refresh when it is overdue. When you refresh
it, append to *Recent changes* and bump `last-refreshed` — the date is the whole mechanism.

---

## Framing a work request — the pre-flight the Framing score checks against

- **State the outcome, not the steps.** What should be true when done, and how you will judge it.
- **Point at files and evidence instead of describing them.** @-mention files; paste screenshots
  rather than describing what is on screen.
- **Size it honestly.** One session = one coherent piece of work. Distinct tasks → `/clear` between
  them or separate sessions; slow independent parts → background agents.
- **Say what NOT to touch.** Scope fences prevent well-meaning drift.
- **Front-load decisions before walking away.** Answer everything answerable now; a run that blocks
  twenty minutes after you leave burns the window.
- **Give the reason, not just the instruction.** An ask that says *why* lets every downstream
  judgement call resolve against your intent instead of returning to you as a question.

## Session hygiene

- `/clear` between unrelated tasks; a long mixed session pollutes its own context.
- Set model and effort at the start, not midway — a mid-session change busts the prompt cache.
  **Effort is per-model now:** a level you saved before that change does not carry to a
  newly-released model, which starts at its own default (2.1.277). Check `/effort` after switching.
- `/context` to audit what loads at startup; `/compact` before walking away from a long session.
  *(Auto-compact was firing at half the real window because advisor-tool turns were counted at
  roughly 2× their true size — fixed in 2.1.277. If you built a habit of compacting early to work
  around that, you can relax it.)*
- Plan mode for anything architectural — approve the plan, then let it run.
- Commit checkpoints often, so any wrong turn is a cheap revert.

## Delegation ladder — escalate only when the previous rung genuinely limits you

1. One good session with a strong `CLAUDE.md` — more capable than most people expect. *(Since
   2.1.277, a project with no `CLAUDE.md` reads `AGENTS.md` instead; set which under "Project
   instructions" in `/config`. Not yet on Bedrock, Vertex or Foundry.)*
2. Subagents for parallel read-only work (research, search, review). *(`omitClaudeMd` in agent
   frontmatter, 2.1.274, runs a subagent without the user/project CLAUDE.md — worth it when the
   parent's instructions would only confuse a narrow task.)*
3. Background agents for slow independent parts you should not sit and watch.
4. Long-running harnesses (progress files, evidence-gated done, fresh-context verification) only for
   multi-session builds. *(Dynamic workflows now pause at usage limits and resume when they reset
   rather than dropping agents, 2.1.271 — but the default size dropped to small on Pro and the
   medium guideline from 15 agents to 10. Scale the ask to that, not to what it used to allow.)*

**This is the ladder the Leverage score is measured against.** An ask that names the right rung
scores high; one that makes Claude work out the rung from scratch, or that reaches three rungs past
what the work needs, does not.

## Verification — universal

- Separate building from checking: the one who built it never certifies it.
- Evidence over claims: a screenshot, or a check that was proved capable of failing.
- **A check that cannot fail proves nothing.**

---

## Recent changes

*(Newest first. Each refresh appends here — what actually changed in the docs or the engineering
blog since the last date, and what it means for the advice above. An entry that says "no material
change" is a real entry and worth writing: it records that the check ran.)*

- **2026-09-22 — first automated refresh (31 days late; the staleness check that would have caught
  it did not exist until today).** Read the Claude Code changelog for 2.1.269 → 2.1.280. Material
  changes to the advice above:
  - **`AGENTS.md`** is read when a project has no `CLAUDE.md` (2.1.277). Rung 1 of the ladder
    updated — "a strong CLAUDE.md" now has a second spelling.
  - **Effort is per-model** (2.1.277): a saved level does not carry to a newly-released model. The
    session-hygiene line said to set effort at the start; it now says to re-check it after a model
    switch, which is a different habit.
  - **Auto-compact was firing at half the real context window** — advisor-tool turns counted at ~2×
    their real size, fixed in 2.1.277. Anyone who learned to compact early as a workaround can stop.
  - **Workflow scale shrank** (2.1.271): default size small on Pro, medium guideline 15 → 10 agents,
    and workflows now pause at usage limits instead of dropping agents. Rung 4 updated.
  - **`omitClaudeMd`** for subagents (2.1.274) — added to rung 2.
  - Noted but *not* folded into the advice: Opus 5.5 became the default Opus model (2.1.280), and
    skills/plugins now sync from a claude.ai account to terminal sessions by default (2.1.275).
    Neither changes how to frame a request, which is what this playbook is for.

- **2026-08-22 — baseline.** The playbook above, as first distilled. No prior entry to compare
  against.
