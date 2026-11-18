import type { EmailAttachment } from "./email";

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const supportedExtension = /\.(pdf|doc|docx|xls|xlsx|csv|txt|jpe?g|png|webp)$/i;

export function parseEmailAttachments(value: unknown): { attachments: EmailAttachment[] } | { error: string } {
  if (value === undefined) return { attachments: [] };
  if (!Array.isArray(value) || value.length > MAX_FILES) {
    return { error: `Choose up to ${MAX_FILES} files to attach.` };
  }

  const attachments: EmailAttachment[] = [];
  let totalBytes = 0;
  for (const file of value) {
    if (!file || typeof file.filename !== "string" || typeof file.content !== "string") {
      return { error: "Invalid email attachment." };
    }
    const filename = file.filename.trim();
    if (filename.length > 255 || /[/\\\x00-\x1f\x7f]/.test(file.filename) || !supportedExtension.test(filename)) {
      return { error: "Use a valid filename for a supported document or image." };
    }
    if (file.content.length > Math.ceil((MAX_BYTES - totalBytes) / 3) * 4) {
      return { error: "Files must be 5 MB or less in total." };
    }
    const content = Buffer.from(file.content, "base64");
    if (!content.length || content.toString("base64") !== file.content) {
      return { error: `Attachment "${filename}" is empty or invalid.` };
    }
    totalBytes += content.length;
    if (totalBytes > MAX_BYTES) return { error: "Files must be 5 MB or less in total." };
    attachments.push({ filename, content });
  }
  return { attachments };
}
