# Kit — this repo's adapter

**Copy to `<repo>/.claude/KIT.md` and fill in. One page, and it is the only repo-specific thing the
kit knows.**

The critic holds the judgment; this file holds the facts. That split is deliberate: **a tool that
stores facts about a repo it does not live in goes stale the day the repo moves, and nothing tells
you.** This file travels with the repo, so it cannot drift from it.

**Anything left out is not silently skipped — it is named in the report as a check that did not
run.** Leaving a line out is a legitimate choice; leaving it out *quietly* is the failure.

## The settings

Format is `- **key:** value`. Lines inside code fences are ignored, so examples are safe.

- **production-ref:** main
- **production-url:** https://example.com
- **build-stamp-command:** <a command printing this build's identity, e.g. grep -o 'BUILD = "[^"]*"' src/version.js>
- **test-command:** npm test
- **trial-report:** .claude/TEST-REPORT.md
- **verdicts:** .claude/CRITIC-REVIEWS.md
- **scorecard:** .claude/scorecard.jsonl
- **never-touch:** CNAME, robots.txt, sitemap.xml

## What each one is for

| key | why the kit needs it |
|---|---|
| `production-ref` | the branch that reaches real users — the baseline the critic diffs against. Undeclared, it is asked of git, and if git cannot answer it is reported UNKNOWN rather than guessed |
| `production-url` | where to confirm what is actually live |
| `build-stamp-command` | tells a reviewer WHICH build it is judging. Without it, that is UNKNOWN |
| `test-command` | how this repo proves itself |
| `trial-report` | where the last full run wrote its result, so a review can read it rather than trust a claim |
| `verdicts` | the standing record of past critic verdicts — **this is what makes a RECURRING fault visible** |
| `scorecard` | the append-only grade ledger the mentor and the critic both write to, and the only thing the dashboard reads |
| `never-touch` | files nothing here may modify, whatever the reason |

## The questions to ask Wyatt if this file is missing

**Ask with the question UI, never as prose.** Put the measurement in the question where you can — he
answers far better against real numbers than against abstractions.

1. **Which branch reaches real users, and is there a build step between it and them?**
2. **How does this repo prove itself — one command?** And where does that write its result?
3. **What must never be touched, whatever the reason?**

Then write the file from his answers and run again. Do not grade a repo you do not understand.
