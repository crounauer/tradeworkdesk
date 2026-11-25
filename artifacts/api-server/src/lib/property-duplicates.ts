export interface PropertyIdentity {
  id: string;
  address_line1: string | null;
  postcode: string | null;
  created_at?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

function normalizeAddress(value: string | null | undefined): string {
  return String(value || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePostcode(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, "").toLocaleUpperCase();
}

export function propertiesHaveSameIdentity(left: PropertyIdentity, right: PropertyIdentity): boolean {
  return addressesHaveSameLocation(left, right);
}

export function addressesHaveSameLocation(
  left: Pick<PropertyIdentity, "address_line1" | "postcode">,
  right: Pick<PropertyIdentity, "address_line1" | "postcode">,
): boolean {
  const address = normalizeAddress(left.address_line1);
  const postcode = normalizePostcode(left.postcode);
  return Boolean(
    address &&
    postcode &&
    address === normalizeAddress(right.address_line1) &&
    postcode === normalizePostcode(right.postcode),
  );
}

export function getDuplicatePropertyGroups(
  properties: PropertyIdentity[],
  preferredPropertyIds: ReadonlySet<string> = new Set(),
): PropertyIdentity[][] {
  const groups: PropertyIdentity[][] = [];

  for (const property of properties) {
    const group = groups.find((candidate) => propertiesHaveSameIdentity(candidate[0], property));
    if (group) {
      group.push(property);
    } else {
      groups.push([property]);
    }
  }

  return groups
    .filter((group) => group.length > 1)
    .map((group) => [...group].sort((left, right) => {
      const preferredDelta = Number(preferredPropertyIds.has(right.id)) - Number(preferredPropertyIds.has(left.id));
      if (preferredDelta) return preferredDelta;
      return String(left.created_at || "").localeCompare(String(right.created_at || ""));
    }));
}
