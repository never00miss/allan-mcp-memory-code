#!/bin/bash
# Debounced async observe-edit hook for allan-memory.
# Returns immediately so Claude is never blocked. Actual extraction is
# deferred by ALLAN_MEMORY_DEBOUNCE_SECONDS (default 60) and only the
# latest edit to a given file is processed — rapid successive edits
# collapse into one extraction.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

DEBOUNCE_DIR="${ALLAN_MEMORY_DEBOUNCE_DIR:-/tmp/allan-memory-debounce}"
DEBOUNCE_SECONDS="${ALLAN_MEMORY_DEBOUNCE_SECONDS:-60}"
mkdir -p "$DEBOUNCE_DIR" 2>/dev/null

KEY="edit-$(printf '%s' "$FILE_PATH" | shasum -a 256 | cut -d' ' -f1)"
STATE_FILE="$DEBOUNCE_DIR/$KEY"

TOKEN="$$-$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1_000_000_000))")"
printf '%s' "$TOKEN" > "$STATE_FILE"

nohup bash -c '
  sleep "'"$DEBOUNCE_SECONDS"'"
  [ "$(cat "'"$STATE_FILE"'" 2>/dev/null)" = "'"$TOKEN"'" ] || exit 0
  rm -f "'"$STATE_FILE"'"
  FALKORDB_URI=redis://localhost:6380 \
  FALKORDB_GRAPH_NAME=allan_memory \
  LLM_API_URL=YOUR_LLM_API_URL \
  LLM_API_KEY=YOUR_LLM_API_KEY \
  LLM_MODEL=YOUR_LLM_MODEL \
  EMBEDDER_API_URL=YOUR_EMBEDDER_API_URL \
  EMBEDDER_API_KEY=YOUR_EMBEDDER_API_KEY \
  EMBEDDER_MODEL=YOUR_EMBEDDER_MODEL \
  OBSERVE_LLM=true \
  OBSERVE_LLM_MODEL=deepseek/deepseek-v4-flash \
  allan-memory observe-edit --file "'"$FILE_PATH"'" --quiet
' </dev/null >/dev/null 2>&1 &

exit 0
