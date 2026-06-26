import { strict as assert } from "assert";
import { test } from "node:test";
import { mergeTemplateBlockContent } from "./template-clone";

test("mergeTemplateBlockContent preserves content when settings are empty", () => {
  const merged = mergeTemplateBlockContent({ title: "Hello" }, {});
  assert.deepEqual(merged, { title: "Hello" });
});

test("mergeTemplateBlockContent embeds settings for tenant block cloning", () => {
  const merged = mergeTemplateBlockContent(
    { title: "Hello" },
    { accent_color: "#111111" },
  );

  assert.deepEqual(merged, {
    title: "Hello",
    settings: { accent_color: "#111111" },
  });
});
