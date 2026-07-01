import test from "node:test";
import assert from "node:assert/strict";

import { WEBSITE_DELETE_TABLE_ORDER, retainsMediaLibraryOnWebsiteDelete } from "./website-delete-policy";

test("website delete order excludes website_media to retain media library", () => {
  assert.equal(retainsMediaLibraryOnWebsiteDelete(), true);
  assert.deepEqual(WEBSITE_DELETE_TABLE_ORDER, [
    "website_blocks",
    "website_page_versions",
    "website_pages",
    "website_domains",
    "websites",
  ]);
  assert.equal(WEBSITE_DELETE_TABLE_ORDER.includes("website_media" as never), false);
});
