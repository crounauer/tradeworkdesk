#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const templateDir = path.join(root, "artifacts/business-app/src/twd/templates");
const editorPath = path.join(root, "artifacts/business-app/src/pages/website-page-editor.tsx");

const rendererMap = {
  cta: "artifacts/website-renderer/src/components/blocks/CtaBlock.tsx",
  services: "artifacts/website-renderer/src/components/blocks/ServicesBlock.tsx",
  testimonials: "artifacts/website-renderer/src/components/blocks/TestimonialsBlock.tsx",
  areas: "artifacts/website-renderer/src/components/blocks/AreasBlock.tsx",
  faq: "artifacts/website-renderer/src/components/blocks/FaqBlock.tsx",
  process: "artifacts/website-renderer/src/components/blocks/ProcessBlock.tsx",
  project_showcase: "artifacts/website-renderer/src/components/blocks/ProjectShowcaseBlock.tsx",
  gallery: "artifacts/website-renderer/src/components/blocks/GalleryBlock.tsx",
  feature_cards: "artifacts/website-renderer/src/components/blocks/FeatureCardsBlock.tsx",
  blog_index: "artifacts/website-renderer/src/components/blocks/BlogIndexBlock.tsx",
  blog_post: "artifacts/website-renderer/src/components/blocks/BlogPostBlock.tsx",
  legal_content: "artifacts/website-renderer/src/components/blocks/LegalContentBlock.tsx",
  sticky_mobile_cta: "artifacts/website-renderer/src/components/blocks/StickyMobileCtaBlock.tsx",
};

function getTemplateFiles() {
  return fs
    .readdirSync(templateDir)
    .filter((name) => /Trade\.pages\.ts$/.test(name))
    .map((name) => path.join(templateDir, name));
}

function extractByTypeObject(text) {
  const marker = "const byType: Record<string, Record<string, unknown>> = {";
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return "";

  const start = text.indexOf("{", markerIndex);
  if (start < 0) return "";

  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }

  return "";
}

function collectTemplateVariants() {
  const variantsByBlock = new Map();
  const files = getTemplateFiles();

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const byTypeBody = extractByTypeObject(source);
    const entryRe = /^\s{8}(["a-zA-Z0-9_.]+):\s*\{([\s\S]*?)^\s{8}\},/gm;

    let match;
    while ((match = entryRe.exec(byTypeBody))) {
      const block = match[1].replace(/^"|"$/g, "");
      const entryBody = match[2];
      const variantMatch = entryBody.match(/layout_variant\s*:\s*\[([^\]]+)\]\[slot\]/);
      if (!variantMatch) continue;

      const values = variantMatch[1]
        .split(",")
        .map((value) => value.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);

      if (!variantsByBlock.has(block)) {
        variantsByBlock.set(block, new Set());
      }

      const bucket = variantsByBlock.get(block);
      for (const value of values) {
        bucket.add(value);
      }
    }
  }

  return variantsByBlock;
}

function checkRendererCoverage(variantsByBlock) {
  const failures = [];

  for (const [block, variants] of [...variantsByBlock.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (block === "site.footer") continue;

    const relPath = rendererMap[block];
    if (!relPath) {
      failures.push(`Renderer mapping missing for block '${block}'`);
      continue;
    }

    const filePath = path.join(root, relPath);
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    const missing = [...variants].filter((variant) => !source.includes(variant.toLowerCase()));

    if (missing.length > 0) {
      failures.push(
        `Renderer ${relPath} missing variants for '${block}': ${missing.sort().join(", ")}`,
      );
    }
  }

  return failures;
}

function checkEditorCoverage(variantsByBlock) {
  const source = fs.readFileSync(editorPath, "utf8").toLowerCase();
  const failures = [];

  for (const [block, variants] of [...variantsByBlock.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (block === "site.footer") continue;

    const marker = `case "${block}"`;
    const start = source.indexOf(marker);
    if (start < 0) {
      failures.push(`Editor case missing for block '${block}'`);
      continue;
    }

    const nextCase = source.indexOf("\n    case \"", start + marker.length);
    const chunk = source.slice(start, nextCase > -1 ? nextCase : undefined);
    const missing = [...variants].filter((variant) => !chunk.includes(variant.toLowerCase()));

    if (missing.length > 0) {
      failures.push(
        `Editor case '${block}' missing variants: ${missing.sort().join(", ")}`,
      );
    }
  }

  return failures;
}

function printMatrix(variantsByBlock) {
  console.log("Layout variant matrix extracted from six template files:");
  for (const [block, variants] of [...variantsByBlock.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`- ${block}: ${[...variants].sort().join(", ")}`);
  }
}

function main() {
  const variantsByBlock = collectTemplateVariants();
  printMatrix(variantsByBlock);

  const rendererFailures = checkRendererCoverage(variantsByBlock);
  const editorFailures = checkEditorCoverage(variantsByBlock);

  if (rendererFailures.length === 0 && editorFailures.length === 0) {
    console.log("\nPASS: All template-declared layout variants are covered in renderer and editor paths.");
    process.exit(0);
  }

  console.error("\nFAIL: Missing layout variant coverage detected.");
  for (const failure of [...rendererFailures, ...editorFailures]) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

main();
