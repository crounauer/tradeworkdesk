import type { ParsedHomeBlocks, TenantWebsiteContent, WebsiteBlockType } from "./websiteBuilderTypes";
import { classicSampleContent } from "@/templates/classic/sample-content";

const COMPONENT_TO_BLOCK: Record<string, WebsiteBlockType> = {
  Hero: "hero",
  Benefits: "benefits",
  ServicesPreview: "services",
  HowItWorksPreview: "process",
  FeaturedProject: "featured_project",
  TrustBar: "trust_bar",
  ReviewsPreview: "reviews",
  AreasPreview: "areas",
  FAQ: "faq",
  Contact: "contact",
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeWithFallback<T>(fallback: T, incoming: unknown): T {
  if (Array.isArray(fallback)) {
    return (Array.isArray(incoming) ? incoming : fallback) as T;
  }

  if (!isObject(fallback)) {
    return ((incoming ?? fallback) as T);
  }

  const result: Record<string, unknown> = { ...fallback };
  const incomingObj = isObject(incoming) ? incoming : {};

  for (const [key, fallbackValue] of Object.entries(fallback)) {
    result[key] = mergeWithFallback(fallbackValue, incomingObj[key]);
  }

  return result as T;
}

export function resolveTenantWebsiteContent(raw?: unknown): TenantWebsiteContent {
  return mergeWithFallback(classicSampleContent, raw);
}

export function parseClassicHomeTsx(source: string): ParsedHomeBlocks {
  const defaultFunction = source.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
  const pageName = defaultFunction?.[1] ?? "Home";

  const returnFragment = source.match(/return\s*\(\s*<>[\s\S]*?<\/>(\s*)\)/m)?.[0] ?? "";
  const componentMatches = [...returnFragment.matchAll(/<([A-Z][A-Za-z0-9_]*)\s*\/>/g)].map((m) => m[1]);

  const blockTypes = componentMatches
    .map((name) => COMPONENT_TO_BLOCK[name])
    .filter((b): b is WebsiteBlockType => Boolean(b));

  return {
    pageName,
    componentNames: componentMatches,
    blockTypes: Array.from(new Set(blockTypes)),
  };
}

export function validateTenantWebsiteContent(content: TenantWebsiteContent): string[] {
  const errors: string[] = [];

  if (!content.business.businessName.trim()) {
    errors.push("Business name is required.");
  }

  if (!content.hero.heading.trim()) {
    errors.push("Hero heading is required.");
  }

  content.services.items.forEach((service, i) => {
    if (!service.title.trim()) {
      errors.push(`Service title is required for item ${i + 1}.`);
    }
  });

  content.faqs.items.forEach((item, i) => {
    if (!item.question.trim()) errors.push(`FAQ question is required for item ${i + 1}.`);
    if (!item.answer.trim()) errors.push(`FAQ answer is required for item ${i + 1}.`);
  });

  if (content.contact.email && !/^\S+@\S+\.\S+$/.test(content.contact.email)) {
    errors.push("Contact email is invalid.");
  }

  content.reviews.items.forEach((review, i) => {
    if (review.rating < 1 || review.rating > 5) {
      errors.push(`Review rating must be 1-5 for item ${i + 1}.`);
    }
  });

  return errors;
}
