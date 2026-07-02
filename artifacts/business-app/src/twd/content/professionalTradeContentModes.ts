import type { TemplatePage } from "../templates/TemplatePageRenderer";
import { professionalTradePages } from "../templates/professionalTrade.pages";

export type ContentMode = "demo" | "empty" | "ai";

const CONTENT_MODES: ContentMode[] = ["demo", "empty", "ai"];

export type ContentModeDescriptor = {
  mode: ContentMode;
  label: string;
  description: string;
};

export type ContentSeedBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

export type ContentSeedPage = {
  blocks: ContentSeedBlock[];
};

export type ContentSeedFile = {
  template: string;
  mode: ContentMode;
  pages: Record<string, ContentSeedPage>;
};

export type ContentModesManifest = {
  template: string;
  defaultMode: ContentMode;
  modes: Array<ContentModeDescriptor & { file: string }>;
};

const STRUCTURAL_KEYS = new Set([
  "id",
  "slug",
  "href",
  "url",
  "path",
  "phone",
  "email",
  "ctaHref",
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function modeStringValue(value: string, mode: ContentMode, keyHint: string): string {
  if (mode === "demo") return value;

  const looksStructural = STRUCTURAL_KEYS.has(keyHint) || /href|url|path|slug|id/i.test(keyHint);
  if (looksStructural) return value;

  if (mode === "empty") return "";

  return `[[ai:${keyHint || "text"}]]`;
}

function mapValueForMode(value: unknown, mode: ContentMode, keyHint = ""): unknown {
  if (mode === "demo") {
    return clone(value);
  }

  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return modeStringValue(value, mode, keyHint);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapValueForMode(item, mode, keyHint));
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(input)) {
      output[key] = mapValueForMode(nested, mode, key);
    }

    return output;
  }

  return value;
}

function blockId(pageSlug: string, index: number, blockType: string): string {
  return `${pageSlug}-${String(index + 1).padStart(2, "0")}-${blockType.replaceAll(".", "-")}`;
}

function getPageForMode(pageSlug: string, mode: ContentMode): TemplatePage {
  const source = professionalTradePages[pageSlug as keyof typeof professionalTradePages];

  if (!source) {
    throw new Error(`Missing professional trade page for slug "${pageSlug}"`);
  }

  return {
    title: source.title,
    blocks: source.blocks.map((block) => ({
      type: block.type,
      props: mapValueForMode(block.props, mode, "props") as Record<string, unknown>,
    })),
  };
}

function buildSeedFile(mode: ContentMode): ContentSeedFile {
  const pages: Record<string, ContentSeedPage> = {};

  for (const pageSlug of Object.keys(professionalTradePages)) {
    const page = getPageForMode(pageSlug, mode);

    pages[pageSlug] = {
      blocks: page.blocks.map((block, index) => ({
        id: blockId(pageSlug, index, String(block.type || "text")),
        type: String(block.type || "text"),
        props: clone(block.props || {}),
      })),
    };
  }

  return {
    template: "professional-trade",
    mode,
    pages,
  };
}

export const professionalTradeContentModeDescriptors: ContentModeDescriptor[] = [
  {
    mode: "demo",
    label: "Demo content",
    description: "Use full sample copy and examples for preview and onboarding.",
  },
  {
    mode: "empty",
    label: "Empty content",
    description: "Keep the page structure while clearing editable text values.",
  },
  {
    mode: "ai",
    label: "AI scaffold",
    description: "Use lightweight AI placeholders that can be generated later.",
  },
];

export const professionalTradeContentModesManifest: ContentModesManifest = {
  template: "professional-trade",
  defaultMode: "demo",
  modes: professionalTradeContentModeDescriptors.map((mode) => ({
    ...mode,
    file: `${mode.mode}.json`,
  })),
};

export const professionalTradeContentSeeds: Record<ContentMode, ContentSeedFile> = {
  demo: buildSeedFile("demo"),
  empty: buildSeedFile("empty"),
  ai: buildSeedFile("ai"),
};

export function getProfessionalTradePageByMode(pageSlug: string, mode: ContentMode): TemplatePage {
  return getPageForMode(pageSlug, mode);
}

export function getAvailableProfessionalTradeContentModes(): ContentMode[] {
  return [...CONTENT_MODES];
}
