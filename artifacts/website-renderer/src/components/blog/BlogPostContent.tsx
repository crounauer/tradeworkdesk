import React from "react";
import type { BlogPost } from "@/lib/api";
import Link from "next/link";

interface Props {
  post: BlogPost;
}

type RenderBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "image-placeholder"; text: string };

function getContentText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (typeof block === "string") return block.trim();
      const value = block as Record<string, unknown>;
      return String(value.text || value.body || value.content || "").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function renderInline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`${start}-b`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${start}-i`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : text;
}

function parseContentBlocks(content: string): RenderBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: RenderBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const imageMatch = line.match(/^\[IMAGE:\s*(.+?)\]$/i);
    if (imageMatch) {
      blocks.push({ type: "image-placeholder", text: imageMatch[1] });
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 2 | 3,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    if (line.includes("|") && !line.startsWith("[IMAGE:")) {
      const tableRows: string[][] = [];
      while (i < lines.length) {
        const rowLine = (lines[i] ?? "").trim();
        if (!rowLine || !rowLine.includes("|")) break;
        if (/^\|?\s*[-:]+/.test(rowLine)) {
          i += 1;
          continue;
        }
        const cells = rowLine
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean);
        if (cells.length > 0) tableRows.push(cells);
        i += 1;
      }
      if (tableRows.length > 0) {
        blocks.push({ type: "table", rows: tableRows });
        continue;
      }
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = (lines[i] ?? "").trim();
        const itemMatch = itemLine.match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1].trim());
        i += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = (lines[i] ?? "").trim();
        const itemMatch = itemLine.match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1].trim());
        i += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const paragraphLine = (lines[i] ?? "").trim();
      if (!paragraphLine) break;
      if (/^\[IMAGE:\s*.+\]$/i.test(paragraphLine)) break;
      if (/^(#{2,3})\s+/.test(paragraphLine)) break;
      if (/^[-*]\s+/.test(paragraphLine)) break;
      if (/^\d+\.\s+/.test(paragraphLine)) break;
      if (paragraphLine.includes("|")) break;
      paragraphLines.push(paragraphLine);
      i += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
      continue;
    }

    i += 1;
  }

  return blocks;
}

export default function BlogPostContent({ post }: Props) {
  const contentBlocks = parseContentBlocks(getContentText(post.content));

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
      {post.website_blog_categories && (
        <Link
          href="/blog"
          style={{ fontSize: "0.8125rem", color: "#f97316", fontWeight: 600, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          ← {post.website_blog_categories.name}
        </Link>
      )}

      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: "16px 0 24px", lineHeight: 1.2 }}>
        {post.title}
      </h1>

      {post.published_at && (
        <time style={{ fontSize: "0.9375rem", color: "#6b7280", display: "block", marginBottom: 32 }}>
          Published {new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </time>
      )}

      {post.featured_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.featured_image_url}
          alt={post.title}
          style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 8, marginBottom: 40 }}
        />
      )}

      {post.excerpt && (
        <p style={{ fontSize: "1.25rem", color: "#374151", fontStyle: "italic", borderLeft: "4px solid #f97316", paddingLeft: 16, margin: "0 0 32px" }}>
          {post.excerpt}
        </p>
      )}

      <div style={{ color: "#374151" }}>
        {contentBlocks.map((block, i) => {
          if (block.type === "heading") {
            return block.level === 2 ? (
              <h2 key={i} style={{ fontSize: "1.5rem", fontWeight: 700, margin: "40px 0 16px", color: "#111827" }}>
                {block.text}
              </h2>
            ) : (
              <h3 key={i} style={{ fontSize: "1.2rem", fontWeight: 700, margin: "32px 0 14px", color: "#111827" }}>
                {block.text}
              </h3>
            );
          }

          if (block.type === "paragraph") {
            return (
              <p key={i} style={{ lineHeight: 1.85, marginBottom: 20, fontSize: "1.02rem" }}>
                {renderInline(block.text)}
              </p>
            );
          }

          if (block.type === "unordered-list") {
            return (
              <ul key={i} style={{ paddingLeft: 24, margin: "0 0 24px", lineHeight: 1.8 }}>
                {block.items.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          }

          if (block.type === "ordered-list") {
            return (
              <ol key={i} style={{ paddingLeft: 24, margin: "0 0 24px", lineHeight: 1.8 }}>
                {block.items.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          }

          if (block.type === "table") {
            const [header, ...rows] = block.rows;
            return (
              <div key={i} style={{ overflowX: "auto", margin: "0 0 28px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem", minWidth: 520 }}>
                  <thead>
                    <tr>
                      {header.map((cell, idx) => (
                        <th key={idx} style={{ textAlign: "left", padding: "12px 14px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e5e7eb", color: "#111827" }}>
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} style={{ padding: "12px 14px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <div key={i} style={{ margin: "0 0 28px", padding: "18px 20px", borderRadius: 12, backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1" }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#f97316" }}>
                Suggested image
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>{block.text}</p>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
        <Link href="/blog" style={{ color: "#f97316", textDecoration: "none", fontWeight: 500 }}>
          ← Back to Blog
        </Link>
      </div>
    </main>
  );
}
