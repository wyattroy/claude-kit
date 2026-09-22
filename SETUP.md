# SETUP — one sitting, about five minutes, once per machine

1. **Clone and install:**
   ```bash
   git clone https://github.com/wyattroy/claude-kit.git ~/Projects/claude-kit
   cd ~/Projects/claude-kit && bash install.sh
   ```
   `install.sh` no longer installs anything — **it removes what the old layout left behind** (the
   symlinked mentor skill, the retired team symlinks, and the dead `@CHARTER.md` import line in
   `~/.claude/CLAUDE.md`), then tells you the two plugin commands. It is idempotent; run it again
   after any pull.

2. **Install the plugin** — inside Claude Code:
   ```
   /plugin marketplace add ~/Projects/claude-kit
   /plugin install kit@claude-kit
   ```
   That carries the `mentor`, `critic` and `scorecard` skills, the engines, **and the two mentor
   hooks**. Nothing goes into `settings.json` by hand any more.

3. **Restart Claude Code, then verify in any project:**
   - A new session's first real work request opens with a **Mentor note** before anything executes.
     *(That is the `UserPromptSubmit` hook firing. If it does not, `/context` will show whether the
     plugin's hooks loaded at all.)*
   - The mentor then writes a grade. Confirm with `node .../bin/score.mjs show`, or just ask
     "how am I scoring?" — the `scorecard` skill answers.
   - `/critic` and `/scorecard` appear in the command list. Verified 2026-09-22: the plugin
     registers them under the **bare** names `critic`, `mentor`, `scorecard` — no `kit:` prefix.

4. **Give each project its adapter.** Copy `plugins/kit/templates/KIT-template.md` to
   `<repo>/.claude/KIT.md` and fill in the one page. A project without one is not broken — `/critic`
   **stops, says what cannot be checked without it, asks the three questions with the question UI,
   and offers to write the file from the answers.** It never grades a repo it does not understand.

5. **First graded round:** send one real work request, let the mentor grade it, do the work, then
   `/critic "<your request, verbatim>"`. That is one complete round on both sides. Then
   `/scorecard publish` for the board, and save the URL it returns — `.claude/scorecard.url` is what
   makes the next publish update that same board rather than make a second one.

## Known limits

- **Cloud sessions (claude.ai/code) see none of `~/.claude`**, so the plugin does not reach them.
  For a repo that needs the kit there: `bash install.sh vendor /path/to/repo`, then wire the two
  hooks in that repo's own `.claude/settings.json` — a vendored copy carries no plugin manifest to
  do it for itself. `bash install.sh check /path/to/repo` says whether the copy has drifted.
- **OPEN, and flagged twice now by the critic: vendoring collides with the plugin.**
  `vendor` writes `.claude/skills/{critic,mentor,scorecard}/SKILL.md` into the repo while the plugin
  ships its own copy of each. On a machine with both, each skill exists twice and **nothing
  documented decides which wins.** It is harmless where vendoring is for — a cloud container has no
  plugin — and unverified on a laptop that has both. `install.sh vendor` now says so every time it
  runs. Do not rely on it until someone has actually checked.
- **The ledger is per-repo.** There is no lifetime cross-project score; each repo keeps its own.
  That is the trade for grades that survive into cloud containers.
- **The board is a snapshot, not a live view.** `dashboard.mjs` bakes the data into the page, so a
  grade written after the last publish is in the ledger but not yet on the board. The page's
  masthead prints when it was generated, so the two never disagree silently.
