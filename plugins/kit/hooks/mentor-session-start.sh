#!/usr/bin/env bash
# mentor-session-start.sh — SessionStart. See bin/mentor_context.mjs.
node "${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}/bin/mentor_context.mjs" session-start || true
exit 0
