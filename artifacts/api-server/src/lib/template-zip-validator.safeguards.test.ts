import { strict as assert } from "assert";
import { test } from "node:test";
import JSZip from "jszip";
import { validateTemplateZip } from "./template-zip-validator";

async function buildCanonicalZip(opts?: { wrapperFolder?: string; legacyAliases?: boolean; missingTemplateJson?: boolean }) {
  const zip = new JSZip();
  const root = opts?.wrapperFolder ? `${opts.wrapperFolder}/` : "";
  const slug = "classic-trade-template";

  const add = (filePath: string, content: string) => zip.file(`${root}${filePath}`, content);

  add("README.md", "# Template Package");
  add("registry/block-registry.json", JSON.stringify({ blocks: [{ type: "hero", label: "Hero" }, { type: "cta", label: "CTA" }, { type: "text", label: "Text" }] }, null, 2));
  add("scripts/validate-template.ts", "export {};");
  add("supabase/seed-template-example.sql", "select 1;");

  if (!opts?.missingTemplateJson) {
    add(`templates/${slug}/template.json`, JSON.stringify({ slug, name: "Classic Trade Template", version: 1 }, null, 2));
  }

  add(`templates/${slug}/pages/pages.json`, JSON.stringify({ pages: ["home.json", "about.json", opts?.legacyAliases ? "areas.json" : "areas-covered.json"] }, null, 2));
  add(`templates/${slug}/pages/home.json`, JSON.stringify({ title: "Home", blocks: [{ type: "hero" }] }, null, 2));
  add(`templates/${slug}/pages/about.json`, JSON.stringify({ title: "About", blocks: [{ type: "text" }] }, null, 2));
  add(`templates/${slug}/pages/services.json`, JSON.stringify({ title: "Services", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/service-detail.json`, JSON.stringify({ title: "Service Detail", blocks: [] }, null, 2));
  // Always create the canonical version  
  add(`templates/${slug}/pages/areas-covered.json`, JSON.stringify({ title: "Areas Covered", blocks: [{ type: "text" }] }, null, 2));
  // Also create legacy version if legacy aliases are being tested
  if (opts?.legacyAliases) {
    add(`templates/${slug}/pages/areas.json`, JSON.stringify({ title: "Areas Legacy", blocks: [{ type: "text" }] }, null, 2));
  }
  add(`templates/${slug}/pages/area-detail.json`, JSON.stringify({ title: "Area Detail", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/reviews.json`, JSON.stringify({ title: "Reviews", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/gallery.json`, JSON.stringify({ title: "Gallery", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/faq.json`, JSON.stringify({ title: "FAQ", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/contact.json`, JSON.stringify({ title: "Contact", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/blog-index.json`, JSON.stringify({ title: "Blog", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/blog-post.json`, JSON.stringify({ title: "Blog Post", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/privacy-policy.json`, JSON.stringify({ title: "Privacy", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/cookie-policy.json`, JSON.stringify({ title: "Cookie", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/terms-conditions.json`, JSON.stringify({ title: "Terms", blocks: [] }, null, 2));
  add(`templates/${slug}/pages/404.json`, JSON.stringify({ title: "Not Found", blocks: [] }, null, 2));
  add(`templates/${slug}/styles/theme.json`, JSON.stringify({ colors: { primary: "#111111" } }, null, 2));
  add("templates/classic-trade-template/styles/cms-mapping.json", JSON.stringify({ pages: [] }, null, 2));
  add("source-figma-prototype/README.txt", "prototype");

  return zip.generateAsync({ type: "nodebuffer" });
}

test("valid canonical ZIP", async () => {
  const zip = await buildCanonicalZip();
  const report = await validateTemplateZip(zip);
  assert.equal(report.valid, true);
  assert.equal(report.templateSlug, "classic-trade-template");
  assert.equal(report.templateName, "Classic Trade Template");
  assert.ok(report.pagesFound.includes("home.json"));
  assert.ok(report.blocksFound >= 2);
  assert.equal(report.errors.length, 0);
});

test("ZIP with wrapper folder", async () => {
  const zip = await buildCanonicalZip({ wrapperFolder: "classic-trade-template-package" });
  const report = await validateTemplateZip(zip);
  assert.equal(report.valid, true);
  assert.ok(report.warnings.some((warning) => warning.includes("wrapper folder")));
});

test("missing template.json", async () => {
  const zip = await buildCanonicalZip({ missingTemplateJson: true });
  const report = await validateTemplateZip(zip);
  assert.equal(report.valid, false);
  assert.ok(report.errors.length > 0);
});

test("legacy page filename aliases", async () => {
  const zip = await buildCanonicalZip({ legacyAliases: true });
  const report = await validateTemplateZip(zip);
  assert.equal(report.valid, true);
  assert.ok(report.warnings.some((warning) => warning.includes("Legacy page filename")));
});
