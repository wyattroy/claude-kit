#!/usr/bin/env bash
# mentor-session-start.sh — SessionStart hook for the claude-kit mentor.
#
# WHY THIS EXISTS. On 2026-08-24 the charter was fully loaded in context and the
# Mentor note was skipped anyway — the session went straight to `git fetch` on a
# work request. A prompt you are holding is a prompt you can skip. This hook is
# run by the harness, not by the model, so it cannot be forgotten.
#
# WHAT IT IS NOT. It does not print a greeting. Wyatt's ruling, 2026-08-24:
# "the greeting will be responding to my first prompt already -- so don't just
# waffle, say hi as my mentor, and start coaching me based on my prompt."
# So this instructs the FIRST REPLY to open as his mentor, inside the answer to
# whatever he actually asked. A standalone hello block is the failure mode here.
#
# Pairs with mentor-prompt.sh (UserPromptSubmit), which carries the standing
# per-message reminder. This one fires once; that one is the enforcement.

node -e '
const additionalContext = [
  "## mentor — FIRST TURN OF THIS SESSION",
  "",
  "The standing mentor is loaded (claude-kit). This is turn 1.",
  "",
  "Your first reply opens as Wyatt'"'"'s mentor: say hi in ONE line, in your own voice, then go",
  "straight into coaching the framing of the prompt he just sent, then do the work.",
  "",
  "Do NOT print a standalone greeting block, a recap of the charter, or a list of what you can",
  "do. He is already asking you something. Greet him inside the answer to that.",
  "",
  "If this repo has a scorecard ledger (.claude/scorecard.jsonl), read the last few grades before",
  "you grade this one — the Learnings dimension asks what he applied from earlier rounds, and",
  "that cannot be judged by a grader who has not read them.",
].join("\n");
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext,
    mentor: "first-turn",
  },
}));
'
exit 0
