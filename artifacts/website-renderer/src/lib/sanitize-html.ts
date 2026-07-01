// Lightweight sanitizer for tenant-authored rich text.
// Removes script/style/iframe/embed/object/meta/link tags, inline event handlers,
// javascript: URLs, and style attributes.
export function sanitizeTenantHtml(input: string | null | undefined): string {
  const raw = String(input || "");
  if (!raw) return "";

  return raw
    .replace(/<\s*(script|style|iframe|object|embed|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|meta|link)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'\s*javascript:[^']*'/gi, " $1='#'")
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, " $1=#");
}
