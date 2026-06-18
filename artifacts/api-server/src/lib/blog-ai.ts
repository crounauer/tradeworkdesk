/**
 * AI Blog Writing helpers
 *
 * Generates blog content for website blog posts.
 * Uses gpt-4o-mini for cost efficiency; tracks usage via ai-usage.ts.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { trackAiUsage } from "./ai-usage";

export type BlogAiOperation = "generate" | "improve" | "excerpt" | "meta_description";

interface BlogAiOptions {
  operation: BlogAiOperation;
  title: string;
  existingContent?: string;
  companyName?: string;
  tradeType?: string;  // e.g. "Gas Engineer", "Boiler Service"
  contentOptions?: string[];  // e.g. ["faq", "lists", "images", "comparisons", "stats", "tips", "cta"]
  tenantId: string;
  userId?: string;
}

export interface BlogAiResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  /** Credits to deduct from tenant balance (cost_usd × GBP_rate × 2 × 100, min 1) */
  creditsUsed: number;
}

const GBP_PER_USD = 0.79;
const MARKUP_MULTIPLIER = 8.5; // cost + 750%

function calcCredits(costUsd: number): number {
  // 1 credit = £0.01 (1 penny). Charge at cost+100%.
  const pence = costUsd * GBP_PER_USD * MARKUP_MULTIPLIER * 100;
  return Math.max(1, Math.ceil(pence));
}

const SYSTEM_PROMPT_BASE = (companyName?: string, tradeType?: string) =>
  `You are an expert copywriter specialising in trade and home services businesses${tradeType ? `, particularly ${tradeType}` : ""}.
You write clear, SEO-friendly, professional blog content for ${companyName ?? "a trade business"}.
Write in British English. Be informative, practical, and engaging.
Do not use excessive markdown — use plain paragraphs with clear headings where appropriate.`;

async function callOpenAi(messages: { role: "system" | "user"; content: string }[]): Promise<{
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 2048,
    messages,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const tokensIn = response.usage?.prompt_tokens ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;
  // gpt-4o-mini: $0.15/M input, $0.60/M output
  const costUsd = (tokensIn / 1_000_000) * 0.15 + (tokensOut / 1_000_000) * 0.60;

  return { text, tokensIn, tokensOut, costUsd };
}

export async function runBlogAi(opts: BlogAiOptions): Promise<BlogAiResult> {
  const systemPrompt = SYSTEM_PROMPT_BASE(opts.companyName, opts.tradeType);

  const opts_map: Record<string, string> = {
    faq:         "Include a clearly labelled FAQ section with at least 3 relevant questions and answers.",
    lists:       "Use bullet lists or numbered lists to present key points for easy scanning.",
    images:      "Add [IMAGE: description] placeholders at natural points to indicate where relevant images should be inserted.",
    comparisons: "Include a comparison section or table contrasting options, products, or approaches.",
    stats:       "Include relevant statistics, industry figures, or factual data points to add credibility.",
    tips:        "Include a dedicated tips or advice section with practical, actionable recommendations.",
    cta:         "End with a clear, compelling call to action encouraging the reader to get in touch or book a service.",
  };

  const selectedExtras = (opts.contentOptions ?? []).map(id => opts_map[id]).filter(Boolean);
  const extrasInstruction = selectedExtras.length > 0
    ? `\n\nAdditional requirements:\n${selectedExtras.map(e => `- ${e}`).join("\n")}`
    : "";

  let userPrompt: string;

  switch (opts.operation) {
    case "generate":
      userPrompt = `Write a detailed, SEO-optimised blog post with the title: "${opts.title}".

Structure: an engaging introduction, 3–5 informative sections with H2-style headings, and a brief conclusion with a call to action.
Aim for 500–800 words. Write in British English.${extrasInstruction}`;
      break;

    case "improve":
      if (!opts.existingContent?.trim()) throw new Error("Existing content is required for the improve operation");
      userPrompt = `Improve the following blog post titled "${opts.title}". 
Make it more engaging, clearer, better structured, and more SEO-friendly.
Keep the same general topics but improve the writing quality. Return only the improved content.${extrasInstruction}

Original content:
${opts.existingContent}`;
      break;

    case "excerpt":
      if (!opts.existingContent?.trim()) throw new Error("Existing content is required for the excerpt operation");
      userPrompt = `Write a short, compelling excerpt (2–3 sentences, max 160 characters) for the following blog post titled "${opts.title}".
This will be used as a meta description and preview snippet. Return only the excerpt text.

Blog content:
${opts.existingContent.slice(0, 2000)}`;
      break;

    case "meta_description":
      if (!opts.existingContent?.trim()) throw new Error("Existing content is required for meta_description");
      userPrompt = `Write a concise meta description (max 155 characters) for a blog post titled "${opts.title}".
It should encourage clicks from search results and accurately describe the content.
Return only the meta description text, no quotes.

Blog content:
${opts.existingContent.slice(0, 1500)}`;
      break;

    default:
      throw new Error(`Unknown operation: ${opts.operation}`);
  }

  const { text, tokensIn, tokensOut, costUsd } = await callOpenAi([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  // Fire-and-forget usage tracking
  void trackAiUsage({
    tenantId: opts.tenantId,
    userId: opts.userId,
    operation: `blog_${opts.operation}`,
    module: "website",
    model: "gpt-4o-mini",
    tokensIn,
    tokensOut,
  });

  return {
    content: text.trim(),
    tokensIn,
    tokensOut,
    costUsd,
    creditsUsed: calcCredits(costUsd),
  };
}
