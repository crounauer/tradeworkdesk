#!/bin/bash

# Query Supabase directly using SQL
TEMPLATE_ID="5b54470b-d8df-470a-bf3c-c564ac68fe2c"

echo "Checking template records in database..."
echo ""

# Check if we can access Supabase
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  exit 1
fi

# Use curl to query the template
echo "1️⃣  Fetching website_templates record..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/website_templates?id=eq.$TEMPLATE_ID&select=id,name,slug,status,demo_pages" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | jq '.[0] | {id, name, slug, status, demo_pages_length: (.demo_pages | length), demo_pages_first: (.demo_pages[0:2])}'

echo ""
echo "2️⃣  Fetching template_conversions for this slug..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/template_conversions?template_slug=eq.local-plumbing-pro&select=id,status,block_mapping_report" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | jq '.[0] | {id, status, pages: (.block_mapping_report.pages | length), blocksPerPage_keys: (.block_mapping_report.blocksPerPage | keys)}'

