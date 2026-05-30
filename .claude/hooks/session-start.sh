#!/bin/bash
# SessionStart hook — ensure the graphify knowledge graph is available so the
# assistant can answer codebase questions via `graphify query` (a scoped
# subgraph, ~2k tokens) instead of reading/grepping many files.
#
# Web-only: graphify-out/ is gitignored and the remote container is ephemeral,
# so the graph must be rebuilt at the start of each web session. AST-only, no
# API key, no network beyond installing the CLI once.
set -euo pipefail

# Only run in Claude Code on the web; local machines keep their own install.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$REPO"

log() { echo "[graphify session-start] $*" >&2; }

# Make user-level tool bins discoverable.
export PATH="$HOME/.local/bin:$PATH"

# 1. Ensure the graphify CLI exists (idempotent).
if ! command -v graphify >/dev/null 2>&1; then
  if ! command -v uv >/dev/null 2>&1; then
    log "installing uv…"
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1 || true
    export PATH="$HOME/.local/bin:$PATH"
  fi
  if command -v uv >/dev/null 2>&1; then
    log "installing graphifyy…"
    uv tool install graphifyy >/dev/null 2>&1 || true
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

if ! command -v graphify >/dev/null 2>&1; then
  log "graphify unavailable; skipping graph build (assistant will fall back to file reads)."
  exit 0
fi

# 2. Build / refresh the knowledge graph (AST-only, no LLM, no API cost).
log "building knowledge graph…"
graphify update . >/dev/null 2>&1 || log "graph build failed; continuing without it."
log "ready."
