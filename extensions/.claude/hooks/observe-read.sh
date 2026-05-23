#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

FALKORDB_URI=redis://localhost:6380 \
FALKORDB_GRAPH_NAME=allan_memory \
LLM_API_URL=YOUR_LLM_API_URL \
LLM_API_KEY=YOUR_LLM_API_KEY \
LLM_MODEL=YOUR_LLM_MODEL \
EMBEDDER_API_URL=YOUR_EMBEDDER_API_URL \
EMBEDDER_API_KEY=YOUR_EMBEDDER_API_KEY \
EMBEDDER_MODEL=YOUR_EMBEDDER_MODEL \
allan-memory observe-read --file "$FILE_PATH" --quiet
