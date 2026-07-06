# Figma Template Conversion System - Phase 1 Implementation

## Overview

Automated pipeline to convert Figma-exported React templates (ZIP file + published URL) into TWD template packages, with superadmin review & approval workflow before tenant deployment.

## Architecture

### Three-Phase Workflow

```
1. CONVERT (Automated)
   Figma ZIP + URL uploaded
   ↓
   Extract App.tsx structure
   Detect pages, services, content
   Extract design tokens (CSS colors/fonts)
   Generate block mapping
   ↓
   Store as "pending" in database
   
2. REVIEW (Manual)
   Superadmin reviews in dashboard
   - Page inventory
   - Detected block types
   - Design tokens extracted
   - Content preview
   ↓
   Approve or Reject
   
3. PUBLISH (Phase 2)
   Generate complete template package ZIP
   Create website_templates record
   Mark is_active=true
   ↓
   Appears in tenant dashboard
```

## Database Schema

**New Table: `template_conversions`**

```sql
- id (UUID) - conversion record ID
- status (VARCHAR) - pending|approved|rejected|processing|failed
- figma_url (TEXT) - Figma published site URL
- figma_zip_url (TEXT) - Stored ZIP file path
- template_name (VARCHAR) - User-provided template name
- template_slug (VARCHAR) - Auto-slugified
- template_description (TEXT) - Generated from app data
- industries (TEXT[]) - Plumbing, Heating, etc.
- block_mapping_report (JSONB) - Pages + detected blocks
- design_tokens (JSONB) - Colors, fonts, spacing
- created_by (UUID) - Profile who uploaded
- approved_by (UUID) - Profile who approved
- created_at, processed_at, approved_at (TIMESTAMPTZ)
```

Migration: `supabase/patch-070-template-conversions.sql`

## API Endpoints

### 1. POST `/api/superadmin/templates/convert`

Upload Figma ZIP + URL for analysis and conversion.

**Request:**
```bash
curl -X POST http://localhost:3001/api/superadmin/templates/convert \
  -H "Authorization: Bearer <superadmin-token>" \
  -F "figmaZip=@Local\ Plumbing\ Pro\ Template.zip" \
  -F "figmaUrl=https://snore-veto-98315844.figma.site" \
  -F "templateName=Local Plumbing Pro" \
  -F "industries=Plumbing&industries=Heating"
```

**Response (Success):**
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

**What It Does:**
1. Receives uploaded Figma ZIP + metadata
2. Extracts `src/app/App.tsx`
3. Parses React constants: COMPANY, PHONE, SERVICES, TESTIMONIALS, AREAS, FAQ, PROCESS_STEPS, BLOG_POSTS, GALLERY
4. Extracts `src/styles/theme.css` for design tokens (colors, fonts, spacing)
5. Generates block mapping for 13 pages (home, services, emergency, contact, etc.)
6. Stores ZIP in Supabase storage at `conversions/{uuid}/figma-export.zip`
7. Creates `template_conversions` record with status='pending'
8. Returns summary of pages and blocks detected

### 2. GET `/api/superadmin/templates/pending`

List all pending template conversions awaiting approval.

**Request:**
```bash
curl -X GET http://localhost:3001/api/superadmin/templates/pending \
  -H "Authorization: Bearer <superadmin-token>"
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "pending": [
    {
      "id": "uuid-123",
      "status": "pending",
      "template_name": "Local Plumbing Pro",
      "template_slug": "local-plumbing-pro",
      "industries": ["Plumbing", "Heating"],
      "block_mapping_report": {
        "pages": ["home", "services", "contact", ...],
        "blocksPerPage": {"home": 8, "services": 5, ...},
        "blockTypes": ["site.header", "hero.standard", "services.grid", ...]
      },
      "design_tokens": {
        "colors": {"primary": "#1e3a8a", "accent": "#f97316"},
        "typography": {...}
      },
      "created_by": "user-uuid",
      "created_at": "2026-07-04T18:10:00Z"
    },
    ...
  ]
}
```

**Use In UI:**
- Display as list of "Pending Approvals"
- Show template name, page count, block types
- Preview design tokens (color swatches)
- Approve/Reject buttons

### 3. PATCH `/api/superadmin/templates/:id/approve`

Approve a pending conversion (marks status='approved').

**Request:**
```bash
curl -X PATCH http://localhost:3001/api/superadmin/templates/:id/approve \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Template approved and ready for Phase 2 generation",
  "template": {
    "id": "uuid-123",
    "status": "approved",
    "approved_at": "2026-07-04T18:15:00Z",
    "approved_by": "admin-uuid"
  }
}
```

**What It Does:**
1. Validates conversion exists and status='pending'
2. Updates status to 'approved'
3. Records approved_at timestamp and approved_by user
4. (Phase 2) Will trigger full template package generation

## Implementation Details

### File Structure

**New Files:**
- `supabase/patch-070-template-conversions.sql` - Database schema
- `artifacts/api-server/src/lib/figma-converter.ts` - Conversion logic

**Modified Files:**
- `artifacts/api-server/src/routes/superadmin-templates.ts` - Added 3 new endpoints

### Figma Converter Service (`figma-converter.ts`)

**Key Functions:**

1. **`extractFigmaAppData(zip: JSZip)`**
   - Reads `src/app/App.tsx`
   - Extracts React constants via regex: COMPANY, PHONE, LOCATION, SERVICES_DATA, TESTIMONIALS_DATA, AREAS_DATA, FAQ_DATA, PROCESS_STEPS, BLOG_POSTS, GALLERY_IMAGES
   - Returns typed FigmaAppData object

2. **`extractDesignTokens(zip: JSZip)`**
   - Reads `src/styles/theme.css`
   - Parses CSS variables: `--primary`, `--accent`, `--background`, etc.
   - Returns color, typography, spacing tokens

3. **`generateBlockMapping(appData)`**
   - Maps 13 pages to block types based on typical site structure
   - Home: 8 blocks (header, hero, badges, features, services, process, cta, footer)
   - Services: 5 blocks (header, hero, services grid, cta, footer)
   - Etc.
   - Returns Record<pageName, blockTypes[]>

4. **`convertFigmaZipToTemplate(zipBuffer, figmaUrl, templateName, industries)`**
   - Orchestrates full conversion
   - Returns ConversionResult with success/error, pages, blockTypes, designTokens

5. **`verifyFigmaUrl(url)`**
   - Does HTTP HEAD request to verify URL is accessible
   - Returns boolean (warning only, doesn't block)

### Data Flow Example

```
Input: Local Plumbing Pro Template.zip + https://snore-veto-98315844.figma.site

↓ Extract ZIP

Read src/app/App.tsx

↓ Parse Constants

COMPANY = "Local Plumbing Pro"
PHONE = "01234 567 890"
SERVICES_DATA = [{title: "Leak Detection & Repair", ...}, ...]
TESTIMONIALS_DATA = [{name: "Sarah T.", ...}, ...]
AREAS_DATA = ["Reading", "Caversham", ...]
FAQ_DATA = [{q: "Do you charge...", a: "..."}, ...]

↓ Extract Design Tokens

--primary: #1e3a8a
--accent: #f97316
--background: #ffffff

↓ Generate Block Mapping

pages: [
  "home" → [site.header, hero.standard, trust.badges, features.list, services.grid, process.steps, cta.banner, site.footer]
  "services" → [site.header, hero.standard, services.grid, cta.banner, site.footer]
  "contact" → [site.header, hero.standard, contact.split, site.footer]
  ...
]

↓ Store Result

template_conversions:
  - status: "pending"
  - template_name: "Local Plumbing Pro"
  - template_slug: "local-plumbing-pro"
  - pages: ["home", "services", ...]
  - blockTypes: ["site.header", "hero.standard", ...]
  - design_tokens: {colors: {...}, typography: {...}}
```

## Usage Workflow

### For Superadmin

1. **Upload Template:**
   ```bash
   # Via curl or admin dashboard
   POST /api/superadmin/templates/convert
   - Upload Figma ZIP file
   - Paste Figma published URL
   - Enter template name (e.g., "Local Plumbing Pro")
   - Add industries (optional)
   ```

2. **Review Pending:**
   ```bash
   # Check what's waiting
   GET /api/superadmin/templates/pending
   # See: 3 pending templates, block mappings, design tokens
   ```

3. **Approve Template:**
   ```bash
   # Once satisfied with mapping
   PATCH /api/superadmin/templates/{id}/approve
   # Status changes to 'approved'
   ```

4. **(Phase 2) Template Goes Live:**
   - Full template package ZIP is generated
   - website_templates record created with is_active=true
   - Tenants see new template in "Available Templates" dashboard

### For Tenant

1. **See New Templates:**
   - Login to website dashboard
   - Go to "Settings" → "Templates"
   - See "Local Plumbing Pro" in the gallery (after superadmin approves)

2. **Apply Template:**
   - Click "Local Plumbing Pro"
   - See preview with design tokens and pages
   - Click "Use This Template"
   - Website applies template, pre-populated with demo content

## Phase 1 vs Phase 2

### Phase 1 (Current - MVP)
✅ Accept Figma ZIP + URL
✅ Extract and analyze structure
✅ Detect pages, services, content
✅ Extract design tokens
✅ Generate block mapping
✅ Store as "pending" review
✅ Approve/reject interface

❌ Generate actual template package JSON
❌ Create website_templates records
❌ Publish to tenant dashboard

### Phase 2 (Future)
- Implement template package generation (create all page JSONs)
- Store generated package in Supabase
- Create website_templates record with is_active=true
- Add preview UI in admin dashboard
- Add "Apply to Demo Website" button for testing
- Notify tenants of new templates
- Add template versioning

## Testing with Local Plumbing Pro

**Steps:**

1. **Create Figma export** (already done):
   - You have: `/home/simon/Downloads/Local Plumbing Pro Template.zip`
   - You have: Published URL `https://snore-veto-98315844.figma.site`

2. **Run migration:**
   ```bash
   supabase db push patch-070-template-conversions.sql
   ```

3. **Test convert endpoint:**
   ```bash
   curl -X POST http://localhost:3001/api/superadmin/templates/convert \
     -H "Authorization: Bearer <superadmin-token>" \
     -F "figmaZip=@/home/simon/Downloads/Local\ Plumbing\ Pro\ Template.zip" \
     -F "figmaUrl=https://snore-veto-98315844.figma.site" \
     -F "templateName=Local Plumbing Pro" \
     -F "industries=Plumbing&industries=Heating"
   ```

4. **Check pending:**
   ```bash
   curl -X GET http://localhost:3001/api/superadmin/templates/pending \
     -H "Authorization: Bearer <superadmin-token>"
   ```

5. **Approve:**
   ```bash
   curl -X PATCH http://localhost:3001/api/superadmin/templates/{id}/approve \
     -H "Authorization: Bearer <superadmin-token>"
   ```

## Error Handling

**Common Issues:**

1. **"App.tsx not found in ZIP"**
   - ZIP must contain `src/app/App.tsx`
   - Figma export structure may vary - verify ZIP contents

2. **"Failed to store ZIP file"**
   - Check Supabase storage bucket `template-packages` exists
   - Check credentials/permissions

3. **"Invalid Figma URL"**
   - URL doesn't need to be accessible (warning only)
   - Can be private/behind auth

4. **"Failed to parse design tokens"**
   - theme.css may not exist (uses defaults)
   - Continues with fallback values

## Future Enhancements

1. **Admin Dashboard:**
   - UI for uploading Figma ZIP + URL
   - Pending templates list with preview
   - Approve/Reject/Delete actions
   - View conversion report

2. **Preview System:**
   - Show design token colors
   - Show page structure (block diagram)
   - Show demo content
   - "Test Drive" button

3. **Automated Generation:**
   - Phase 2: full template package JSON generation
   - Auto-populate all pages with demo content
   - Generate content modes (demo, empty, ai)

4. **Tenant Notifications:**
   - Email when new template available
   - Template release notes
   - Usage analytics

## Support

For questions about the conversion process:
1. Check `figma-converter.ts` for extraction logic
2. Check `superadmin-templates.ts` for endpoint implementations
3. Review database schema in `patch-070-template-conversions.sql`
