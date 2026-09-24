import crypto from "crypto";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function getTokenSecret(): string {
  const secret = process.env.QUOTE_ACTION_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Quote action token secret is not configured");
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getTokenSecret()).update(value).digest("base64url");
}

export function createQuoteAcceptToken(tenantId: string, quoteId: string): string {
  const payload = JSON.stringify({ tenantId, quoteId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
  const encodedPayload = encode(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyQuoteAcceptToken(token: string): { tenantId: string; quoteId: string } | null {
  const [encodedPayload, providedSignature] = String(token || "").split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(providedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      tenantId?: unknown;
      quoteId?: unknown;
      exp?: unknown;
    };
    if (typeof payload.tenantId !== "string" || typeof payload.quoteId !== "string" || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return { tenantId: payload.tenantId, quoteId: payload.quoteId };
  } catch {
    return null;
  }
}