# Template Upload Implementation Status

## ✅ What's Been Implemented

### 1. Backend Route Structure
- ✅ Created `/routes/admin/index.ts` - Admin router aggregator
- ✅ Created `/routes/admin/templates.ts` - Template CRUD endpoints
- ✅ Fixed import paths (supabaseAdmin, middlewares/auth)
- ✅ Fixed requireRole syntax to use strings instead of arrays
- ✅ Routes now mounted at `/api/admin/templates/*`

### 2. Dependencies
- ✅ Added `jszip` to package.json (for ZIP parsing)
- ✅ `multer` already present (for file upload)
- ✅ `uuid` already present (for IDs)
- ✅ `@supabase/supabase-js` already present

### 3. Parser Library
- ✅ `/lib/figma-template-parser.ts` - Ready to use
  - Parses ZIP files and extracts metadata
  - Organizes CSS variables into design tokens
  - Validates token completeness

### 4. Routes Available (After Installing Dependencies)
```
POST   /api/admin/templates/upload-zip
GET    /api/admin/templates
GET    /api/admin/templates/:id
PATCH  /api/admin/templates/:id
DELETE /api/admin/templates/:id
```

---

## ⏳ What Needs to be Done

### IMMEDIATE (Required to Test)

#### 1. Install Dependencies
```bash
cd /home/simon/projects/tradeworkdesk
pnpm install  # Install jszip
```

#### 2. Run Database Migration
```bash
# Option A: Using supabase CLI
cd supabase
supabase migration up

# Option B: Manual SQL (if supabase CLI not available)
# Copy contents of /supabase/patch-060-figma-templates.sql
# and execute in your Supabase dashboard SQL editor
```

**Migration creates:**
- `website_templates` table with design_tokens JSONB
- `template_versions` table for version history
- `template_usage_log` table for analytics
- RLS policies for access control
- Updated `websites` table columns

#### 3. Verify Route is Mounted
```bash
# Start API server and check routes are registered
pnpm --filter @workspace/api-server dev

# Should see no errors related to missing admin routes
```

---

## 📋 Current File Structure

```
artifacts/api-server/
├── src/
│   ├── routes/
│   │   ├── index.ts                    # Imports adminRouter from ./admin
│   │   ├── admin/
│   │   │   ├── index.ts               # ✅ NEW - Aggregates admin routes
│   │   │   └── templates.ts           # ✅ NEW - Template CRUD endpoints
│   │   └── ... (other routes)
│   ├── lib/
│   │   ├── figma-template-parser.ts   # ✅ NEW - ZIP parser
│   │   ├── supabase.ts                # Uses supabaseAdmin
│   │   └── ... (other libs)
│   ├── middlewares/
│   │   └── auth.ts                    # Has requireAuth, requireRole
│   └── index.ts
├── package.json                        # ✅ UPDATED - Added jszip
└── ...
```

---

## 🧪 Testing the Upload Endpoint

Once dependencies are installed and migration runs:

### Test 1: Upload a Template
```bash
curl -X POST http://localhost:3001/api/admin/templates/upload-zip \
  -H "Authorization: Bearer {superadminToken}" \
  -F "file=@/tmp/classic/package.zip"

# Expected: 201 success with template record
```

### Test 2: List Templates
```bash
curl http://localhost:3001/api/admin/templates \
  -H "Authorization: Bearer {superadminToken}"

# Expected: Array of templates
```

### Test 3: Get Template Details
```bash
curl http://localhost:3001/api/admin/templates/{templateId} \
  -H "Authorization: Bearer {superadminToken}"

# Expected: Full template with design_tokens
```

---

## 🔍 Known Issues / Considerations

### 1. Authentication
- Endpoints require superadmin role (`requireRole("super_admin")`)
- Token must be passed in Authorization header as Bearer token
- Check that your auth middleware correctly extracts userRole from token

### 2. File Upload Limits
- Multer configured for in-memory storage with 50MB limit
- Large templates may need disk storage instead
- Can adjust in admin/templates.ts if needed

### 3. Database Connection
- Uses `supabaseAdmin` (service role, full access)
- Requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables
- Check `.env` file has these set correctly

### 4. Storage for Preview HTML
- Parser stores preview HTML to Supabase Storage
- Requires `website-assets` bucket to exist
- If bucket missing, upload will still succeed but previewUrl will be null

---

## 🚀 Next Steps After Upload Works

1. **Ingest Provided Templates**
   ```bash
   pnpm exec ts-node src/lib/ingest-templates.ts /tmp/classic /tmp/modern
   ```

2. **Update Website Creation Endpoint**
   - Make `template_id` required in POST /api/website
   - Validate template exists and is_active
   - Merge design_tokens into website.theme

3. **Build Frontend Template Gallery**
   - Fetch templates: GET /api/templates (for users)
   - Display previews with colors/typography
   - Select template during website creation

4. **Block Publish Without Template**
   - Add check in PATCH /api/website/:id/publish
   - Return 400 if template_id is null

---

## ✋ Stop Here Before Continuing

**The template upload endpoint is almost ready!** 

Before moving forward:
1. Run `pnpm install` to add jszip
2. Run database migration
3. Verify API starts without errors
4. Test POST /api/admin/templates/upload-zip

Once upload works, we can proceed with ingesting the provided templates and updating the website creation flow.

---

## File Checklist

- [x] `/routes/admin/index.ts` - Created and mounted
- [x] `/routes/admin/templates.ts` - Created with 5 endpoints
- [x] `/lib/figma-template-parser.ts` - Ready to use
- [x] `/package.json` - jszip added
- [x] Database migration - Ready (not yet run)
- [ ] Dependencies installed - **PENDING: pnpm install**
- [ ] Migration applied - **PENDING: supabase migration up**
- [ ] API started successfully - **PENDING: pnpm dev**
- [ ] Upload tested - **PENDING: curl test**
