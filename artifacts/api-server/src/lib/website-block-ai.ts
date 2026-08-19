import { openai } from "@workspace/integrations-openai-ai-server";
import { trackAiUsage } from "./ai-usage";

export type WebsiteBlockAiResult = {
  patch: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  creditsUsed: number;
};

const GBP_PER_USD = 0.79;
const MARKUP_MULTIPLIER = 8.5;

function calcCredits(costUsd: number): number {
  return Math.max(1, Math.ceil(costUsd * GBP_PER_USD * MARKUP_MULTIPLIER * 100));
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return a valid configuration object");
  const parsed: unknown = JSON.parse(fenced.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI returned an invalid configuration object");
  }
  return parsed as Record<string, unknown>;
}

export async function runWebsiteBlockAi(opts: {
  blockType: string;
  content: Record<string, unknown>;
  editableFields: string[];
  instruction: string;
  companyName?: string;
  tradeType?: string;
  tenantId: string;
  userId?: string;
}): Promise<WebsiteBlockAiResult> {
  const systemPrompt = `You improve a tenant website block configuration for a trade business.
Return JSON only: an object containing a partial configuration patch.
Only use these editable fields: ${opts.editableFields.join(", ")}.
Never return HTML, JSX, database fields, IDs, URLs invented from nowhere, template code, or fields outside the allowlist.
Preserve existing values unless the instruction asks to change them. Use British English and concise professional copy.
The block type is ${opts.blockType}. Company: ${opts.companyName || "trade business"}. Trade: ${opts.tradeType || "general trade"}.`;
  const userPrompt = `Tenant instruction: ${opts.instruction.trim()}\n\nCurrent block configuration:\n${JSON.stringify(opts.content)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content || "{}";
  const rawPatch = extractJsonObject(text);
  const patch = Object.fromEntries(Object.entries(rawPatch).filter(([key]) => opts.editableFields.includes(key)));
  const tokensIn = response.usage?.prompt_tokens ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;
  const costUsd = (tokensIn / 1_000_000) * 0.15 + (tokensOut / 1_000_000) * 0.60;

  void trackAiUsage({
    tenantId: opts.tenantId,
    userId: opts.userId,
    operation: "website_block_assist",
    module: "website",
    model: "gpt-4o-mini",
    tokensIn,
    tokensOut,
  });

  return { patch, tokensIn, tokensOut, costUsd, creditsUsed: calcCredits(costUsd) };
}