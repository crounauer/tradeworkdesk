import { strict as assert } from "assert";
import { test } from "node:test";
import { findUnsupportedBlockTypes } from "./template-import-safeguards";

test("findUnsupportedBlockTypes returns unsupported template blocks", () => {
  const unsupported = findUnsupportedBlockTypes(
    [
      { blocks: [{ block_type: "hero" }, { block_type: "cta" }] },
      { blocks: [{ block_type: "unsupported_custom" }] },
    ],
    new Set(["hero", "cta"]),
  );

  assert.deepEqual(unsupported, ["unsupported_custom"]);
});

test("findUnsupportedBlockTypes returns empty when registry is not provided", () => {
  const unsupported = findUnsupportedBlockTypes(
    [{ blocks: [{ block_type: "anything" }] }],
    new Set(),
  );

  assert.deepEqual(unsupported, []);
});
