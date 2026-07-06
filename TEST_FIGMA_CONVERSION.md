# Step 2: Test Figma Conversion Endpoint

## Prerequisites

1. **Database migration deployed**
   ```bash
   supabase db push supabase/patch-070-template-conversions.sql
   ```

2. **API server running**
   ```bash
   cd /home/simon/projects/tradeworkdesk
   pnpm --filter @workspace/api-server dev
   ```

3. **Superadmin token** - Get one from your local auth system or test user

## Getting a Superadmin Token

You'll need an authenticated superadmin user. Options:

**Option A: Use Supabase directly**
```bash
# 1. Make sure you have a superadmin profile
supabase sql -- "SELECT id FROM profiles WHERE is_superadmin = true LIMIT 1;"

# 2. Generate a token via Supabase admin API (if configured)
# OR use browser dev tools to capture auth token from authenticated session
```

**Option B: Use curl with email/password** (if your auth supports it)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}' | jq -r .token
```

**Option C: Use Supabase client**
```javascript
import { createClient } from "@supabase/supabase-js";
const client = createClient(SUPABASE_URL, SUPABASE_KEY);
const { data } = await client.auth.signInWithPassword({
  email: "admin@example.com",
  password: "password"
});
console.log(data.session.access_token);
```

## Running the Test

1. **Make test script executable**
   ```bash
   chmod +x test-figma-conversion.sh
   ```

2. **Run test with your token**
   ```bash
   ./test-figma-conversion.sh "your-superadmin-token-here"
   ```

   Or set environment variables:
   ```bash
   API_URL="http://localhost:3001" \
   ZIP_FILE="/home/simon/Downloads/Local Plumbing Pro Template.zip" \
   ./test-figma-conversion.sh "your-token"
   ```

## What the Test Does

1. **POST /api/superadmin/templates/convert**
   - Uploads Figma ZIP + URL
   - Returns conversion summary (pages, blocks, design tokens)
   - Creates pending record in database

2. **GET /api/superadmin/templates/pending**
   - Lists all pending conversions
   - Shows block mapping report
   - Shows design tokens extracted

3. **PATCH /api/superadmin/templates/:id/approve**
   - Approves the conversion
   - Sets status to 'approved'
   - Records approval timestamp

## Expected Output

```json
{
  "success": true,
  "templateSlug": "local-plumbing-pro",
  "templateName": "Local Plumbing Pro",
  "status": "pending",
  "importedPages": 13,
  "importedBlocks": 75
}
```

## Debugging

**If conversion fails:**

1. Check API server logs for errors:
   ```bash
   tail -f /tmp/api-server.log
   ```

2. Verify ZIP file exists:
   ```bash
   ls -lh "/home/simon/Downloads/Local Plumbing Pro Template.zip"
   ```

3. Check ZIP contents:
   ```bash
   unzip -l "/home/simon/Downloads/Local Plumbing Pro Template.zip" | grep App.tsx
   ```

4. Verify token is superadmin:
   ```bash
   # Decode JWT to check claims
   curl -s http://localhost:3001/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN" | jq .
   ```

## Success Criteria

✅ POST /convert returns 200 with templateSlug and importedPages
✅ GET /pending returns 200 with conversion record
✅ Database has record in `template_conversions` with status='pending'
✅ PATCH /:id/approve returns 200 with status='approved'

## Next Step

Once this test passes:
- Move on to **Step 4: Build admin dashboard UI** for reviewing pending templates
