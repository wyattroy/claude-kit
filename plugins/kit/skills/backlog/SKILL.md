---
name: backlog
description: The backlog pipeline — tickets in, closed tickets OUT. Use whenever the operator says "backlog" (show it, clean it, what's open, sweep it, publish it), asks what is left to do, or after any commit that finished a ticket. Tickets get ids from one tool; a fix closes its ticket IN ITS OWN COMMIT with `Closes: PFX-037` on its own line; a sweep moves closed tickets to a graveyard with the commit that closed them; a gate fails if a closed ticket is still listed. For FILING a new one, use the `bug` skill.
argument-hint: "[list | sweep | check | close <ID> --why \"…\" | publish]"
allowed-tools: [Bash, Read, Edit, Grep]
---

# /backlog — the list, kept honest

The user invoked this with: $ARGUMENTS

**Why it exists** (Wyatt, Pastry Pirates, 2026-09-21 — the specification): *"design a PROPER documentation pipeline
whereby tickets are added to the backlog by either you or me, and ONCE SOLVED THEY ARE REMOVED FROM THE BACKLOG."* The
backlog had been append-only prose — adding had a mechanism, closing had none — so it only grew, and a session with no
memory cannot tell *still true* from *never cleaned up*. **The close must ride the commit that did the work, or it does
not get written at all.**

## The tool

`node "$CLAUDE_PLUGIN_ROOT/bin/backlog.mjs"` (vendored copies: `.claude/kit/bin/backlog.mjs`). Settings come from
`.claude/KIT.md`: `backlog` (default `.planning/BACKLOG.md`), `backlog-closed` (`.planning/BACKLOG-CLOSED.md`),
`ticket-prefix` (default `T`; Pastry Pirates uses `PP`).

| do | command |
|---|---|
| issue ids to new tickets, and sweep closed ones out | `backlog.mjs` |
| the gate — put it in the repo's test command | `backlog.mjs --check` |
| list what is open | `backlog.mjs list` |
| close one no commit closed (done elsewhere, wrong, not wanted) | `backlog.mjs close PFX-037 --why "…"` then `backlog.mjs` |
| file one | the **`bug`** skill (`backlog.mjs add "…" --body "…"`) |

## The rules

1. **One `# ` heading per ticket**, titled in the operator's words — what they see, not the code's name for it.
2. **A fix closes its ticket in its own commit:** `Closes: PFX-037` **on its own line** of the message. A MENTION IS NOT A
   CLOSE — "PFX-037" in prose is a citation. Then run `backlog.mjs` so the sweep moves it, and commit that.
3. **Only commits reachable from HEAD close anything** — a `Closes:` on an unmerged branch must not take a ticket off a
   list whose branch does not have the fix.
4. **Nothing is deleted.** A swept ticket keeps its whole write-up in the graveyard, stamped with what closed it —
   "read the graveyard before re-running a settled argument".
5. **Before working a ticket:** search the rulings (is it already decided?) and `git log --all -i --grep` (is it already
   fixed, or finished on an unmerged branch?). Say the date you checked back to.
6. **A ticket waiting on the operator** (a pick, a verdict, taste) is theirs, and says so in its title; everything else on
   the list is the session's to do. "N open" is never how a reply ends — the work is.

## Showing it to the operator

When they ask to see the backlog, hand them a **page, not a file**: a published page with a tappable link, grouped the way
they think (stops a voyage · visible polish · under the floor · waiting on you · done), re-published to the SAME url after
every sweep, so the link they saved is always today's list. Pastry Pirates' builder is `scripts/build_backlog_page.mjs`.
