# Template System - CRITICAL REQUIREMENT SUMMARY

## The Requirement

**Websites cannot be created or published without selecting a template first.**

This is a **business rule**, not optional. Template selection must happen early in the user workflow, and users should preview templates with their design tokens (colors, typography) before committing.

---

## User Flow (What You Need to Build)

### Current Flow (WRONG ❌)
1. User creates blank website
2. User edits website
3. (Optional) User applies template later
4. User publishes

### Required Flow (CORRECT ✅)
1. User clicks "New Website"
2. **Template Gallery Modal Opens**
   - Shows all active templates with thumbnails
   - Each template card shows: name, description, category, industry tags
   - **"Preview" button** expands to show:
     - Color palette (from design_tokens.colors)
     - Typography options (from design_tokens.typography)
     - Dark mode variant
     - What the site will look like with this design
3. User selects template
4. Website is created **WITH template_id**
5. Website editor opens with template's design system active
6. User creates content (pages, blocks, text, images)
7. User publishes (NOW ALLOWED because template_id is set)

---

## Implementation Checklist

### Backend Changes Required

#### 1. Update POST /api/website endpoint
**File**: `artifacts/api-server/src/routes/website.ts`

Add validation:
```typescript
// REQUIRE template_id in request body
if (!req.body.template_id) {
  return res.status(400).json({ 
    error: "template_id is required" 
  });
}

// VERIFY template exists and is active
const template = await getActiveTemplate(template_id);
if (!template) {
  return res.status(400).json({ 
    error: "Invalid or inactive template" 
  });
}

// CREATE website WITH template and merged design tokens
const website = await createWebsite({
  ...req.body,
  template_id: template.id,
  theme: {
    designTokens: template.design_tokens,
    appliedTemplate: {
      templateId: template.id,
      appliedAt: new Date(),
      version: template.version
    }
  }
});
```

#### 2. Update PATCH /api/website/:id/publish endpoint
**File**: `artifacts/api-server/src/routes/website.ts`

Add blocking check:
```typescript
// BLOCK publish if no template
if (!website.template_id) {
  return res.status(400).json({
    error: "Cannot publish: template is required",
    message: "Select a design template before publishing this website"
  });
}

// Proceed with publish
```

### Frontend Changes Required

#### 1. Update Website Creation Flow
**File**: `business-app/src/pages/website-setup.tsx` (or similar)

Change flow:
- When user clicks "Create Website"
- Instead of creating blank website immediately
- **Open Template Gallery Modal** (see below)
- Only create website after template is selected
- Pass `template_id` to backend

#### 2. Create Template Gallery Component
**File**: `business-app/src/components/TemplateGallery.tsx` (NEW)

Responsibilities:
- Fetch templates: `GET /api/templates`
- Display grid of template cards
- Each card shows: name, description, thumbnail, tags
- "Preview" button shows expandable preview with:
  - Color palette from template.design_tokens.colors
  - Typography samples from template.design_tokens.typography
  - Dark/light mode toggle
- "Select" button returns selected templateId to parent
- Support filtering by category/industry

#### 3. Update Website Settings
**File**: `business-app/src/pages/website-settings.tsx`

Add:
- Display current template (name, thumbnail, applied date)
- "Change Template" button (opens Template Gallery in modal)
- Warning: "Changing template updates design only, content is preserved"

#### 4. Update Publish Button
**File**: `business-app/src/pages/website-editor.tsx`

Add blocking check:
```typescript
if (!website.template_id) {
  return (
    <button disabled>
      Publish (Select a template first)
    </button>
  );
}
```

---

## API Changes Required

### 1. POST /api/website (Updated)

**Before:**
```json
{
  "name": "My Website"
}
```

**After (REQUIRED):**
```json
{
  "name": "My Website",
  "template_id": "uuid-of-selected-template"
}
```

### 2. PATCH /api/website/:id/publish (Added Validation)

**Before:** Could publish any website

**After:** Returns 400 error if `website.template_id` is NULL

---

## Database Constraints

### websites table - Add This Check

```sql
-- If published, template must be selected
ALTER TABLE websites
ADD CONSTRAINT published_requires_template
CHECK (is_published = false OR template_id IS NOT NULL);
```

**Meaning**: You cannot mark a website as published unless it has a template_id.

---

## Design Token Example

When a user selects a template, `website.theme` will contain:

```json
{
  "designTokens": {
    "colors": {
      "primary": "#030213",
      "secondary": "#e5e7eb",
      "background": "#ffffff",
      "foreground": "oklch(0.145 0 0)",
      "destructive": "#d4183d",
      "border": "rgba(0, 0, 0, 0.1)"
    },
    "typography": {
      "font-size": "16px",
      "font-weight-normal": 400,
      "font-weight-medium": 500,
      "radius": "0.625rem"
    },
    "sidebar": {
      "background": "oklch(0.985 0 0)",
      "foreground": "oklch(0.145 0 0)"
    },
    "chart": {
      "1": "oklch(0.646 0.222 41.116)",
      "2": "oklch(0.6 0.118 184.704)"
    }
  },
  "appliedTemplate": {
    "templateId": "uuid",
    "appliedAt": "2025-06-23T10:00:00Z",
    "version": 1
  }
}
```

The editor UI uses these colors/fonts when user creates pages.

---

## Error Messages (For Users)

### When creating website without template
```
❌ "Please select a template to create a website"
```

### When publishing website without template
```
❌ "Cannot publish: Select a design template first
   → Go to Settings > Change Template"
```

### When selecting unavailable template
```
❌ "This template is no longer available or has been disabled
   → Select a different template"
```

---

## Timeline

- **Phase 1 (Database)**: Run migration (10 mins)
- **Phase 2 (Backend)**: Update 2 endpoints (30 mins)
- **Phase 3 (Frontend)**: Template gallery + flow (2-4 hours)
- **Phase 4 (Testing)**: E2E verification (30 mins)

---

## Key Points to Remember

1. **No more optional templates** - Every website has one
2. **Selection is early** - Not in settings, but in creation
3. **Preview first** - Show design tokens before user commits
4. **Backend enforces** - API rejects creation/publish without template
5. **Content is safe** - Changing templates later preserves all content
6. **Design is separate** - Templates = design, websites = content

---

## Related Files

- **Implementation Guide**: `FIGMA_TEMPLATE_SYSTEM.md`
- **Checklist**: `FIGMA_TEMPLATE_IMPLEMENTATION_CHECKLIST.md`
- **API Contract**: `TEMPLATE_SYSTEM_API_CONTRACT.md` ← Detailed endpoint specs
- **Database Migration**: `/supabase/patch-060-figma-templates.sql`
- **Parser**: `/artifacts/api-server/src/lib/figma-template-parser.ts`
- **Admin Routes**: `/artifacts/api-server/src/routes/admin/templates.ts`

---

**Next Action**: Review `TEMPLATE_SYSTEM_API_CONTRACT.md` for exact API changes, then implement the backend validation in website.ts
