# Figma Template System Implementation Guide

## Overview

This document describes the complete Figma template system implementation for TradeWorkDesk (TWD). The system allows superadmins to upload Figma-exported React templates, extract design tokens (colors, typography, spacing), and apply those design systems to user websites.

## ⚠️ CRITICAL REQUIREMENT

**Templates are mandatory for all websites:**
- Websites CANNOT be created or published without a template selected
- Template selection must occur EARLY in the website creation workflow
- Users should preview templates with interactive design token visualization BEFORE committing to a selection
- Backend enforces: `template_id` is required on website creation, and publish is blocked if template_id is null
- This is a business rule, not optional functionality

## Architecture

### Design Principle: Separation of Concerns

- **Templates** = Design system only (colors, typography, spacing, components)
- **Websites** = User content (pages, blocks, text, images)
- **Theme Merge** = When a template is applied, design tokens are merged into `website.theme` JSONB

This separation ensures:
- Users can switch templates without losing content
- Templates are reusable across multiple websites
- Design updates can be versioned independently

## Data Structure

### Database Tables

#### 1. `website_templates`
Main template record with design tokens extracted from Figma exports.

```sql
{
  id: UUID,                          -- Primary key
  name: "Classic Template",          -- Display name
  slug: "classic-template",          -- URL-safe identifier
  description: "...",                -- Marketing copy
  category: "professional",          -- For filtering
  version: 1,                        -- Incremented on updates
  design_tokens: {                   -- Extracted CSS variables
    "colors": {
      "primary": "#030213",
      "secondary": "#e5e7eb",
      "background": "#ffffff",
      ... (all color vars)
    },
    "typography": {
      "font-size": "16px",
      "font-weight-medium": 500,
      "radius": "0.625rem"
    },
    "sidebar": { ... },
    "chart": { ... }
  },
  demo_pages: [],                    -- Optional seeded pages
  figma_export_info: {               -- Metadata from Figma
    "exported_at": "2025-06-23T10:00:00Z",
    "figma_project_url": "...",
    "features": [...],
    "industry_tags": [...]
  },
  is_active: true,                   -- Published/visible
  is_featured: false,                -- Highlighted in gallery
  created_by: UUID,                  -- Superadmin ID
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

#### 2. `template_versions`
Version history for rollback capability.

```sql
{
  id: UUID,
  template_id: UUID,
  version: 1,
  design_tokens: JSONB,              -- Copy of design tokens
  demo_pages: JSONB,                 -- Copy of demo pages
  release_notes: "...",
  released_at: TIMESTAMPTZ
}
```

#### 3. `template_usage_log`
Tracks template application and removal for analytics.

```sql
{
  id: UUID,
  website_id: UUID,
  template_id: UUID,
  action: "applied" | "switched" | "removed",
  applied_version: 1,
  content_preserved: true,           -- Did we keep existing content?
  applied_at: TIMESTAMPTZ,
  tenant_id: UUID
}
```

#### 4. Modified `websites` table
Added template tracking columns:

```sql
{
  template_id: UUID,                 -- Current template (nullable)
  applied_template_version: INTEGER, -- Which version is applied
  applied_at: TIMESTAMPTZ,           -- When template was applied
  theme: JSONB {                     -- Merged design system
    "designTokens": { ... },
    "appliedTemplate": {
      "templateId": "...",
      "appliedAt": "2025-06-23T...",
      "version": 1
    }
  }
}
```

## File Structure

```
artifacts/api-server/src/
├── lib/
│   ├── figma-template-parser.ts          -- ZIP parsing & token extraction
│   └── ingest-templates.ts               -- CLI tool for ingestion
├── routes/
│   ├── website-templates.ts              -- Existing route file (updated)
│   ├── website-templates-apply.ts        -- NEW: User template application
│   └── admin/
│       └── templates.ts                  -- NEW: Admin CRUD

supabase/
├── patch-060-figma-templates.sql         -- NEW: Schema migration
├── patch-061-template-rls.sql            -- NEW: Row-level security
└── 0083_phase2_website_builder_schema.sql -- UPDATED: websites table

tmp/
├── classic/                              -- Extracted Figma template
│   ├── metadata.json                     -- NEW: Template metadata
│   ├── default_shadcn_theme.css
│   └── [React source files]
└── modern/                               -- Extracted Figma template
    ├── metadata.json
    ├── default_shadcn_theme.css
    └── [React source files]
```

## Implementation Steps

### User-Facing Workflow (Critical Path)

This is the PRIMARY flow that must be implemented:

1. **User initiates website creation** → Dashboard "New Website" button
2. **Template gallery modal opens** → Shows all active templates with:
   - Thumbnail/card for each template
   - Name, description, category tags
   - "Preview" button expands to show colors, typography, dark mode variant
3. **User browses and previews** → Can view multiple templates side-by-side
4. **User selects template** → Clicks "Create Website with [Template]"
5. **Website created with template_id** → Backend creates website record with:
   - template_id (from user selection)
   - design_tokens merged into theme JSONB
   - applied_at timestamp
6. **User lands in website editor** → Editor displays template's design system:
   - Color palette shows template colors
   - Typography options from template
   - Layout respects template structure
7. **User creates content** → Pages, blocks, text, images using template design
8. **User publishes website** → Only allowed because template_id is set
   - Backend checks: if template_id is NULL, reject publish with helpful error

### Phase 1: Database Setup

1. **Run migrations** (local dev):
   ```bash
   cd supabase
   supabase migration up  # or manual SQL execution
   ```

2. **Verify tables**:
   ```bash
   supabase db pull  # to see schema
   ```

### Phase 2: Backend Integration

1. **Install dependencies** (if not already present):
   ```bash
   pnpm add jszip uuid
   ```

2. **Update API routes** in `/artifacts/api-server/src/app.ts`:
   ```typescript
   import templatesAdminRouter from "./routes/admin/templates";
   
   app.use("/api/admin/templates", templatesAdminRouter);
   ```

3. **Ingest templates** (one-time setup):
   ```bash
   cd artifacts/api-server
   pnpm exec ts-node src/lib/ingest-templates.ts \
     /tmp/classic \
     /tmp/modern
   ```

### Phase 3: Frontend Integration

1. **Create template gallery component** in business-app:
   ```typescript
   // src/components/TemplateGallery.tsx
   - Fetch /api/website/:id/templates
   - Display cards with thumbnails
   - Preview modal with design tokens
   - Apply button → POST /api/website/:id/apply-template
   ```

2. **Add to website settings UI**:
   - "Browse Templates" button
   - Template info card showing applied template
   - "Switch Template" or "Remove Template" options

3. **Display theme tokens in editor**:
   - Color picker uses `website.theme.designTokens.colors`
   - Typography dropdown uses `website.theme.designTokens.typography`

### Phase 4: Testing

1. **Test template application**:
   ```bash
   curl -X POST http://localhost:3001/api/website/{id}/apply-template \
     -H "Authorization: Bearer {token}" \
     -H "x-tenant-id: {tenantId}" \
     -H "Content-Type: application/json" \
     -d '{ "templateId": "{templateId}", "seedDemoPages": false }'
   ```

2. **Verify design tokens**:
   - Fetch website: `GET /api/website/{id}`
   - Check `theme.designTokens` is populated
   - Verify color values are from template

3. **Test template switching**:
   - Apply template A
   - Apply template B
   - Verify design tokens update, content preserved

## API Endpoints

### User Endpoints

#### Get available templates for website
```
GET /api/website/:id/templates
Headers:
  Authorization: Bearer {token}
  x-tenant-id: {tenantId}

Response:
[
  {
    id: UUID,
    name: "Classic Template",
    slug: "classic-template",
    description: "...",
    thumbnail_url: "...",
    is_featured: true
  }
]
```

#### Apply template to website
```
POST /api/website/:id/apply-template
Headers:
  Authorization: Bearer {token}
  x-tenant-id: {tenantId}

Body:
{
  "templateId": UUID,
  "seedDemoPages": false  // optional, default false
}

Response:
{
  success: true,
  website: { ... },
  message: "Template applied successfully"
}
```

#### Remove template from website
```
POST /api/website/:id/remove-template
Headers:
  Authorization: Bearer {token}
  x-tenant-id: {tenantId}

Response:
{
  success: true,
  website: { ... },
  message: "Template removed. Website content preserved."
}
```

### Admin Endpoints

#### Upload Figma template ZIP
```
POST /api/admin/templates/upload-zip
Headers:
  Authorization: Bearer {superadminToken}

Body: multipart/form-data
  file: <zip file>

Response:
{
  success: true,
  template: { ... },
  validation: { valid: true, warnings: [] }
}
```

#### List all templates
```
GET /api/admin/templates
Headers:
  Authorization: Bearer {superadminToken}

Response:
[
  {
    id: UUID,
    name: "...",
    category: "...",
    is_active: true,
    created_at: "...",
    ...
  }
]
```

#### Update template metadata
```
PATCH /api/admin/templates/:id
Headers:
  Authorization: Bearer {superadminToken}

Body:
{
  "name": "Updated Name",
  "description": "...",
  "is_featured": true,
  "is_active": true
}
```

#### Delete template (if not in use)
```
DELETE /api/admin/templates/:id
Headers:
  Authorization: Bearer {superadminToken}

Response:
{ success: true }
```

## Design Token Format

When extracted from Figma's `default_shadcn_theme.css`, design tokens are organized into groups:

```typescript
interface DesignTokens {
  // Core colors
  colors: {
    background: "#ffffff",
    foreground: "oklch(0.145 0 0)",
    primary: "#030213",
    secondary: "oklch(0.95 0.0058 264.53)",
    destructive: "#d4183d",
    border: "rgba(0, 0, 0, 0.1)",
    [key: string]: string
  },
  
  // Typography and spacing
  typography: {
    "font-size": "16px",
    "font-weight-normal": 400,
    "font-weight-medium": 500,
    "radius": "0.625rem",
    [key: string]: string
  },
  
  // Optional: Sidebar colors
  sidebar?: {
    background: "oklch(0.985 0 0)",
    foreground: "oklch(0.145 0 0)",
    primary: "#030213",
    [key: string]: string
  },
  
  // Optional: Chart colors
  chart?: {
    "1": "oklch(0.646 0.222 41.116)",
    "2": "oklch(0.6 0.118 184.704)",
    [key: string]: string
  }
}
```

## Figma Template Export Format

The system expects Figma-exported ZIPs with this structure:

```
template.zip
├── metadata.json                    -- Template info
├── default_shadcn_theme.css         -- Design tokens (required)
├── index.html                       -- Preview (optional)
├── package.json
├── src/
│   ├── main.tsx
│   ├── app/App.tsx
│   ├── styles/
│   │   ├── theme.css
│   │   ├── globals.css
│   │   └── index.css
│   └── ...
└── [other files]
```

The system:
1. Extracts `metadata.json` for template info
2. Parses CSS variables from theme files
3. Ignores React source code (used only for visual reference)
4. Stores design tokens in database
5. Optionally stores preview HTML for visual preview

## Future Enhancements

### Phase 2 (Later):
- **Template marketplace**: Rate, comment, download community templates
- **Template editor**: Visual design system editor (instead of just upload)
- **Asset management**: Upload custom fonts, icons, images with template
- **Component library**: Include pre-built shadcn components with template
- **Theme builder**: Create custom themes without Figma

### Phase 3:
- **Template analytics**: Track which templates are most popular
- **A/B testing**: Test different templates on websites
- **Auto-suggestions**: Recommend templates based on industry
- **Design system sync**: Two-way sync with Figma (update template, push to all users)

## Troubleshooting

### Template upload fails: "Invalid template"
**Cause**: Missing CSS variables in the theme file
**Fix**: Ensure `default_shadcn_theme.css` exists and contains `:root { ... }` CSS variables

### Design tokens not applied
**Cause**: Theme merge didn't happen or website wasn't fetched after apply
**Fix**: 
- Verify `POST /api/website/{id}/apply-template` returned success
- Fetch website: `GET /api/website/{id}` and check `theme.designTokens`

### Cannot delete template
**Cause**: Template is still applied to websites
**Fix**: Remove template from all websites first, then delete

## Files Created/Modified

### Created:
- ✅ `/supabase/patch-060-figma-templates.sql` — Schema migration
- ✅ `/artifacts/api-server/src/lib/figma-template-parser.ts` — ZIP parsing
- ✅ `/artifacts/api-server/src/lib/ingest-templates.ts` — CLI ingestion tool
- ✅ `/artifacts/api-server/src/routes/admin/templates.ts` — Admin endpoints
- ✅ `/artifacts/api-server/src/routes/website-templates-apply.ts` — User endpoints
- ✅ `/tmp/classic/metadata.json` — Classic template metadata
- ✅ `/tmp/modern/metadata.json` — Modern template metadata

### Modified:
- ✅ `/supabase/migrations/0083_phase2_website_builder_schema.sql` — Added template columns to websites table

### Next (for you to implement):
- [ ] Update `/artifacts/api-server/src/app.ts` to mount admin/template routes
- [ ] Create frontend template gallery component
- [ ] Add template UI to website settings
- [ ] Test end-to-end template application

## Environment Variables

No new environment variables required. Existing `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are used.

## References

- **Figma exports**: `/tmp/classic/` and `/tmp/modern/` (extracted from uploads)
- **Design tokens spec**: OKLch and hex color formats supported
- **shadcn/ui**: Uses Tailwind CSS custom properties naming convention
- **Deployment**: Changes require database migration before deployment to production
