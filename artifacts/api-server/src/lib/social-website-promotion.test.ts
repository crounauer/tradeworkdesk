import test from "node:test";
import assert from "node:assert/strict";

import { buildUtmTaggedUrl } from "./social-website-promotion";

test("buildUtmTaggedUrl appends expected UTM parameters", () => {
  const result = buildUtmTaggedUrl("https://example.com/services", {
    source: "facebook",
    medium: "social",
    campaign: "website_promotion-platform-20260722",
    content: "hero-banner",
  });

  const parsed = new URL(result);
  assert.equal(parsed.origin + parsed.pathname, "https://example.com/services");
  assert.equal(parsed.searchParams.get("utm_source"), "facebook");
  assert.equal(parsed.searchParams.get("utm_medium"), "social");
  assert.equal(parsed.searchParams.get("utm_campaign"), "website_promotion-platform-20260722");
  assert.equal(parsed.searchParams.get("utm_content"), "hero-banner");
});

test("buildUtmTaggedUrl preserves existing query parameters", () => {
  const result = buildUtmTaggedUrl("https://example.com/services?ref=nav", {
    source: "facebook",
    medium: "social",
    campaign: "campaign-1",
    content: null,
  });

  const parsed = new URL(result);
  assert.equal(parsed.searchParams.get("ref"), "nav");
  assert.equal(parsed.searchParams.get("utm_source"), "facebook");
  assert.equal(parsed.searchParams.get("utm_medium"), "social");
  assert.equal(parsed.searchParams.get("utm_campaign"), "campaign-1");
  assert.equal(parsed.searchParams.get("utm_content"), null);
});

test("buildUtmTaggedUrl does not write blank UTM values", () => {
  const result = buildUtmTaggedUrl("https://example.com/", {
    source: "",
    medium: " ",
    campaign: "campaign-2",
    content: undefined,
  });

  const parsed = new URL(result);
  assert.equal(parsed.searchParams.get("utm_source"), null);
  assert.equal(parsed.searchParams.get("utm_medium"), null);
  assert.equal(parsed.searchParams.get("utm_campaign"), "campaign-2");
  assert.equal(parsed.searchParams.get("utm_content"), null);
});
