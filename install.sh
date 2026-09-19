#!/bin/bash
# claude-kit installer — idempotent; run again any time after pulling changes.
#
#   bash install.sh                 # clean up the old layout, then say what to install
#   bash install.sh vendor <repo>   # copy the kit INTO a repo, so cloud sessions can see it
#   bash install.sh check  <repo>   # has that copy drifted from this checkout?
#
# THERE IS ALMOST NOTHING TO INSTALL ANY MORE, AND THAT IS THE POINT. Everything ships as one
# plugin: the two skills, the scorecard, the engines, and the two mentor hooks travel with it. The
# old installer symlinked skills into ~/.claude, appended an import line to ~/.claude/CLAUDE.md and
# asked you to wire the hooks into settings.json by hand — four places to keep in step, and a
# machine that pulled a change and forgot to re-run this silently ran the old copy.
#
# So the only real work left here is REMOVING what that layout left behind. A stale symlink and a
# dead import line are not inert: they load a second, older mentor beside the plugin's, and nothing
# on screen says which one is talking.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
CMD="${1:-install}"

# ── vendor / check ─────────────────────────────────────────────────────────────────────────────
# WHY THIS EXISTS AND IS NOT AN AFTERTHOUGHT. A cloud container inherits the repo and nothing else
# — no ~/.claude, so no plugins. Anything installed the plugin way is laptop-only, and a critic
# meant to judge unattended cloud work would be missing in exactly the place it was built to run.
# Vendoring puts it inside the repo, where the checkout carries it. The skills look for
# `.claude/kit/bin` FIRST and fall back to the plugin, so a repo that has a copy runs the copy it
# can actually see.
if [ "$CMD" = "vendor" ] || [ "$CMD" = "check" ]; then
  REPO="${2:-}"
  [ -n "$REPO" ] || { echo "usage: bash install.sh $CMD /abs/path/to/repo" >&2; exit 2; }
  REPO="$(cd "$REPO" && pwd)"
  SRC="$KIT/plugins/kit"
  DST="$REPO/.claude/kit"

  # ONE LIST, TWO CONSUMERS. A hand-kept list in vendor and not in check is how `check` once
  # reported IN STEP on a drifted skill: it compared two paths while vendor wrote a dozen.
  manifest_pairs() {
    echo "$SRC/bin|$DST/bin"
    echo "$SRC/templates|$DST/templates"
    echo "$SRC/hooks|$DST/hooks"
    for s in critic mentor scorecard; do echo "$SRC/skills/$s/SKILL.md|$REPO/.claude/skills/$s/SKILL.md"; done
  }

  if [ "$CMD" = "check" ]; then
    [ -d "$DST" ] || { echo "no vendored kit in $REPO (nothing to check)"; exit 0; }
    DRIFT=0
    while IFS='|' read -r srcp dstp; do
      [ -n "$srcp" ] || continue
      label="${dstp#$REPO/}"
      if [ ! -e "$dstp" ]; then echo "  MISSING in repo: $label"; DRIFT=1; continue; fi
      diff -qr "$srcp" "$dstp" >/dev/null 2>&1 || { echo "  differs: $label"; DRIFT=1; }
    done <<< "$(manifest_pairs)"
    if [ "$DRIFT" = "0" ]; then
      echo "IN STEP — $REPO matches claude-kit ($(git -C "$KIT" rev-parse --short HEAD 2>/dev/null || echo '?'))"
    else
      echo "DRIFTED — $REPO differs from claude-kit (above)."
      echo "  Re-run: bash install.sh vendor $REPO"
      exit 1
    fi
    exit 0
  fi

  mkdir -p "$DST" "$REPO/.claude/skills"
  while IFS='|' read -r srcp dstp; do
    [ -n "$srcp" ] || continue
    mkdir -p "$(dirname "$dstp")"
    cp -rf "$srcp" "$(dirname "$dstp")/" 2>/dev/null || cp -f "$srcp" "$dstp"
  done <<< "$(manifest_pairs)"

  # A STAMP SO DRIFT IS DETECTABLE RATHER THAN ASSUMED AWAY. Written MACHINE-NEUTRAL, deliberately:
  # an earlier version baked in the absolute paths of whatever machine happened to vendor, so a
  # stamp written in a cloud container told a reader on a laptop to run a path that does not exist
  # there.
  cat > "$DST/VENDORED-FROM" <<STAMP
claude-kit $(git -C "$KIT" rev-parse HEAD 2>/dev/null || echo unknown)
vendored $(date -u +%FT%TZ) from $(basename "$KIT") on $(hostname 2>/dev/null || echo 'an unnamed machine')

Do not edit these files here. Edit them in claude-kit and re-vendor.
From YOUR claude-kit checkout, wherever it lives:
  bash install.sh vendor <path to this repo>
Check this copy against the kit from there too:
  bash install.sh check <path to this repo>
STAMP

  # AND A HASH MANIFEST, because `check` needs the kit and a cloud container does not have it.
  # This lets the REPO'S OWN tests detect a vendored file edited in place — the failure that
  # actually happens: a session "just fixes" a copy and the two silently diverge. It CANNOT see the
  # kit moving forward; only `check`, on a machine holding both, can do that.
  : > "$DST/MANIFEST.sha256"
  while IFS='|' read -r srcp dstp; do
    [ -n "$dstp" ] || continue
    if [ -d "$dstp" ]; then find "$dstp" -type f ! -name MANIFEST.sha256 ! -name VENDORED-FROM | sort | while read -r f; do
        printf '%s  %s\n' "$(sha256sum "$f" | cut -d" " -f1)" "${f#$REPO/}" >> "$DST/MANIFEST.sha256"; done
    elif [ -f "$dstp" ]; then
      printf '%s  %s\n' "$(sha256sum "$dstp" | cut -d" " -f1)" "${dstp#$REPO/}" >> "$DST/MANIFEST.sha256"
    fi
  done <<< "$(manifest_pairs)"

  echo "Vendored the kit into $REPO  ($(wc -l < "$DST/MANIFEST.sha256" | tr -d ' ') files hashed)"
  echo "Write $REPO/.claude/KIT.md from $DST/templates/KIT-template.md if it does not exist."
  # The two mentor hooks are NOT auto-wired here. A vendored copy has no plugin manifest, so the
  # repo's own .claude/settings.json must point at .claude/kit/hooks/. Saying so is the whole job;
  # editing a repo's settings file from an installer in another repo is not this script's business.
  echo "Wire the mentor hooks in $REPO/.claude/settings.json (SessionStart + UserPromptSubmit ->"
  echo ".claude/kit/hooks/*.sh) — a vendored copy carries no plugin manifest to do it for you."
  exit 0
fi

# ── the normal install: remove the old layout, then point at the plugin ────────────────────────
echo "claude-kit — cleaning up the pre-plugin layout:"
CLEANED=0

# The mentor used to be a symlinked user-level skill. It is a plugin skill now, and two copies of
# one skill is the collision this kit exists to prevent.
if [ -L "$HOME/.claude/skills/mentor" ]; then
  rm -f "$HOME/.claude/skills/mentor"; echo "  removed ~/.claude/skills/mentor (mentor ships in the plugin now)"; CLEANED=1
fi
# Team and officers are gone entirely. Each removal is its own `if` rather than an `&&` chain:
# under `set -e` a chain whose first test fails is a FAILING command at the end of a loop body, and
# the installer would exit — silently declaring success on a machine it had not finished cleaning.
for f in "$HOME"/.claude/agents/team-*.md; do
  if [ -L "$f" ]; then rm -f "$f"; echo "  removed $f (the team was retired 2026-09-19)"; CLEANED=1; fi
done
if [ -L "$HOME/.claude/commands/team.md" ]; then
  rm -f "$HOME/.claude/commands/team.md"
  echo "  removed ~/.claude/commands/team.md (the team was retired 2026-09-19)"; CLEANED=1
fi

# The charter was imported into the user-level CLAUDE.md with an @-line. The charter no longer
# exists — the `mentor` skill is the full text — so that line now imports nothing, silently.
if [ -f "$HOME/.claude/CLAUDE.md" ] && grep -q "claude-kit/mentor/CHARTER.md" "$HOME/.claude/CLAUDE.md"; then
  tmp="$(mktemp)"; grep -v "claude-kit/mentor/CHARTER.md" "$HOME/.claude/CLAUDE.md" > "$tmp"
  mv "$tmp" "$HOME/.claude/CLAUDE.md"
  echo "  removed the dead @CHARTER.md import from ~/.claude/CLAUDE.md (the mentor skill is the text now)"; CLEANED=1
fi
if [ "$CLEANED" = "0" ]; then echo "  nothing to clean — this machine is already on the plugin layout."; fi

cat <<'NEXT'

EVERYTHING SHIPS AS ONE PLUGIN. In Claude Code:
    /plugin marketplace add ~/Projects/claude-kit
    /plugin install kit@claude-kit

That carries the mentor, the critic, the scorecard, the engines AND the two mentor hooks —
nothing to add to settings.json by hand.

For a repo whose kit must also work in CLOUD sessions, where ~/.claude does not exist:
    bash install.sh vendor /path/to/repo
    bash install.sh check  /path/to/repo

UNVERIFIED, AND THE FIRST THING TO CHECK: whether the commands land as /mentor, /critic and
/scorecard or as /kit:mentor, /kit:critic and /kit:scorecard. Type one and see.
NEXT
