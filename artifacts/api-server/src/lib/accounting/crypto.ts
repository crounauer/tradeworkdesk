import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.ACCOUNTING_ENCRYPTION_KEY || process.env.SOCIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ACCOUNTING_ENCRYPTION_KEY (or SOCIAL_ENCRYPTION_KEY) must be a 64-char hex string (32 bytes). " +
      "Cannot store accounting tokens without encryption."
    );
  }
  return Buffer.from(hex, "hex");
}

export function isEncryptionConfigured(): boolean {
  const hex = process.env.ACCOUNTING_ENCRYPTION_KEY || process.env.SOCIAL_ENCRYPTION_KEY;
  return !!(hex && hex.length === 64);
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  if (!ciphertext.startsWith(PREFIX)) {
    throw new Error("Token is not encrypted. Re-connect the integration to store tokens securely.");
  }

  const buf = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

  // Try ACCOUNTING_ENCRYPTION_KEY first, fall back to SOCIAL_ENCRYPTION_KEY.
  // This handles tokens that were encrypted before ACCOUNTING_ENCRYPTION_KEY was introduced.
  const keys: Buffer[] = [];
  const acctHex = process.env.ACCOUNTING_ENCRYPTION_KEY;
  const socialHex = process.env.SOCIAL_ENCRYPTION_KEY;
  if (acctHex && acctHex.length === 64) keys.push(Buffer.from(acctHex, "hex"));
  if (socialHex && socialHex.length === 64) keys.push(Buffer.from(socialHex, "hex"));
  if (keys.length === 0) {
    throw new Error("No encryption key configured. Cannot decrypt accounting tokens.");
  }

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      // Auth tag mismatch — try next key
    }
  }

  throw new Error("Unable to decrypt integration credentials. Please disconnect and reconnect your accounting integration in Company Settings.");
}
