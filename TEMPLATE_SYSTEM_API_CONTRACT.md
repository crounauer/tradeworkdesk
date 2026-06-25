# Template System - API Contract & Enforcement

## Critical Business Rule

**Templates are MANDATORY** - This is enforced at the API level.

---

## Website Creation Endpoint

### POST /api/website

**Request Body:**
```json
{
  "name": "My Website",
  "template_id": "uuid-of-active-template",  // REQUIRED - not optional
  "site_slug": "my-website",
  "description": "Optional description"
}
```

**Success Response (201):**
```json
{
  "id": "website-uuid",
  "name": "My Website",
  "template_id": "uuid-of-active-template",
  "applied_template_version": 1,
  "applied_at": "2025-06-23T10:00:00Z",
  "theme": {
    "designTokens": {
      "colors": { "primary": "#030213", ... },
      "typography": { "font-size": "16px", ... },
      "sidebar": { ... },
      "chart": { ... }
    },
    "appliedTemplate": {
      "templateId": "uuid-of-active-template",
      "appliedAt": "2025-06-23T10:00:00Z",
      "version": 1
    }
  },
  "status": "draft",
  "created_at": "2025-06-23T10:00:00Z"
}
```

**Error: Missing template_id (400)**
```json
{
  "error": "template_id is required",
  "message": "You must select a template to create a website. Browse templates to see design options.",
  "action": "Select a template and try again",
  "href": "/templates"
}
```

**Error: Invalid template_id (400)**
```json
{
  "error": "Invalid or inactive template",
  "message": "The template you selected is no longer available or has been disabled.",
  "action": "Select a different template"
}
```

**Error: Template not active (400)**
```json
{
  "error": "Template not available",
  "message": "This template has not been published yet. Please select a published template."
}
```

---

## Website Publishing Endpoint

### PATCH /api/website/:id/publish

**Request Body:**
```json
{
  "is_published": true
}
```

**Success Response (200):**
```json
{
  "id": "website-uuid",
  "is_published": true,
  "published_at": "2025-06-23T10:05:00Z",
  "template_id": "uuid-of-active-template",
  "theme": { ... }
}
```

**Error: No template selected (400)** ⚠️ CRITICAL BLOCKING ERROR
```json
{
  "error": "Cannot publish: template is required",
  "message": "This website doesn't have a design template selected. You must apply a template before publishing.",
  "action": "Go to website settings → Change Template",
  "blockingError": true
}
```

---

## Template Listing Endpoint

### GET /api/website/:id/templates

**Response (200):**
```json
[
  {
    "id": "uuid-classic",
    "name": "Classic Template",
    "slug": "classic-template",
    "description": "Professional, clean design suitable for service businesses",
    "category": "professional",
    "thumbnail_url": "https://...",
    "is_featured": true,
    "design_tokens": {
      "colors": { "primary": "#030213", ... },
      "typography": { ... }
    }
  },
  {
    "id": "uuid-modern",
    "name": "Modern Template",
    "slug": "modern-template",
    "description": "Contemporary design with dark mode support",
    "category": "modern",
    "thumbnail_url": "https://...",
    "is_featured": false,
    "design_tokens": { ... }
  }
]
```

---

## Template Application Endpoint

### POST /api/website/:id/apply-template

**Note:** This is for CHANGING templates after creation. Initial template is selected during creation.

**Request Body:**
```json
{
  "templateId": "uuid-of-new-template",
  "seedDemoPages": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "website": {
    "id": "website-uuid",
    "template_id": "uuid-of-new-template",
    "applied_template_version": 1,
    "applied_at": "2025-06-23T10:10:00Z",
    "theme": {
      "designTokens": { ... }  // Updated with new template tokens
    }
  },
  "message": "Template applied successfully. Your website content has been preserved."
}
```

---

## Database Constraints (Enforcement)

### websites Table

```sql
CREATE TABLE websites (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- REQUIRED: template_id cannot be null for published websites
  template_id UUID REFERENCES website_templates(id),
  applied_template_version INTEGER,
  applied_at TIMESTAMPTZ,
  
  -- Theme must include design tokens from template
  theme JSONB NOT NULL DEFAULT '{}',
  
  -- Publishing constraint
  is_published BOOLEAN DEFAULT false,
  
  -- CONSTRAINT: If is_published = true, template_id MUST NOT be null
  -- CONSTRAINT PUBLISH_REQUIRES_TEMPLATE
  -- CHECK (is_published = false OR template_id IS NOT NULL),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Validation Rules (Implement These)

### Backend Validation: Website Creation

```typescript
async function createWebsite(req: Request, res: Response) {
  const { name, template_id } = req.body;
  const tenantId = req.headers["x-tenant-id"];

  // ❌ FAIL: template_id missing
  if (!template_id) {
    return res.status(400).json({
      error: "template_id is required",
      message: "Select a template to create a website"
    });
  }

  // ❌ FAIL: template doesn't exist
  const { data: template } = await supabase
    .from("website_templates")
    .select("id, design_tokens, version")
    .eq("id", template_id)
    .single();

  if (!template) {
    return res.status(400).json({ error: "Invalid template_id" });
  }

  // ❌ FAIL: template not active
  if (!template.is_active) {
    return res.status(400).json({ error: "Template not available" });
  }

  // ✅ SUCCESS: Create website with template
  const { data: website } = await supabase
    .from("websites")
    .insert({
      tenant_id: tenantId,
      name,
      template_id,
      applied_template_version: template.version,
      applied_at: new Date().toISOString(),
      theme: { designTokens: template.design_tokens },
      status: "draft"
    })
    .select()
    .single();

  res.status(201).json(website);
}
```

### Backend Validation: Website Publishing

```typescript
async function publishWebsite(req: Request, res: Response) {
  const { id: websiteId } = req.params;
  const tenantId = req.headers["x-tenant-id"];

  const { data: website } = await supabase
    .from("websites")
    .select("id, template_id")
    .eq("id", websiteId)
    .eq("tenant_id", tenantId)
    .single();

  // ❌ CRITICAL: Cannot publish without template
  if (!website.template_id) {
    return res.status(400).json({
      error: "Cannot publish: template is required",
      message: "Apply a design template before publishing this website",
      blockingError: true
    });
  }

  // ✅ SUCCESS: Publish website
  const { data: published } = await supabase
    .from("websites")
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq("id", websiteId)
    .select()
    .single();

  res.json(published);
}
```

---

## Frontend Validation

### Website Creation Flow

```typescript
// website-setup.tsx

const [selectedTemplate, setSelectedTemplate] = useState<UUID | null>(null);

const handleCreateWebsite = async () => {
  // ❌ Block creation if no template selected
  if (!selectedTemplate) {
    toast.error("Please select a template to create a website");
    return;
  }

  const response = await fetch("/api/website", {
    method: "POST",
    body: JSON.stringify({
      name: "New Website",
      template_id: selectedTemplate  // REQUIRED
    })
  });

  if (response.ok) {
    // Redirect to editor with template design system active
    navigate(`/website/${website.id}/editor`);
  }
};

return (
  <TemplateGallery
    onSelect={setSelectedTemplate}
    showPreview={true}
  />
);
```

### Website Publishing Flow

```typescript
// website-editor.tsx

const handlePublish = async () => {
  // ❌ Block publish if no template
  if (!website.template_id) {
    toast.error(
      "You must apply a design template before publishing. " +
      "Go to Settings > Change Template"
    );
    return;
  }

  const response = await fetch(`/api/website/${website.id}/publish`, {
    method: "PATCH",
    body: JSON.stringify({ is_published: true })
  });

  if (response.ok) {
    toast.success("Website published!");
  } else {
    const error = await response.json();
    toast.error(error.message);
  }
};
```

---

## Testing the Enforcement

### Test 1: Cannot create without template
```bash
curl -X POST http://localhost:3001/api/website \
  -H "x-tenant-id: {tenantId}" \
  -d '{"name": "Test"}'

# Expected: 400 error
# "template_id is required"
```

### Test 2: Can create WITH template
```bash
curl -X POST http://localhost:3001/api/website \
  -H "x-tenant-id: {tenantId}" \
  -d '{"name": "Test", "template_id": "{uuid}"}'

# Expected: 201 success
# Website has template_id and design_tokens merged
```

### Test 3: Cannot publish without template
```bash
# Create website, then manually null out template_id in DB
curl -X PATCH http://localhost:3001/api/website/{id}/publish \
  -d '{"is_published": true}'

# Expected: 400 error
# "template is required"
```

---

## Summary

| Operation | Requirement | Error Code | Message |
|-----------|-------------|------------|---------|
| Create website | `template_id` required | 400 | "template_id is required" |
| Create website | Template must exist | 400 | "Invalid template_id" |
| Create website | Template must be active | 400 | "Template not available" |
| Publish website | `template_id` must NOT be null | 400 | "template is required" |
| Apply template | Optional (can be done anytime) | 200 | "Template applied" |
| Remove template | ❌ NOT ALLOWED (template is mandatory) | — | — |

**Key Principle**: Once a website is created with a template, the template can be CHANGED but never removed. Template is always required.
