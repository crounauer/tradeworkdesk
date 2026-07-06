#!/bin/bash
# Test Figma Template Conversion Endpoint
# Usage: ./test-figma-conversion.sh <superadmin-token>

if [ -z "$1" ]; then
  echo "Usage: ./test-figma-conversion.sh <superadmin-token>"
  exit 1
fi

TOKEN="$1"
API_URL="${API_URL:-http://localhost:3001}"
ZIP_FILE="${ZIP_FILE:-/home/simon/Downloads/Local\ Plumbing\ Pro\ Template.zip}"
FIGMA_URL="https://snore-veto-98315844.figma.site"

echo "🚀 Testing Figma Template Conversion"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API: $API_URL"
echo "ZIP: $ZIP_FILE"
echo "Figma URL: $FIGMA_URL"
echo ""

# Step 1: Convert Figma ZIP + URL
echo "1️⃣  Converting Figma ZIP + URL..."
RESPONSE=$(curl -s -X POST "$API_URL/api/superadmin/templates/convert" \
  -H "Authorization: Bearer $TOKEN" \
  -F "figmaZip=@$ZIP_FILE" \
  -F "figmaUrl=$FIGMA_URL" \
  -F "templateName=Local Plumbing Pro" \
  -F "industries=Plumbing" \
  -F "industries=Heating")

echo "Response:"
echo "$RESPONSE" | jq .

# Extract conversion ID from response (if available)
CONVERSION_ID=$(echo "$RESPONSE" | jq -r '.conversionId // .conversion_id // empty' 2>/dev/null)

if [ -z "$CONVERSION_ID" ]; then
  echo "⚠️  No conversion ID found in response"
  echo ""
  echo "2️⃣  Fetching pending templates..."
  curl -s -X GET "$API_URL/api/superadmin/templates/pending" \
    -H "Authorization: Bearer $TOKEN" | jq .
else
  echo "✅ Conversion created: $CONVERSION_ID"
  echo ""
  
  # Step 2: Get pending templates
  echo "2️⃣  Fetching pending templates..."
  PENDING=$(curl -s -X GET "$API_URL/api/superadmin/templates/pending" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "$PENDING" | jq .
  
  # Find the conversion we just created
  PENDING_ID=$(echo "$PENDING" | jq -r ".pending[0].id // empty" 2>/dev/null)
  
  if [ -n "$PENDING_ID" ]; then
    echo ""
    echo "3️⃣  Approving template $PENDING_ID..."
    curl -s -X PATCH "$API_URL/api/superadmin/templates/$PENDING_ID/approve" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" | jq .
    
    echo ""
    echo "✅ Workflow complete!"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
