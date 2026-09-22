# Kit — claude-kit's adapter

**The kit dogfoods its own critic.** If `/critic` cannot review the repo that ships it, it does not
work.

## The settings

- **production-ref:** main
- **test-command:** bash -n install.sh && bash -n plugins/kit/hooks/mentor-prompt.sh && bash -n plugins/kit/hooks/mentor-session-start.sh && for f in plugins/kit/bin/*.mjs; do node --check "$f" || exit 1; done && node -e 'for (const f of [".claude-plugin/marketplace.json","plugins/kit/.claude-plugin/plugin.json","plugins/kit/hooks/hooks.json"]) JSON.parse(require("fs").readFileSync(f,"utf8"))'
- **verdicts:** .claude/CRITIC-REVIEWS.md
- **lessons:** .claude/HARD-WON-LESSONS.md
- **scorecard:** .claude/scorecard.jsonl

## What is deliberately absent, and why

**Leaving a line out is a legitimate choice; leaving it out quietly is the failure.** So these are
named here rather than merely omitted:

| key | why there is none |
|---|---|
| `production-url` | nothing is deployed. The kit is installed from a checkout, so there is no running service — only files other repos read |
| `build-stamp-command` | no build step and no version string. `git rev-parse HEAD` is the whole identity |
| `trial-report` | `test-command` is a syntax sweep that runs in under a second. A report file would be a stale copy of something cheaper to re-run |
| `never-touch` | every file here is the maintainer's to edit; there is no generated output to protect |
