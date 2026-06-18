# Image Generation & AI Integration Analysis

## Executive Summary

The codebase has **partial image generation capability**:
- ✅ DALL-E integration exists and is actively used for **social media images**
- ✅ Blog content generation creates **[IMAGE: description] placeholders**
- ✅ Supabase storage buckets configured for image storage
- ❌ **Blog post image generation is NOT implemented** — no endpoint to auto-generate or attach images to blog posts
- ⚠️ `website_media` table is referenced in routes but **missing from migrations**

---

## 1. Current Image Generation Capability

### 1.1 OpenAI Integration (`/lib/integrations-openai-ai-server`)

**Location:** `/lib/integrations-openai-ai-server/src/image/client.ts`

```typescript
export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer>
```

**What it does:**
- Calls OpenAI DALL-E API (`model: "gpt-image-1"`)
- Accepts text prompts
- Returns image as Buffer
- Supports 3 sizes: 1024x1024, 512x512, 256x256

**Cost tracking:**
- DALL-E-3 standard 1024x1024 = **$0.040/image**
- Tracked in `ai_usage` table via `trackAiUsage()` with `operation: "social_image"` and `model: "dall-e-3"`

### 1.2 Social Media Image Generation (WORKING ✅)

**Location:** `/artifacts/api-server/src/lib/social-ai.ts`

```typescript
export async function generateSocialImage(
  prompt: string,
  context?: { tenantId?: string; userId?: string }
): Promise<string>
```

**Flow:**
1. Takes a prompt from user
2. Enhances it: `"Create a professional, clean social media banner image for a boiler service company. {prompt}. Modern flat design, blue and orange color scheme, 1:1 aspect ratio."`
3. Generates buffer via `generateImageBuffer()`
4. Uploads to Supabase `"service-photos"` bucket
5. Returns public URL
6. Tracks usage in `ai_usage` table

**Endpoint:** `POST /admin/social/generate-image`
- Used in Social Media Post Editor (`admin-social.tsx`)
- User provides prompt → image generated → displayed in form

### 1.3 Blog Content Generation (PARTIAL ✅)

**Location:** `/artifacts/api-server/src/lib/blog-ai.ts`

```typescript
export async function runBlogAi(opts: BlogAiOptions): Promise<BlogAiResult>
```

**Supported Operations:**
- `generate` — Create new blog post from title
- `improve` — Polish existing content
- `excerpt` — Create 2-3 sentence summary (max 160 chars)
- `meta_description` — Create SEO meta description (max 155 chars)

**Content Options Include:**
- `faq` — FAQ section
- `lists` — Bullet/numbered lists
- `images` — **Image suggestions as [IMAGE: description] placeholders**
- `comparisons` — Comparison tables
- `stats` — Statistics and data points
- `tips` — Practical tips
- `cta` — Call-to-action

**What it generates:**
```markdown
## Main Heading

Some paragraph text.

[IMAGE: A technician servicing a boiler in a residential kitchen]

### Subsection

More content here...
```

**Cost Model:**
- Uses `gpt-4o-mini` ($0.15/M input, $0.60/M output)
- Charged to tenant via "AI credits" system
- Formula: `cost_usd × GBP_rate(0.79) × MARKUP(8.5) × 100 = credits`
- Minimum 1 credit per operation

---

## 2. Available APIs

### 2.1 OpenAI API
- **Provider:** `openai` proxy from `@workspace/integrations-openai-ai-server`
- **Models available:**
  - `gpt-4o-mini` — Text generation (blog, social)
  - `gpt-image-1` — Image generation (DALL-E)
- **Authentication:** Environment variables
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
- **Batch support:** Yes, via `batchProcess()` function with SSE support

### 2.2 Image Storage APIs
All via Supabase:
- **Storage buckets:**
  - `service-photos` (private) — Job photos, social images
  - `website-images` (for website content)
  - `public-uploads` (public) — Form submissions
  - `company-logos` (public)
  - `signatures` (private)
  - `website-template-assets` (public)

---

## 3. Image Storage & Organization

### 3.1 Blog Post Images

**Database Schema:** `website_blog_posts`
```sql
CREATE TABLE website_blog_posts (
  id UUID PRIMARY KEY,
  website_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content JSONB NOT NULL DEFAULT '[]',      -- Markdown/blocks with [IMAGE: ...] placeholders
  featured_image_url TEXT,                  -- ← Featured image URL (simple text field)
  status TEXT DEFAULT 'draft',              -- 'draft', 'published', 'archived'
  meta_title TEXT,
  meta_description TEXT,
  author_name TEXT,
  ai_generated BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (website_id, slug)
);
```

**Key fields:**
- `featured_image_url` — TEXT field storing a single image URL for the post
- `content` — JSONB array that can include [IMAGE: description] placeholders

### 3.2 Website Media Gallery (PARTIAL ⚠️)

**Status:** Table referenced in routes but **NOT defined in migrations**

**Expected schema (inferred from routes):**
```typescript
{
  id: string,
  website_id: string,
  tenant_id: string,
  file_name: string,
  storage_path: string,        // Path in Supabase storage
  public_url: string,          // Public URL of image
  width: number | null,
  height: number | null,
  file_size: number,
  mime_type: string,           // "image/webp"
  alt_text: string,
  created_at: string
}
```

**Storage path pattern:**
- Uploaded to bucket: `website-images`
- Path: `{tenantId}/{websiteId}/{timestamp}-{filename}.webp`
- Format: Always converted to WebP with sharp (image processing library)
- Max dimension: 2400px (resized down if larger)

**Endpoints:**
- `POST /website/media/upload` — Upload image to website gallery
- `GET /website/media` — List all images for a website
- `DELETE /website/media/:id` — Delete an image

### 3.3 Social Media Images

**Storage location:**
- Bucket: `service-photos` (private)
- Path: `social-images/{uuid}.png`
- Format: PNG 1024x1024
- Fallback: Data URI if upload fails

---

## 4. What Needs to Be Implemented

### 4.1 Missing Database Table (CRITICAL)

Create `website_media` table in migrations:

```sql
CREATE TABLE IF NOT EXISTS website_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type TEXT NOT NULL,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_website_media_website ON website_media(website_id, created_at DESC);
CREATE INDEX idx_website_media_tenant ON website_media(tenant_id);

ALTER TABLE website_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "website_media_tenant" ON website_media;
CREATE POLICY "website_media_tenant" ON website_media
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_media.tenant_id)
  );
```

### 4.2 Blog Image Generation Endpoint

Create new endpoint: `POST /website/blog/{id}/generate-featured-image`

```typescript
{
  method: "POST",
  auth: [requireAuth, requireTenant, requireRole("admin", "office_staff")],
  body: {
    prompt: string,      // e.g. "A modern boiler installation in a home"
    size?: "1024x1024" | "512x512"  // default: "1024x1024"
  },
  response: {
    imageUrl: string,    // Public URL of generated image
    featured_image_url: string,  // Same as imageUrl for featured image
    costUsd: number,
    creditsUsed: number,
    usage: {
      model: "dall-e-3",
      imagesGenerated: 1
    }
  }
}
```

**Implementation approach:**
1. Generate image via `generateImageBuffer()` with enhanced prompt (prepend industry/company context)
2. Save to Supabase `website-images` bucket
3. Insert record into `website_media` table
4. Update blog post's `featured_image_url` field
5. Track cost in `ai_usage` table with `operation: "blog_featured_image"`

### 4.3 Blog Image Placeholder Fulfillment

Create endpoint: `POST /website/blog/{id}/generate-images`

**Purpose:** Replace [IMAGE: description] placeholders with actual generated images

```typescript
{
  method: "POST",
  body: {
    placeholders: Array<{
      text: string,      // The [IMAGE: ...] text
      position: number   // Position in content
    }>
  },
  response: {
    contentUpdated: string,  // Content with placeholders replaced by public URLs
    images: Array<{
      description: string,
      imageUrl: string,
      costUsd: number
    }>,
    totalCost: number,
    creditsUsed: number
  }
}
```

**Alternative simpler approach:**
- Provide UI button in blog editor: "Generate images for placeholders"
- Show each placeholder as a card
- Let user click "Generate" for each one
- User can regenerate or use AI prompt refinement

### 4.4 Blog Editor UI Updates

**File:** `/artifacts/business-app/src/pages/website-blog-editor.tsx`

Add:
1. **Featured image picker/generator**
   - Show current featured image
   - Button: "Generate image" → opens dialog with prompt input
   - Button: "Upload/select from library"

2. **Image placeholder display**
   - Parse content for [IMAGE: ...] lines
   - Show as preview cards with "Generate", "Upload", or "Remove" buttons
   - Show generation cost before confirming

3. **Cost preview**
   - Display estimated cost before generating
   - Show remaining AI credits
   - Block generation if insufficient credits (with upsell to upgrade)

---

## 5. Cost Breakdown

### 5.1 Image Generation Costs

| Operation | Model | Cost (API) | Markup | Final Credit Cost |
|-----------|-------|-----------|--------|-------------------|
| Blog featured image | DALL-E-3 | $0.040 | 8.5x | ~34 credits |
| Social media image | DALL-E-3 | $0.040 | 8.5x | ~34 credits |
| Blog placeholder image | DALL-E-3 | $0.040 | 8.5x | ~34 credits |

### 5.2 Text Generation Costs (for comparison)

| Operation | Model | Cost (API) | Example |
|-----------|-------|-----------|---------|
| Blog post generation (500 words) | gpt-4o-mini | ~$0.20-0.30 | ~25-50 credits |
| AI improvement | gpt-4o-mini | ~$0.10-0.15 | ~10-25 credits |
| Meta description | gpt-4o-mini | ~$0.01 | ~1-2 credits |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Required)
- [ ] Create `website_media` table migration
- [ ] Test media upload endpoints
- [ ] Verify Supabase bucket configuration

### Phase 2: Blog Featured Images (MVP)
- [ ] Create `POST /website/blog/{id}/generate-featured-image` endpoint
- [ ] Add "Generate featured image" button to blog editor
- [ ] Show cost preview before generation
- [ ] Handle insufficient credits gracefully

### Phase 3: Content Image Placeholders (Enhancement)
- [ ] Parse blog content for [IMAGE: ...] lines
- [ ] Create endpoint to replace placeholders with generated images
- [ ] Add UI to preview and regenerate placeholder images
- [ ] Allow batch generation with cost preview

### Phase 4: Advanced Features (Future)
- [ ] Prompt refinement UI (suggest better prompts based on blog content)
- [ ] Image style options (realistic, illustration, icon, etc.)
- [ ] Brand compliance (auto-include company colors/style hints)
- [ ] Image variations (generate 3 versions, let user pick best)

---

## 7. Reuse Existing Patterns

### Social Media Image Generation Pattern (Proven ✅)

**File:** `/artifacts/api-server/src/lib/social-ai.ts` (lines 85-125)

This is battle-tested and can be directly adapted:

```typescript
export async function generateBlogImage(
  prompt: string,
  context?: { tenantId?: string; userId?: string }
): Promise<string> {
  // 1. Enhance prompt with blog context
  const enhancedPrompt = `Professional blog header image for a trade services blog. ${prompt}. 
    High quality, professional appearance, relevant to home services/heating/plumbing industry.`;
  
  // 2. Generate via DALL-E
  const buffer = await generateImageBuffer(enhancedPrompt, "1024x1024");
  
  // 3. Upload to Supabase
  const fileName = `blog-images/${crypto.randomUUID()}.png`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("service-photos")  // or "website-images"
    .upload(fileName, buffer, { contentType: "image/png", upsert: false });
  
  if (uploadError) {
    console.error("[blog-ai] Upload failed:", uploadError);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }
  
  // 4. Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from("service-photos")
    .getPublicUrl(fileName);
  
  // 5. Track usage
  if (context?.tenantId) {
    void trackAiUsage({
      tenantId: context.tenantId,
      userId: context.userId,
      operation: "blog_featured_image",
      module: "website",
      model: "dall-e-3",
      imagesGenerated: 1,
    });
  }
  
  return urlData.publicUrl;
}
```

### Blog AI Integration Pattern (Proven ✅)

**File:** `/artifacts/api-server/src/lib/blog-ai.ts`

Already has:
- Cost calculation (`calcCredits()`)
- Usage tracking integration
- Tenant/user context
- Error handling

Just needs:
- New operation type: `"generate_featured_image"`
- New operation type: `"generate_placeholder_images"`

---

## 8. Notes & Gotchas

1. **Website media table is missing** — Routes reference `website_media` table but it's not in migrations. This will cause 500 errors. Must create it first.

2. **Blog content format** — Content is stored as JSONB (array of blocks), but the UI editor treats it as plain text. Need to handle parsing for [IMAGE: ...] placeholders.

3. **Storage bucket routing** — Different entity types use different buckets:
   - Service photos → `service-photos`
   - Website media → `website-images`
   - Social images → `service-photos` (reused)

4. **Image optimization** — Images are automatically converted to WebP by `sharp` library (server-side processing). This is good for performance.

5. **Cost markup is steep** — 8.5x markup on AI costs. $0.04 image becomes 34 credits ($0.34 equivalent). Ensure UI clearly shows cost.

6. **No image editing** — `editImages()` function exists in OpenAI integration but isn't used anywhere. Could be useful for image variations.

7. **Featured image vs content images** — Two separate concerns:
   - `featured_image_url` = single image for post preview/card
   - Content `[IMAGE: ...]` = multiple images referenced within post body

---

## Files to Modify/Create

### New Files Needed:
```
supabase/migrations/00XX_website_media_table.sql
artifacts/api-server/src/lib/blog-image-ai.ts
artifacts/api-server/src/routes/website-blog-images.ts
```

### Existing Files to Update:
```
artifacts/api-server/src/routes/website-domains-blog.ts  // Blog routes
artifacts/business-app/src/pages/website-blog-editor.tsx  // UI for featured image
lib/integrations-openai-ai-server/src/index.ts  // Export new functions
```

---

## Verdict

**Status: 60% Ready for Blog Images**

- ✅ DALL-E API integrated and proven (social media use)
- ✅ Image storage (Supabase buckets) configured
- ✅ Cost tracking and credit system in place
- ❌ Blog-specific image table missing
- ❌ No blog image generation endpoints
- ❌ No UI for generating/attaching images to blog posts

**Estimated effort to implement:**
- Database migration: 30 mins
- Backend endpoints: 2-3 hours (can copy social image pattern)
- Frontend UI: 2-3 hours
- Testing: 1 hour
- **Total: ~6-7 hours** for full MVP
