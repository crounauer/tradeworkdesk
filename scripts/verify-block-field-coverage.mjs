#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const editorPath = path.join(root, "artifacts/business-app/src/pages/website-page-editor.tsx");
const templateDir = path.join(root, "artifacts/business-app/src/twd/templates");

typeCheck();

function typeCheck() {
  const aliasMap = {
    "hero.standard": "hero",
    "about.intro": "text",
    "trust.badges": "accreditations",
    "services.grid": "services",
    "reviews.grid": "testimonials",
    "areas.grid": "areas",
    "gallery.grid": "gallery",
    "cta.banner": "cta",
    "contact.split": "contact",
    "faq.accordion": "faq",
    "process.steps": "process",
    "features.list": "feature_cards",
    "blog.index": "blog_index",
    "blog.post": "blog_post",
    "legal.content": "legal_content",
    "system.notfound": "text",
  };

  const checks = [
    {
      block: "hero",
      rendererPath: "artifacts/website-renderer/src/components/blocks/HeroBlock.tsx",
      required: ["heading", "subheading", ["cta_text", "primaryctalabel", "primarybuttontext"], ["cta_url", "primaryctahref", "primarybuttonurl"]],
    },
    {
      block: "text",
      rendererPath: "artifacts/website-renderer/src/components/blocks/TextBlock.tsx",
      required: [["heading", "title"], ["html", "body", "text"]],
    },
    {
      block: "cta",
      rendererPath: "artifacts/website-renderer/src/components/blocks/CtaBlock.tsx",
      required: ["heading", "subheading", "cta_text", "cta_url", "secondary_cta_text", "secondary_cta_url"],
    },
    {
      block: "services",
      rendererPath: "artifacts/website-renderer/src/components/blocks/ServicesBlock.tsx",
      required: ["title", "description", "icon", "cta_text", "cta_url"],
    },
    {
      block: "contact",
      rendererPath: "artifacts/website-renderer/src/components/blocks/ContactFormBlock.tsx",
      required: ["phone", "email", "address"],
    },
    {
      block: "testimonials",
      rendererPath: "artifacts/website-renderer/src/components/blocks/TestimonialsBlock.tsx",
      required: [["author", "author_name", "name"], ["quote", "body", "text"], "location"],
    },
    {
      block: "contact_form",
      rendererPath: "artifacts/website-renderer/src/components/blocks/ContactFormBlock.tsx",
      required: [["heading", "title"], ["subheading", "subtitle"]],
    },
    {
      block: "gallery",
      rendererPath: "artifacts/website-renderer/src/components/blocks/GalleryBlock.tsx",
      required: [["heading", "title"], ["subheading", "subtitle"], "layout_variant"],
    },
    {
      block: "blog_index",
      rendererPath: "artifacts/website-renderer/src/components/blocks/BlogIndexBlock.tsx",
      required: [["heading", "title"], ["excerpt", "description", "summary"]],
    },
    {
      block: "blog_post",
      rendererPath: "artifacts/website-renderer/src/components/blocks/BlogPostBlock.tsx",
      required: [["heading", "title"], ["html", "body", "content"]],
    },
    {
      block: "accreditations",
      rendererPath: "artifacts/website-renderer/src/components/blocks/AccreditationsBlock.tsx",
      required: [["name", "title"], "logo_url"],
    },
    {
      block: "brands",
      rendererPath: "artifacts/website-renderer/src/components/blocks/BrandsBlock.tsx",
      required: [["name", "title"], "logo_url"],
    },
    {
      block: "why_choose_us",
      rendererPath: "artifacts/website-renderer/src/components/blocks/WhyChooseUsBlock.tsx",
      required: ["title", "description", "icon"],
    },
    {
      block: "feature_cards",
      rendererPath: "artifacts/website-renderer/src/components/blocks/FeatureCardsBlock.tsx",
      required: ["title", "description", "icon", "cta_text", "cta_url"],
      branchCount: { token: "cta_text", minRenderer: 4, minEditor: 4 },
    },
    {
      block: "image",
      rendererPath: "artifacts/website-renderer/src/components/blocks/ImageBlock.tsx",
      required: ["image_url", "alt_text", "caption"],
    },
    {
      block: "spacer",
      rendererPath: "artifacts/website-renderer/src/components/blocks/SpacerBlock.tsx",
      required: ["height"],
    },
    {
      block: "features_bar",
      rendererPath: "artifacts/website-renderer/src/components/blocks/FeaturesBarBlock.tsx",
      required: ["title", "description", "icon"],
    },
    {
      block: "faq",
      rendererPath: "artifacts/website-renderer/src/components/blocks/FaqBlock.tsx",
      required: ["question", "answer"],
    },
    {
      block: "process",
      rendererPath: "artifacts/website-renderer/src/components/blocks/ProcessBlock.tsx",
      required: ["title", "description", ["step_number", "number"]],
    },
    {
      block: "areas",
      rendererPath: "artifacts/website-renderer/src/components/blocks/AreasBlock.tsx",
      required: [["name", "area", "title"], ["description", "body_text"], "cta_text", "cta_url"],
    },
    {
      block: "project_showcase",
      rendererPath: "artifacts/website-renderer/src/components/blocks/ProjectShowcaseBlock.tsx",
      required: ["title", "description", "image_url", "cta_text", "cta_url"],
    },
    {
      block: "online_booking",
      rendererPath: "artifacts/website-renderer/src/components/blocks/OnlineBookingBlock.tsx",
      required: ["show_price", "require_postcode", "require_description"],
    },
    {
      block: "legal_content",
      rendererPath: "artifacts/website-renderer/src/components/blocks/LegalContentBlock.tsx",
      required: [["html", "body", "content"]],
    },
    {
      block: "sticky_mobile_cta",
      rendererPath: "artifacts/website-renderer/src/components/blocks/StickyMobileCtaBlock.tsx",
      required: [["primary_label", "primary_text"], ["primary_href", "primary_url"], ["secondary_label", "secondary_text"], ["secondary_href", "secondary_url"]],
    },
    {
      block: "site.footer",
      required: [],
    },
  ];

  const editorSource = fs.readFileSync(editorPath, "utf8").toLowerCase();
  const failures = [];

  // Ensure this verifier covers all normalized block types used by six template files.
  const templateBlocks = collectNormalizedTemplateBlocks(aliasMap);
  const coveredBlocks = new Set(checks.map((check) => check.block));
  const ignored = new Set(["site.header"]);
  for (const block of [...templateBlocks].sort()) {
    if (!coveredBlocks.has(block) && !ignored.has(block)) {
      failures.push(`Verifier missing check definition for template block '${block}'`);
    }
  }

  for (const check of checks) {
    const editorChunk = getCaseChunk(editorSource, check.block).toLowerCase();
    if (!editorChunk) {
      failures.push(`Missing editor case for block '${check.block}'`);
      continue;
    }

    const rendererSource = check.rendererPath
      ? fs.readFileSync(path.join(root, check.rendererPath), "utf8").toLowerCase()
      : "";

    for (const requirement of check.required) {
      const tokens = Array.isArray(requirement) ? requirement : [requirement];
      const rendererHas = tokens.some((token) => rendererSource.includes(token.toLowerCase()));
      const editorHas = tokens.some((token) => editorChunk.includes(token.toLowerCase()));

      if (check.rendererPath && !rendererHas) {
        failures.push(
          `Renderer missing required field (${tokens.join(" | ")}) for block '${check.block}' in ${check.rendererPath}`,
        );
      }
      if (!editorHas) {
        failures.push(`Editor missing required field (${tokens.join(" | ")}) for block '${check.block}'`);
      }
    }

    if (check.branchCount) {
      const token = check.branchCount.token.toLowerCase();
      const rendererHits = check.rendererPath ? (rendererSource.match(new RegExp(token, "g")) || []).length : 0;
      const editorHits = (editorChunk.match(new RegExp(token, "g")) || []).length;

      if (check.rendererPath && rendererHits < check.branchCount.minRenderer) {
        failures.push(`Renderer branch coverage for '${token}' is too low in block '${check.block}' (${rendererHits} < ${check.branchCount.minRenderer})`);
      }
      if (editorHits < check.branchCount.minEditor) {
        failures.push(`Editor branch coverage for '${token}' is too low in block '${check.block}' (${editorHits} < ${check.branchCount.minEditor})`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("FAIL: Missing block field coverage detected.");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`PASS: Block field coverage check succeeded for ${checks.length} blocks across 6 templates.`);
}

function collectNormalizedTemplateBlocks(aliasMap) {
  const files = fs
    .readdirSync(templateDir)
    .filter((name) => /Trade\.pages\.ts$/.test(name))
    .map((name) => path.join(templateDir, name));

  const blocks = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/type:\s*"([^"]+)"/g)) {
      const raw = String(match[1] || "").trim().toLowerCase();
      blocks.add(aliasMap[raw] || raw);
    }
  }
  return blocks;
}

function getCaseChunk(source, block) {
  const marker = `case "${block}"`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const nextCase = source.indexOf("\n    case \"", start + marker.length);
  return source.slice(start, nextCase > -1 ? nextCase : undefined);
}
