import { strict as assert } from "assert";
import { test } from "node:test";
import {
  checkDuplicatePageSlugs,
  checkDuplicatePagePaths,
  checkDuplicateBlockIds,
  checkUnregisteredBlockTypes,
  checkSlugMismatch,
  checkEmptyPages,
  checkEmptyBlockRegistry,
  checkOrphanedPageFiles,
  performEnhancedValidation,
  formatEnhancedValidationErrors,
  hasEnhancedValidationErrors,
  type EnhancedValidationErrors,
} from "./template-validation-enhanced";

// Test helpers
function mockPage(
  slug: string,
  path: string,
  blocks: Array<{ id?: string; type?: string; block_type?: string }> = [],
) {
  return {
    slug,
    path,
    title: slug.replace(/-/g, " "),
    blocks,
  };
}

test("checkDuplicatePageSlugs detects duplicate slugs", () => {
  const pages = [
    mockPage("home", "home.json"),
    mockPage("about", "about.json"),
    mockPage("home", "home-alt.json"), // duplicate slug
  ];

  const duplicates = checkDuplicatePageSlugs(pages);
  assert.deepEqual(duplicates, ["home"]);
});

test("checkDuplicatePageSlugs returns empty array when no duplicates", () => {
  const pages = [
    mockPage("home", "home.json"),
    mockPage("about", "about.json"),
    mockPage("services", "services.json"),
  ];

  const duplicates = checkDuplicatePageSlugs(pages);
  assert.deepEqual(duplicates, []);
});

test("checkDuplicatePagePaths detects duplicate paths", () => {
  const pages = [
    mockPage("home", "pages/home.json"),
    mockPage("about", "pages/about.json"),
    mockPage("home-alt", "pages/home.json"), // duplicate path
  ];

  const duplicates = checkDuplicatePagePaths(pages);
  assert.deepEqual(duplicates, ["pages/home.json"]);
});

test("checkDuplicatePagePaths returns empty array when no duplicates", () => {
  const pages = [
    mockPage("home", "pages/home.json"),
    mockPage("about", "pages/about.json"),
  ];

  const duplicates = checkDuplicatePagePaths(pages);
  assert.deepEqual(duplicates, []);
});

test("checkDuplicateBlockIds detects duplicate block IDs within a page", () => {
  const pages = [
    mockPage("home", "home.json", [
      { id: "block-1", type: "hero" },
      { id: "block-2", type: "cta" },
      { id: "block-1", type: "footer" }, // duplicate ID
    ]),
  ];

  const duplicates = checkDuplicateBlockIds(pages);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].page, "home");
  assert.deepEqual(duplicates[0].blockIds, ["block-1"]);
});

test("checkDuplicateBlockIds ignores pages without IDs", () => {
  const pages = [
    mockPage("home", "home.json", [
      { type: "hero" }, // no ID
      { type: "cta" }, // no ID
    ]),
  ];

  const duplicates = checkDuplicateBlockIds(pages);
  assert.equal(duplicates.length, 0);
});

test("checkDuplicateBlockIds returns empty when no duplicates", () => {
  const pages = [
    mockPage("home", "home.json", [
      { id: "block-1", type: "hero" },
      { id: "block-2", type: "cta" },
    ]),
  ];

  const duplicates = checkDuplicateBlockIds(pages);
  assert.deepEqual(duplicates, []);
});

test("checkUnregisteredBlockTypes detects block types not in registry", () => {
  const pages = [
    mockPage("home", "home.json", [
      { type: "hero" },
      { type: "custom_block" }, // not in registry
    ]),
  ];

  const registry = new Set(["hero", "cta", "footer"]);
  const unregistered = checkUnregisteredBlockTypes(pages, registry);
  assert.deepEqual(unregistered, ["custom_block"]);
});

test("checkUnregisteredBlockTypes handles block_type field", () => {
  const pages = [
    mockPage("home", "home.json", [
      { block_type: "hero" },
      { block_type: "unknown_type" }, // not in registry
    ]),
  ];

  const registry = new Set(["hero", "cta"]);
  const unregistered = checkUnregisteredBlockTypes(pages, registry);
  assert.deepEqual(unregistered, ["unknown_type"]);
});

test("checkUnregisteredBlockTypes returns empty array when all types in registry", () => {
  const pages = [
    mockPage("home", "home.json", [
      { type: "hero" },
      { type: "cta" },
    ]),
  ];

  const registry = new Set(["hero", "cta", "footer"]);
  const unregistered = checkUnregisteredBlockTypes(pages, registry);
  assert.deepEqual(unregistered, []);
});

test("checkSlugMismatch detects slug mismatch", () => {
  const mismatch = checkSlugMismatch("my-template", "different-slug");
  assert.deepEqual(mismatch, { folder: "my-template", file: "different-slug" });
});

test("checkSlugMismatch handles case-insensitive comparison", () => {
  const mismatch = checkSlugMismatch("My-Template", "my-template");
  assert.equal(mismatch, null);
});

test("checkSlugMismatch returns null when slugs match", () => {
  const mismatch = checkSlugMismatch("my-template", "my-template");
  assert.equal(mismatch, null);
});

test("checkEmptyPages detects pages with no blocks", () => {
  const pages = [
    mockPage("home", "home.json", [{ type: "hero" }]),
    mockPage("about", "about.json", []), // empty
    mockPage("services", "services.json", []), // empty
  ];

  const empty = checkEmptyPages(pages);
  assert.deepEqual(empty, ["about", "services"]);
});

test("checkEmptyPages returns empty array when all pages have blocks", () => {
  const pages = [
    mockPage("home", "home.json", [{ type: "hero" }]),
    mockPage("about", "about.json", [{ type: "text" }]),
  ];

  const empty = checkEmptyPages(pages);
  assert.deepEqual(empty, []);
});

test("checkEmptyBlockRegistry detects empty registry", () => {
  const registry = new Set<string>();
  const isEmpty = checkEmptyBlockRegistry(registry);
  assert.equal(isEmpty, true);
});

test("checkEmptyBlockRegistry returns false when registry has blocks", () => {
  const registry = new Set(["hero", "cta", "footer"]);
  const isEmpty = checkEmptyBlockRegistry(registry);
  assert.equal(isEmpty, false);
});

test("checkOrphanedPageFiles detects page files not in pages.json", () => {
  const listed = new Set(["home.json", "about.json"]);
  const inZip = new Set(["home.json", "about.json", "services.json", "contact.json"]);

  const orphaned = checkOrphanedPageFiles(listed, inZip);
  assert.deepEqual(orphaned, ["contact.json", "services.json"]);
});

test("checkOrphanedPageFiles returns empty when all files are listed", () => {
  const listed = new Set(["home.json", "about.json", "services.json"]);
  const inZip = new Set(["home.json", "about.json", "services.json"]);

  const orphaned = checkOrphanedPageFiles(listed, inZip);
  assert.deepEqual(orphaned, []);
});

test("performEnhancedValidation combines all checks", () => {
  const pages = [
    mockPage("home", "home.json", [
      { id: "block-1", type: "hero" },
      { id: "block-1", type: "footer" }, // duplicate ID
    ]),
    mockPage("about", "about.json", []), // empty page
  ];

  const result = performEnhancedValidation({
    pages,
    registryBlockTypes: new Set(["hero", "cta"]),
    folderSlug: "my-template",
    fileSlug: "different-slug", // mismatch
    listedPageFiles: new Set(["home.json"]),
    zipPageFiles: new Set(["home.json", "about.json", "contact.json"]),
  });

  assert.deepEqual(result.duplicateBlockIds, [{ page: "home", blockIds: ["block-1"] }]);
  assert.deepEqual(result.emptyPages, ["about"]);
  assert.deepEqual(result.slugMismatch, { folder: "my-template", file: "different-slug" });
  assert.deepEqual(result.unregisteredBlockTypes, ["footer"]);
  assert.deepEqual(result.orphanedPageFiles, ["about.json", "contact.json"]);
});

test("formatEnhancedValidationErrors generates human-readable messages", () => {
  const errors: EnhancedValidationErrors = {
    duplicatePageSlugs: ["home"],
    duplicatePagePaths: [],
    duplicateBlockIds: [{ page: "home", blockIds: ["block-1", "block-2"] }],
    unregisteredBlockTypes: ["custom_type"],
    slugMismatch: { folder: "template-1", file: "template-2" },
    emptyPages: ["about"],
    emptyBlockRegistry: false,
    orphanedPageFiles: ["orphan.json"],
  };

  const messages = formatEnhancedValidationErrors(errors);

  assert.equal(messages.some((m) => m.includes("Duplicate page slugs")), true);
  assert.equal(messages.some((m) => m.includes("duplicate block IDs")), true);
  assert.equal(messages.some((m) => m.includes("Block types not in registry")), true);
  assert.equal(messages.some((m) => m.includes("Template slug mismatch")), true);
  assert.equal(messages.some((m) => m.includes("Empty pages")), true);
  assert.equal(messages.some((m) => m.includes("Orphaned page files")), true);
});

test("formatEnhancedValidationErrors includes empty block registry error", () => {
  const errors: EnhancedValidationErrors = {
    duplicatePageSlugs: [],
    duplicatePagePaths: [],
    duplicateBlockIds: [],
    unregisteredBlockTypes: [],
    slugMismatch: null,
    emptyPages: [],
    emptyBlockRegistry: true,
    orphanedPageFiles: [],
  };

  const messages = formatEnhancedValidationErrors(errors);
  assert.equal(messages.some((m) => m.includes("Block registry is empty")), true);
});

test("hasEnhancedValidationErrors detects errors", () => {
  const errors: EnhancedValidationErrors = {
    duplicatePageSlugs: ["home"],
    duplicatePagePaths: [],
    duplicateBlockIds: [],
    unregisteredBlockTypes: [],
    slugMismatch: null,
    emptyPages: [],
    emptyBlockRegistry: false,
    orphanedPageFiles: ["orphan.json"], // not considered an error
  };

  assert.equal(hasEnhancedValidationErrors(errors), true);
});

test("hasEnhancedValidationErrors ignores orphaned files", () => {
  const errors: EnhancedValidationErrors = {
    duplicatePageSlugs: [],
    duplicatePagePaths: [],
    duplicateBlockIds: [],
    unregisteredBlockTypes: [],
    slugMismatch: null,
    emptyPages: [],
    emptyBlockRegistry: false,
    orphanedPageFiles: ["orphan.json"], // warnings, not errors
  };

  assert.equal(hasEnhancedValidationErrors(errors), false);
});

test("hasEnhancedValidationErrors detects empty block registry as error", () => {
  const errors: EnhancedValidationErrors = {
    duplicatePageSlugs: [],
    duplicatePagePaths: [],
    duplicateBlockIds: [],
    unregisteredBlockTypes: [],
    slugMismatch: null,
    emptyPages: [],
    emptyBlockRegistry: true,
    orphanedPageFiles: [],
  };

  assert.equal(hasEnhancedValidationErrors(errors), true);
});
