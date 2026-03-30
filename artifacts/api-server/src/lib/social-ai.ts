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
