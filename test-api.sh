#!/bin/bash

# Test Allan Memory endpoints

BASE_URL="http://localhost:9089"

echo "=== Testing Allan Memory API ==="
echo ""

# Health check
echo "1. Health check..."
curl -s "$BASE_URL/v1/health" | jq .
echo ""

# Add memory
echo "2. Adding memory..."
RESULT=$(curl -s -X POST "$BASE_URL/v1/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Episode",
    "episode_body": "Acme Corp launched a new product called CloudSync. The CEO John Smith announced the partnership with TechGiant Inc.",
    "group_id": "test"
  }')
echo "$RESULT" | jq .
EPISODE_UUID=$(echo "$RESULT" | jq -r '.data.uuid')
echo ""

# Wait for processing
echo "3. Waiting 5 seconds for entity extraction..."
sleep 5
echo ""

# Search nodes
echo "4. Searching nodes for 'Acme Corp'..."
curl -s -X POST "$BASE_URL/v1/memory/search/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Acme Corp",
    "group_ids": ["test"],
    "limit": 5
  }' | jq .
echo ""

# Search facts
echo "5. Searching facts for 'product launch'..."
curl -s -X POST "$BASE_URL/v1/memory/search/facts" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "product launch",
    "group_ids": ["test"],
    "limit": 5
  }' | jq .
echo ""

# Get episodes
echo "6. Getting episodes for group 'test'..."
curl -s "$BASE_URL/v1/memory/episodes?group_id=test" | jq .
echo ""

# Clear graph (optional)
# echo "7. Clearing graph..."
# curl -s -X DELETE "$BASE_URL/v1/memory/graph" \
#   -H "Content-Type: application/json" \
#   -d '{"group_ids": ["test"]}' | jq .

echo "=== Done ==="
