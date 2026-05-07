import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set — Stripe features will be unavailable");
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
