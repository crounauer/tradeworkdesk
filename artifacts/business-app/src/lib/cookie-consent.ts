const CONSENT_STORAGE_KEY = "twd_cookie_consent";

export type CookieConsent = "granted" | "denied";

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function setStoredConsent(value: CookieConsent): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
}

export function isMarketingSitePath(path: string): boolean {
  if (path === "/") return true;
  if (/^\/(features|pricing|about|contact|blog|privacy-policy|terms-of-service|customers|industries|alternatives|find)(\/.*)?$/.test(path)) return true;
  if (/^\/(gas-engineer-software|boiler-service-management-software|job-management-software-heating-engineers|oil-engineer-software|heat-pump-engineer-software|plumber-software|landlord-gas-safety-software|sole-trader-software|heating-company-software)$/.test(path)) return true;
  return false;
}
