import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { supabaseAdmin } from "./supabase";
import crypto from "crypto";

export interface SuggestionItem {
  entityType: "product" | "category" | "article";
  entityId: string;
  title: string;
  description?: string;
}

export interface PostSuggestion {
  entityType: string;
  entityId: string;
  platform: string;
  content: string;
  imageUrl?: string;
}

export async function generatePostSuggestions(
  items: SuggestionItem[],
  platforms: string[] = ["x", "facebook", "instagram"],
): Promise<PostSuggestion[]> {
  if (items.length === 0) return [];

  const itemDescriptions = items
    .map((item, i) => `${i + 1}. [${item.entityType}] "${item.title}"${item.description ? ` - ${item.description}` : ""}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are a social media marketing expert for TradeWorkDesk, a boiler service management software company.
Generate engaging social media posts for each item provided.
For each item, create one post per requested platform.
Include relevant emojis and 2-3 hashtags.
Keep Twitter/X posts under 280 characters.
Facebook and Instagram posts can be longer (up to 500 chars).
Return a JSON array of objects with: entityType, entityId, platform, content.
Only return valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Generate social media posts for these platforms: ${platforms.join(", ")}

Items to promote:
${itemDescriptions}

Item IDs in order: ${items.map((i) => i.entityId).join(", ")}
Item types in order: ${items.map((i) => i.entityType).join(", ")}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content || "[]";
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as PostSuggestion[];
  } catch {
    console.error("[social-ai] Failed to parse suggestions:", text);
    return [];
  }
}

export async function generateSocialImage(prompt: string): Promise<string> {
  const buffer = await generateImageBuffer(
    `Create a professional, clean social media banner image for a boiler service company. ${prompt}. Modern flat design, blue and orange color scheme, 1:1 aspect ratio.`,
    "1024x1024",
  );

  const fileName = `social-images/${crypto.randomUUID()}.png`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("service-photos")
    .upload(fileName, buffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.error("[social-ai] Failed to upload image to storage:", uploadError);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("service-photos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ─── Daily suggestions ─────────────────────────────────────────────────────────

const DAILY_TOPICS = [
  "Annual boiler service — why it matters for safety and efficiency",
  "Signs your boiler needs attention before it breaks down",
  "How to bleed radiators and keep your heating system running well",
  "Carbon monoxide safety: what every homeowner should know",
  "Energy saving tips to reduce your heating bills this season",
  "When to replace vs repair your boiler — expert advice",
  "Central heating power flushing — what it is and when you need it",
  "Smart thermostats and how they work with your boiler",
  "Common boiler error codes explained",
  "Why your radiators might have cold spots — and how to fix them",
  "Preparing your heating system before winter",
  "What's included in a Gas Safe boiler service",
  "Landlord gas safety certificates — your legal obligations",
  "How often should you service your boiler?",
  "Condensing boilers explained — are they worth it?",
];

function getSeasonalContext(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

export async function generateDailySuggestions(
  companyName: string,
  platforms: string[],
): Promise<PostSuggestion[]> {
  const season = getSeasonalContext();
  const monthName = new Date().toLocaleString("en-GB", { month: "long" });

  // Rotate topic daily based on day of year so it cycles without repetition
  const startOfYear = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - startOfYear) / 86_400_000);
  const topic = DAILY_TOPICS[dayOfYear % DAILY_TOPICS.length];

  const gbNote = platforms.includes("google_business")
    ? "Google Business posts must be under 300 characters, no hashtags, written as a helpful local business update."
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are a social media expert for a UK heating and boiler service company called "${companyName}".
Write authentic, helpful posts in a friendly professional tone. Use British English.
Include 2-3 relevant emojis and 2-3 UK hashtags per post (except Google Business — no hashtags there).
X/Twitter: max 280 chars. Facebook: max 400 chars. Instagram: max 500 chars. ${gbNote}
Return ONLY a valid JSON array with objects: { "platform": string, "content": string }. No markdown.`,
      },
      {
        role: "user",
        content: `Today's topic: "${topic}". Season: ${season}, Month: ${monthName}.
Generate one post per platform for: ${platforms.join(", ")}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "[]";
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{ platform: string; content: string }>;
    return parsed.map((p) => ({
      entityType: "article",
      entityId: "daily-suggestion",
      platform: p.platform,
      content: p.content,
    }));
  } catch {
    console.error("[social-ai] Failed to parse daily suggestions:", text);
    return [];
  }
}
