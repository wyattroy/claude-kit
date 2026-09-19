#!/usr/bin/env bash
# mentor-prompt.sh — UserPromptSubmit. The payload and the skipped-grade check live in
# bin/mentor_context.mjs so both are syntax-checkable and testable; this is the wrapper.
# `|| true` so a broken mentor can never break the session it is coaching.
node "${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}/bin/mentor_context.mjs" || true
exit 0
