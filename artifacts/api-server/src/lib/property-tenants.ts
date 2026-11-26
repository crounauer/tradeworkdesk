export interface PropertyTenantContact {
  name?: string;
  email?: string;
  phone?: string;
}

export function getPropertyTenantContacts(property: {
  tenant_contacts?: unknown;
  tenant_name?: string | null;
  tenant_email?: string | null;
  tenant_phone?: string | null;
}): PropertyTenantContact[] {
  const contacts: PropertyTenantContact[] = [];
  if (Array.isArray(property.tenant_contacts)) {
    for (const value of property.tenant_contacts) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const contact = {
        name: typeof row.name === "string" ? row.name.trim() : "",
        email: typeof row.email === "string" ? row.email.trim() : "",
        phone: typeof row.phone === "string" ? row.phone.trim() : "",
      };
      if (contact.name || contact.email || contact.phone) contacts.push(contact);
    }
  }
  const legacy = {
    name: String(property.tenant_name || "").trim(),
    email: String(property.tenant_email || "").trim(),
    phone: String(property.tenant_phone || "").trim(),
  };
  if (legacy.name || legacy.email || legacy.phone) {
    const duplicate = contacts.some((contact) =>
      (legacy.email && contact.email?.toLowerCase() === legacy.email.toLowerCase()) ||
      (legacy.phone && contact.phone === legacy.phone),
    );
    if (!duplicate) contacts.unshift(legacy);
  }
  return contacts;
}
