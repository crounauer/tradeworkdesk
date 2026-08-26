import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAppliancePayload } from "./appliance-enum-normalization";

test("normalizeAppliancePayload maps legacy UI values to DB enum values", () => {
  const normalized = normalizeAppliancePayload({
    property_id: "11111111-1111-4111-8111-111111111111",
    boiler_type: "regular",
    fuel_type: "heat_pump",
    system_type: "open_vent",
  });

  assert.equal(normalized.boiler_type, "regular");
  assert.equal(normalized.fuel_type, "other");
  assert.equal(normalized.system_type, "open_vented");
});

test("normalizeAppliancePayload normalizes legacy system types to the supported values", () => {
  const normalized = normalizeAppliancePayload({
    property_id: "11111111-1111-4111-8111-111111111111",
    boiler_type: "combi",
    fuel_type: "gas",
    system_type: "pressurised",
  });

  assert.equal(normalized.boiler_type, "combi");
  assert.equal(normalized.fuel_type, "gas");
  assert.equal(normalized.system_type, "sealed");
});

test("normalizeAppliancePayload keeps valid DB enum values unchanged", () => {
  const normalized = normalizeAppliancePayload({
    property_id: "11111111-1111-4111-8111-111111111111",
    boiler_type: "boiler",
    fuel_type: "gas",
    system_type: "sealed",
  });

  assert.equal(normalized.boiler_type, "boiler");
  assert.equal(normalized.fuel_type, "gas");
  assert.equal(normalized.system_type, "sealed");
});
