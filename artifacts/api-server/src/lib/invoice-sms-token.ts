import crypto from "crypto";

const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.QUOTE_ACTION_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Invoice link signing secret is not configured");
  return value;
}

function signature(payload: Buffer, sentAt: string): Buffer {
  const timestamp = Date.parse(sentAt);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid invoice sent timestamp");
  return crypto.createHmac("sha256", secret())
    .update("invoice-sms-view\0")
    .update(payload)
    .update(`\0${timestamp}`)
    .digest().subarray(0, 16);
}

export function createInvoiceSmsToken(invoiceId: string, sentAt: string): string {
  const id = invoiceId.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(id)) throw new Error("Invalid invoice ID");
  const payload = Buffer.alloc(20);
  Buffer.from(id, "hex").copy(payload);
  payload.writeUInt32BE(Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS, 16);
  return Buffer.concat([payload, signature(payload, sentAt)]).toString("base64url");
}

export function parseInvoiceSmsToken(token: unknown): { invoiceId: string; payload: Buffer; signature: Buffer } | null {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{48}$/.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 36 || bytes.readUInt32BE(16) <= Math.floor(Date.now() / 1000)) return null;
  const hex = bytes.subarray(0, 16).toString("hex");
  return {
    invoiceId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    payload: bytes.subarray(0, 20),
    signature: bytes.subarray(20),
  };
}

export function verifyInvoiceSmsToken(token: ReturnType<typeof parseInvoiceSmsToken>, sentAt: unknown): boolean {
  if (!token || typeof sentAt !== "string" || !Number.isFinite(Date.parse(sentAt))) return false;
  return crypto.timingSafeEqual(token.signature, signature(token.payload, sentAt));
}
