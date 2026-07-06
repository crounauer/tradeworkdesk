# Figma → Template Package Workflow

## Overview
Automated pipeline to convert Figma published sites to template packages with visual accuracy and content preservation.

## Process

### Phase 1: Analysis (Automated)
**Input:** Figma published URL  
**Output:** Analysis document + visual screenshots

1. Open Figma URL
2. For each page in the page navigation:
   - Click page button
   - Wait for load
   - Take screenshot (full page, scrolled)
   - Extract DOM structure (sections, headings, content)
   - Extract colors/fonts from CSS
3. Generate analysis document with:
   - Page inventory
   - Design tokens extracted
   - Content map (what text appears where)
   - Visual section breakdown

### Phase 2: Block Mapping (User Review)
**Input:** Analysis document  
**Output:** Block mapping confirmation

User reviews the analysis and confirms:
```
Page: home
Section Name | Recommended Block | Confidence | Approved
Hero Banner | hero.standard | 95% | ✓
Services Cards | services.grid | 90% | ✓
Trust Badges | trust.badges | 99% | ✓
CTA Banner | cta.banner | 95% | ✓
FAQ | faq.accordion | 88% | ✓
Footer | site.footer | 99% | ✓
```

User can override recommendations or flag sections for manual review.

### Phase 3: Generation (Automated)
**Input:** Approved block mapping + analysis  
**Output:** Template package ZIP

1. Create directory structure
2. Generate `template.json` with metadata
3. Generate `pages/pages.json` manifest
4. For each page:
   - Generate `pages/[slug].json` with blocks
   - Populate block props from extracted content
   - Assign color values from design tokens
5. Generate `styles/theme.json` from extracted colors
6. Generate `registry/block-registry.json` from used blocks
7. Create content modes (demo, empty, ai)
8. Package as ZIP

### Phase 4: Validation (Automated)
**Input:** Generated template package  
**Output:** Validation report

- Verify structure against schema
- Check all files present
- Validate JSON syntax
- Cross-reference block types
- Report any issues
- Ready for import ✓

---

## Usage

### For a Single Template

```bash
# User provides Figma URL
URL="https://snore-veto-98315844.figma.site"

# Agent:
# 1. Downloads and analyzes Figma
# 2. Generates analysis document
# 3. Shows screenshots
# 4. Proposes block mapping
# 5. Waits for user confirmation
# 6. Generates package
# 7. Tests validation
# 8. Returns ZIP file
```

### For Multiple Templates (Batch)

```bash
# User provides list of URLs
URLs=[
  "https://figma-url-1",
  "https://figma-url-2",
  "https://figma-url-3",
]

# Agent processes each:
# - Downloads/analyzes
# - Generates analysis doc
# - Requests mapping confirmation
# - Generates package
# - Stores in template library
```

---

## Accuracy Guarantees

### What I Can Extract Automatically
✅ Page structure and sections (from DOM)
✅ All text content (headings, copy, CTAs)
✅ Design tokens: colors, fonts, spacing
✅ Component hierarchy
✅ Visual layout (from screenshots)
✅ Links and navigation

### What Requires User Input
⚠️ Section → Block Type mapping (user confirms recommendations)
⚠️ Content field assignments (if ambiguous)
⚠️ Special cases or exceptions
⚠️ Mobile-specific behavior

### Mitigation for Missing Details
- Screenshots provide visual reference
- User can override any recommendation
- Analysis document shows confidence level
- Content can be manually corrected before generation
- Review phase prevents errors propagating

---

## Files Generated

For each template:
```
[template-slug]-template-package.zip
├── templates/[slug]/
│   ├── template.json          (metadata)
│   ├── pages/
│   │   ├── pages.json         (manifest)
│   │   ├── [page-slug].json   (blocks + content)
│   │   └── ...
│   ├── styles/theme.json      (design tokens)
│   └── cms-mapping.json       (content map)
├── registry/block-registry.json
├── scripts/validate-template.ts
├── supabase/seed-template-example.sql
└── README.md
```

---

## Success Criteria

✅ Visual layout matches Figma design  
✅ All content text preserved  
✅ Colors match design tokens  
✅ Block types appropriate for content  
✅ All 16 pages generated  
✅ Package passes validation  
✅ Ready for import to production  

