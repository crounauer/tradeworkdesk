import OpenAI from "openai";

const MISSING_OPENAI_INTEGRATION_ENV =
  "AI integration credentials are missing. Set AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY.";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error(MISSING_OPENAI_INTEGRATION_ENV);
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey, baseURL });
  }

  return openaiClient;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getOpenAIClient() as any;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
