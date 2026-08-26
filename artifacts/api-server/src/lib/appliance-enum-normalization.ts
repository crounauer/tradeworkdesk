const BOILER_TYPE_MAP: Record<string, string> = {
  boiler: "boiler",
  heat_pump: "heat_pump",
  stove: "stove",
  fire: "fire",
  cooker: "other",
  water_heater: "water_heater",
  cylinder: "water_heater",
  combi: "combi",
  system: "system",
  regular: "regular",
  back_boiler: "back_boiler",
  other: "other",
};

const FUEL_TYPE_MAP: Record<string, string> = {
  gas: "gas",
  oil: "oil",
  lpg: "lpg",
  electric: "electric",
  biomass: "other",
  solid_fuel: "solid_fuel",
  heat_pump: "other",
  other: "other",
};

const SYSTEM_TYPE_MAP: Record<string, string> = {
  combi: "sealed",
  system: "sealed",
  conventional: "sealed",
  open_vent: "open_vented",
  sealed: "sealed",
  direct: "sealed",
  indirect: "sealed",
  open_vented: "open_vented",
  gravity_fed: "sealed",
  pressurised: "sealed",
  other: "other",
};

export function normalizeAppliancePayload<T extends Record<string, unknown>>(payload: T): T {
  const normalized = { ...payload } as Record<string, unknown>;

  if (typeof normalized.boiler_type === "string") {
    normalized.boiler_type = BOILER_TYPE_MAP[normalized.boiler_type] ?? normalized.boiler_type;
  }

  if (typeof normalized.fuel_type === "string") {
    normalized.fuel_type = FUEL_TYPE_MAP[normalized.fuel_type] ?? normalized.fuel_type;
  }

  if (typeof normalized.system_type === "string") {
    normalized.system_type = SYSTEM_TYPE_MAP[normalized.system_type] ?? normalized.system_type;
  }

  return normalized as T;
}
