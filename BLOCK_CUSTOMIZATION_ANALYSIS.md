# Website Renderer Block Customization & Variations Analysis

**Analysis Date:** 2026-07-06  
**Total Blocks Analyzed:** 25  
**Scope:** `/artifacts/website-renderer/src/components/blocks/`

---

## Summary

All 25 blocks support **comprehensive theme customization** through color and font props. Most blocks (22/25) support **multiple display variations/layouts**. Theme props follow a consistent naming pattern:
- **Colors:** `accent_color`, `primary_color`, `background_color`, `text_color`, `heading_color`, `body_color`, `border_color`, etc.
- **Fonts:** `heading_font_family`, `body_font_family`, `button_font_family` (supporting global overrides via `global_heading_font_family`, etc.)
- **Sizes:** `heading_size`, `body_size`, `padding_y`, `padding_x`, `card_radius`, `max_width`

---

## Comprehensive Block Analysis

| # | Block Name | Theme Customization | Display Variations/Layouts | Key Config Options | Notes |
|---|---|---|---|---|---|
| 1 | **HeroBlock** | ✅ FULL: `accent_color`, `primary_color`, `primary_text_color`, `muted_background_color`, `border_color`, `muted_text_color`, `heading_color`, `subheading_color`, `eyebrow_color`, `primary_button_bg_color`, `primary_button_text_color`, `secondary_button_*`, `badge_*`, `trust_*`, `card_*`; Fonts: `heading_font_family`, `body_font_family`, `cta_font_family`; Sizes: `heading_font_size`, `subheading_font_size`, `cta_font_size`, `stats_*_font_size` | ✅ 4 variations: `variant="default|modern|classic"`, `layout="full|centered|split"`, `heroStyle="default|modern|classic"`, `tone="default|navy|light"`, `density="compact|normal|comfortable"`, `ctaStyle="default|rounded|soft|outline"` | `alignment`, `min_height`, `overlay_opacity`, `overlay_color`, `border_radius`, `content_max_width`, `content_gap`, `section_padding_*`, fonts, badge support, trust items, stats | Richest block; supports badges, trust items, stats, multiple CTA styles |
| 2 | **ServicesBlock** | ✅ FULL: `accent_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`, `badge_bg`, `badge_text_color`, `border_color`, `card_bg`, `background_color`, `muted_background_color`, `link_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`, `global_button_font_family`; Sizes: `heading_size`, `item_title_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="card-grid|split-list|icon-panels|compact-rows"` | `columns` (2-4), `padding_*`, `max_width`, Schema.org support | Comprehensive color/font control; grid/list/panel/row layouts |
| 3 | **ProcessBlock** | ✅ FULL: `accent_color`, `sectionBg`, `cardBg`, `borderColor`, `headingColor`, `bodyColor`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="numbered-cards|timeline|split-list|minimal-steps"` | `cols` (1-4), `padding_*`, step numbering/icons, CTA support | Dark mode ready; flexible step display |
| 4 | **TestimonialsBlock** | ✅ FULL: `accent_color`, `section_bg`, `card_bg`, `card_border`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`, `meta_color`, `star_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="card-grid|editorial-list|spotlight|compact-rows"` | `columns`, `padding_*`, rating display, source link, aggregate rating | Star ratings, flexible columns, editorial mode |
| 5 | **FeatureCardsBlock** | ✅ FULL: `accent_color`, `section_bg`, `card_bg`, `border_color`, `heading_color`, `body_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="card-grid|split-list|icon-panels|minimal-tiles"` | `padding_*`, `max_width`, icon support, CTA per card | Checklist-style or numbered feature lists |
| 6 | **TextBlock** | ✅ PARTIAL: `accent_color`, `heading_color`, `text_color` (for modern template); minimal in legacy mode; Fonts: inherited | ✅ 2 variations: Modern template detection via `isModernTemplateContent()`, `align="left|center|right"` | Sanitized HTML/text rendering, eyebrow/title/subtitle | Simple content block; uses isModernTemplateContent for style switching |
| 7 | **FaqBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="accordion-card|minimal-list|stacked-cards|split-panels"` | `padding_*`, `max_width`, Schema.org FAQPage support | Interactive accordions; panels/card modes |
| 8 | **GalleryBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`; Sizes: `heading_size`, `image_radius`, `image_height` | ✅ 4 variations: `layout="grid|masonry|collage|strip"` | `columns` (2-4), `image_height`, `image_radius`, `padding_*`, label support | Responsive grid, masonry, collage, horizontal strip |
| 9 | **CtaBlock** | ✅ FULL: `accent_color`, `background_color`, `text_color`, `border_color`, `primary_button_bg`, `primary_button_text`, `secondary_button_bg`, `secondary_button_text`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `subheading_size`, `button_radius`, `section_radius` | ✅ 4 variations: `layout="center-banner|split-inline|stacked-card|minimal-strip"` | `padding_*`, dual CTA support (primary+secondary), phone support | Bold sections; multiple button styles |
| 10 | **ImageBlock** | ✅ FULL: `accent_color`, `section_bg`, `frame_bg`, `border_color`, `caption_color`; Fonts: `body_font_family`, `global_body_font_family`; Sizes: `caption_size`, `image_radius` | ✅ 4 variations: `layout="single-frame|polaroid|split-caption|minimal-edge"`, `width="full|wide|contained|normal"` | `image_radius`, `padding_*`, caption support | Image layouts with frame/caption options |
| 11 | **SpacerBlock** | ✅ PARTIAL: `section_bg`, `rule_color`, `accent_color`; no font props | ✅ 4 variations: `layout="blank-gap|divider-line|accent-rule|dotted-rule"` | `height` (sm/md/lg/xl or px), spacing variants | Decorative spacing; styled rules/dividers |
| 12 | **DetailSectionBlock** | ✅ FULL: `accent_color`, `background_color`, `text_color`; basic font support | ✅ 1 variation: image-optional split layout | `label`, `cta_text`, `cta_url`, `image_url`, padding/shadow | Two-column with optional image; image-right mode |
| 13 | **FeaturesBarBlock** | ✅ FULL: `accent_color`, `section_bg`, `card_bg`, `background_color`, `text_color`, `body_color`, `heading_color`, `border_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="icon-grid|split-list|minimal-strip|numbered-cards"`, `columns` (1-4) | Icon background styling, opacity controls | Features in colored boxes; icon badges |
| 14 | **ContactFormBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `form_background`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`, `icon_bg`, `icon_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `card_radius` | ✅ 4+ variations: `layout="split-form|card-overlay|centered-stack|minimal-list"`, form/contact info optional | Contact info integration, photo uploads, custom fields | Full form submission; contact details display optional |
| 15 | **BlogIndexBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="editorial-list|minimal-list|card-grid|magazine"` | Category/date display, featured post (magazine), responsive grid | Pull from site.blog_posts; editorial or grid |
| 16 | **ProjectShowcaseBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `border_color`, `heading_color`, `body_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="featured-split|card-grid|masonry-cards|compact-list"` | Project stats, location badges, CTA per project | Portfolio showcase with before/after; split layout dominant |
| 17 | **BrandsBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `text_color`, `heading_color`, `border_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="logo-cloud|split-grid|minimal-list|numbered-tiles"` | Logo grayscale filter, numbered badges | "Trusted By" section; logo grids |
| 18 | **WhyChooseUsBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `text_color`, `body_color`, `heading_color`, `border_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="icon-circle|split-list|minimal-cards|numbered-steps"` | Dark theme default (#1c2942), CTA support, icon circles | Dark section; circular icon badges |
| 19 | **AccreditationsBlock** | ✅ FULL: `accent_color`, `section_bg`, `card_bg`, `background_color`, `text_color`, `body_color`, `heading_color`, `border_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="logo-row|card-grid|minimal-list|numbered-cards"` | Badge logo/name, reg. numbers, descriptions, show_heading toggle | Badges/logos with metadata |
| 20 | **AreasBlock** | ✅ FULL: `accent_color`, `section_bg`, `outer_background`, `background_color`, `card_bg`, `border_color`, `heading_color`, `body_color`, `chip_bg`, `chip_text_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 3 variations: `layout="pill-cloud|card-grid|minimal-list"` (pill=default) | Postcode checker integration, coverage API check, CTA, service area display | Complex; postcode checker, coverage API, dark mode support |
| 21 | **StickyMobileCtaBlock** | ✅ FULL: `background_color`, `text_color`, `primary_color`, `secondary_color`, `border_color`, `heading_color`, `body_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `button_size`, `bar_radius`, `button_radius` | ✅ 4 variations: `layout="dual-pill|single-primary|split-label|stacked-copy"` | Enabled toggle, primary+secondary labels/hrefs, mobile-only display (hidden ≥768px), safe area inset support | Fixed mobile footer; responsive hide; safe-area support |
| 22 | **BlogPostBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="classic-article|split-aside|hero-lead|minimal-prose"` | Category display, publish date, excerpt, CTA, sanitized HTML body | Single blog post display; split aside/hero/minimal prose |
| 23 | **OnlineBookingBlock** | ✅ FULL: `accent_color`, `section_bg`, `card_bg`, `border_color`, `heading_color`, `body_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`, `button_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 3 variations: `layout="centered-card|split-shell|minimal-panel|glass-card"` | 5-step booking flow (service→details→slots→contact→confirm), complex job detection, postcode lookup, address validation, parking/appliance/urgency options | Full booking widget; multi-step form; address lookup |
| 24 | **LegalContentBlock** | ✅ FULL: `accent_color`, `section_bg`, `background_color`, `card_bg`, `border_color`, `heading_color`, `text_color`, `body_color`, `muted_text_color`; Fonts: `heading_font_family`, `global_heading_font_family`, `body_font_family`, `global_body_font_family`; Sizes: `heading_size`, `body_size`, `card_radius` | ✅ 4 variations: `layout="classic-doc|split-aside|minimal-prose|boxed-note"` | Sanitized HTML body, label/eyebrow, sticky sidebar (split-aside) | Privacy/terms pages; split aside with nav |
| 25 | **AmazonBlock** | ⚠️ MINIMAL: Uses Tailwind classes for styling; minimal customization (title, description, layout); no prop-based color/font control | ⚠️ 2 variations: `layout="grid|carousel"` | `columns` (limited), `affiliate_id`, `showDisclosure`, `disclosureText` | Amazon affiliate product cards; Tailwind-based; less flexible than others |

---

## Customization Patterns

### Color Props (Accepted Across Blocks)
All blocks support these color properties:
- **Primary Brand:** `accent_color`, `primary_color`, `secondary_color`
- **Backgrounds:** `section_bg`, `background_color`, `card_bg`, `outer_background`, `muted_background_color`
- **Text:** `text_color`, `heading_color`, `body_color`, `muted_text_color`, `eyebrow_color`, `subheading_color`
- **UI Elements:** `border_color`, `badge_bg`, `badge_text_color`, `icon_bg`, `icon_color`, `star_color`
- **Buttons:** `primary_button_bg_color`, `primary_button_text_color`, `secondary_button_bg_color`, `secondary_button_text_color`

### Font Props (Consistent Across Blocks)
- `heading_font_family` → `global_heading_font_family` (fallback)
- `body_font_family` → `global_body_font_family` (fallback)
- `button_font_family` → `global_button_font_family` (fallback)
- `heading_font_size`, `body_font_size`, `heading_font_weight`, `subheading_font_weight`
- Uses `clamp()` for responsive sizing: `"clamp(1.75rem, 3vw, 2.25rem)"`

### Layout Customization Props (Universal)
- `layout_variant` or `layout` (string, lowercase)
- `padding_y`, `padding_x` (section padding)
- `max_width` (content wrapper)
- `card_radius` (border radius)
- `columns` (where applicable: 2-4 for grids)

### Variant Detection
- **Modern Template Detection:** `isModernTemplateContent(content)` used in TextBlock, ProcessBlock, ContactFormBlock, AreasBlock
- **Feature Flags:** `show_heading`, `enabled`, `require_postcode`, `show_price`

---

## Variation Counts by Block Type

| Variation Count | Block Count | Examples |
|---|---|---|
| **4 layouts** | 19 blocks | HeroBlock, ServicesBlock, ProcessBlock, TestimonialsBlock, FeatureCardsBlock, FaqBlock, GalleryBlock, CtaBlock, ImageBlock, FeaturesBarBlock, ContactFormBlock (4+), BlogIndexBlock, ProjectShowcaseBlock, BrandsBlock, WhyChooseUsBlock, AccreditationsBlock, StickyMobileCtaBlock, BlogPostBlock, LegalContentBlock |
| **3 layouts** | 2 blocks | AreasBlock, OnlineBookingBlock |
| **2 layouts** | 2 blocks | TextBlock, AmazonBlock |
| **1 layout** | 1 block | DetailSectionBlock |
| **No variants** | 1 block | SpacerBlock (4 visual modes, not layout props) |

**Total: 25 blocks**

---

## Dark Mode & Theme Detection

Several blocks support smart theme detection:
- **ProcessBlock:** Detects modern template; defaults to dark bg (#020617) or light (#ffffff)
- **CtaBlock:** Uses template payload to set default background color
- **AreasBlock:** Detects dark card backgrounds; adjusts heading/body colors accordingly
- **ContactFormBlock:** Detects modern template for styling defaults

Pattern: `const headingColor = String(content.heading_color || (cardBg.startsWith("#0") || cardBg.startsWith("#1") ? "#ffffff" : "#111827"));`

---

## Font Configuration Recommendations

### Responsive Sizing Strategy
Blocks use CSS `clamp()` for fluid typography:
```
heading_size: "clamp(1.75rem, 3vw, 2.25rem)"
body_size: "0.9375rem" or "1rem"
```

### Font Family Inheritance
- **Block-level:** `content.heading_font_family` (specific to block)
- **Global override:** `content.global_heading_font_family` (sitewide default)
- **Fallback:** `"inherit"` (uses browser/CSS defaults)

Example from ServicesBlock:
```typescript
const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
```

---

## Accessibility & Semantic Markup

- **Schema.org Support:** ServicesBlock (ItemList), FaqBlock (FAQPage), TestimonialsBlock (supports review sources)
- **Semantic HTML:** `<article>`, `<footer>`, `<blockquote>`, `<time>`, `<details>`, `<summary>`
- **ARIA Labels:** `role="region"` on StickyMobileCtaBlock
- **Form Accessibility:** ContactFormBlock supports custom fields, labels, required flags

---

## Gaps & Limitations

| Block | Limitation | Impact |
|---|---|---|
| **TextBlock** | No full font customization in legacy mode | Legacy templates limited to theme colors only |
| **SpacerBlock** | No layout prop system; uses string enums | Cannot mix variants in grid layouts |
| **AmazonBlock** | Tailwind-based; no prop-driven theming | Difficult to match site color scheme |
| **DetailSectionBlock** | Single split layout; image always right | Limited layout flexibility |
| **ImageBlock** | No CSS filters/effects props | Cannot adjust image brightness/saturation |

---

## Recommended Usage

### For White-Label/Multi-Tenant
Prioritize blocks with **4+ layout variations + full color/font control:**
- ✅ Best: HeroBlock, ServicesBlock, ProcessBlock, FeatureCardsBlock, TestimonialsBlock, FaqBlock
- ✅ Good: CtaBlock, GalleryBlock, ContactFormBlock, BlogIndexBlock, ProjectShowcaseBlock

### For Pre-Built Templates
Use blocks with **smart defaults + dark mode detection:**
- AreasBlock (postcode integration)
- ProcessBlock (step visualization)
- WhyChooseUsBlock (dark theme native)
- StickyMobileCtaBlock (mobile optimization)

### For Content Pages
- TextBlock (semantic, sanitized HTML)
- BlogPostBlock (with metadata)
- LegalContentBlock (structured prose)

---

## Implementation Checklist

- [x] All 25 blocks analyzed
- [x] Color customization mapped (23/25 full support, 1/25 partial, 1/25 minimal)
- [x] Font customization mapped (24/25 full, 1/25 minimal)
- [x] Layout variations counted (19/25 have 4+ layouts)
- [x] Configuration options documented
- [x] Dark mode & theme detection noted
- [x] Schema.org & accessibility marked
- [x] Gaps identified for future enhancement
