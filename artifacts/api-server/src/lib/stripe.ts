import Stripe from "stripe";
import { getPlatformSetting } from "./geocode";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set — will try platform_settings on demand");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" })
  : null;

export function requireStripe(): Stripe;
export function requireStripe(required: false): Stripe | null;
export function requireStripe(required = true): Stripe | null {
  if (!stripe && required) throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  return stripe;
}

// Cache for DB-loaded Stripe instance (1 minute TTL)
let _cachedStripe: { instance: Stripe; ts: number } | null = null;
const STRIPE_CACHE_TTL = 60_000;

/**
 * Async version — reads stripe_secret_key from platform_settings (DB) with
 * STRIPE_SECRET_KEY env var as fallback. Use this in request handlers so the
 * super admin can configure the key through the UI.
 */
export async function getStripe(required = true): Promise<Stripe | null> {
  const now = Date.now();
  if (_cachedStripe && now - _cachedStripe.ts < STRIPE_CACHE_TTL) {
    return _cachedStripe.instance;
  }
  const key = await getPlatformSetting("stripe_secret_key", "STRIPE_SECRET_KEY").catch(() => null);
  if (!key) {
    _cachedStripe = null;
    if (required) throw new Error("Stripe is not configured — add stripe_secret_key in Platform Settings");
    return null;
  }
  const instance = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  _cachedStripe = { instance, ts: now };
  return instance;
}
