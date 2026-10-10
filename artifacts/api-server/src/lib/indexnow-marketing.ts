const MARKETING_HOST = "www.tradeworkdesk.co.uk";

const DEFAULT_MARKETING_URLS = [
  `https://${MARKETING_HOST}/`,
  `https://${MARKETING_HOST}/features`,
  `https://${MARKETING_HOST}/pricing`,
  `https://${MARKETING_HOST}/about`,
  `https://${MARKETING_HOST}/contact`,
  `https://${MARKETING_HOST}/blog`,
  `https://${MARKETING_HOST}/gas-engineer-software`,
  `https://${MARKETING_HOST}/boiler-service-management-software`,
  `https://${MARKETING_HOST}/job-management-software-heating-engineers`,
  `https://${MARKETING_HOST}/oil-engineer-software`,
  `https://${MARKETING_HOST}/heat-pump-engineer-software`,
  `https://${MARKETING_HOST}/plumber-software`,
  `https://${MARKETING_HOST}/landlord-gas-safety-software`,
  `https://${MARKETING_HOST}/sole-trader-software`,
  `https://${MARKETING_HOST}/heating-company-software`,
  `https://${MARKETING_HOST}/industries`,
  `https://${MARKETING_HOST}/alternatives`,
  `https://${MARKETING_HOST}/blog/how-to-go-paperless-as-a-gas-engineer`,
  `https://${MARKETING_HOST}/blog/gas-safe-record-keeping-guide`,
  `https://${MARKETING_HOST}/blog/best-software-for-heating-engineers`,
  `https://${MARKETING_HOST}/blog/managing-boiler-service-contracts`,
  `https://${MARKETING_HOST}/blog/heat-pump-service-software`,
  `https://${MARKETING_HOST}/privacy-policy`,
  `https://${MARKETING_HOST}/terms-of-service`,
];

export type MarketingIndexNowResponse = {
  success: boolean;
  submitted: number;
  urls: string[];
  upstreamStatus: number;
  upstreamBody: string | null;
  error?: string;
};

export function getDefaultMarketingIndexNowUrls(): string[] {
  return [...DEFAULT_MARKETING_URLS];
}

const SITEMAP_INDEX_URL = `https://${MARKETING_HOST}/sitemap.xml`;

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out.push(match[1].trim());
  }
  return out;
}

/**
 * Crawls the live sitemap index and every child sitemap to collect all
 * indexable marketing + location (town) page URLs. The sitemaps are the source
 * of truth for what should be indexed, so this automatically includes every new
 * indexable town page and excludes noindex/doorway pages.
 */
export async function fetchMarketingSitemapUrls(): Promise<string[]> {
  const pageUrls = new Set<string>();
  try {
    const idxRes = await fetch(SITEMAP_INDEX_URL, { headers: { accept: "application/xml" } });
    if (!idxRes.ok) throw new Error(`HTTP ${idxRes.status}`);
    const childSitemaps = extractLocs(await idxRes.text()).filter((u) => u.endsWith(".xml"));

    for (const sitemapUrl of childSitemaps) {
      try {
        const res = await fetch(sitemapUrl, { headers: { accept: "application/xml" } });
        if (!res.ok) continue;
        for (const loc of extractLocs(await res.text())) {
          if (!loc.endsWith(".xml")) pageUrls.add(loc);
        }
      } catch {
        // Skip an unreachable child sitemap rather than failing the whole crawl.
      }
    }
  } catch (err) {
    console.warn(`[indexnow:marketing] sitemap crawl failed: ${String(err)}`);
  }
  return [...pageUrls];
}

/**
 * Submits every page in the live sitemaps (core marketing pages, country hubs
 * and all indexable town pages) to IndexNow. The curated defaults are always
 * merged in so core pages still submit if a sitemap is temporarily unreachable.
 */
export async function submitAllMarketingIndexNow(): Promise<MarketingIndexNowResponse> {
  const sitemapUrls = await fetchMarketingSitemapUrls();
  const merged = Array.from(new Set([...getDefaultMarketingIndexNowUrls(), ...sitemapUrls]));

  // IndexNow accepts up to 10,000 URLs per request; batch defensively.
  const BATCH = 10000;
  if (merged.length <= BATCH) {
    const result = await submitMarketingIndexNow(merged);
    return { ...result, urls: merged, submitted: result.success ? merged.length : result.submitted };
  }

  let submitted = 0;
  let lastStatus = 200;
  let lastBody: string | null = null;
  for (let i = 0; i < merged.length; i += BATCH) {
    const chunk = merged.slice(i, i + BATCH);
    const result = await submitMarketingIndexNow(chunk);
    lastStatus = result.upstreamStatus;
    lastBody = result.upstreamBody;
    if (!result.success) {
      return { success: false, submitted, urls: merged, upstreamStatus: result.upstreamStatus, upstreamBody: result.upstreamBody, error: result.error };
    }
    submitted += chunk.length;
  }
  return { success: true, submitted, urls: merged, upstreamStatus: lastStatus, upstreamBody: lastBody };
}

function areMarketingUrlsValid(urls: string[]) {
  const allowedPrefix = `https://${MARKETING_HOST}/`;
  const exactHost = `https://${MARKETING_HOST}`;
  const invalidUrls = urls.filter((u) => !u.startsWith(allowedPrefix) && u !== exactHost);
  return {
    valid: invalidUrls.length === 0,
    invalidUrls,
  };
}

export async function submitMarketingIndexNow(urls?: string[]): Promise<MarketingIndexNowResponse> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.error("[indexnow:marketing] INDEXNOW_KEY not configured");
    return {
      success: false,
      submitted: 0,
      urls: [],
      upstreamStatus: 500,
      upstreamBody: null,
      error: "INDEXNOW_KEY not configured",
    };
  }

  const urlList = Array.isArray(urls) && urls.length > 0 ? urls : getDefaultMarketingIndexNowUrls();
  const { valid, invalidUrls } = areMarketingUrlsValid(urlList);
  if (!valid) {
    console.error(`[indexnow:marketing] invalid URL list; count=${invalidUrls.length}`);
    return {
      success: false,
      submitted: 0,
      urls: urlList,
      upstreamStatus: 400,
      upstreamBody: null,
      error: `All URLs must belong to ${MARKETING_HOST}. Invalid: ${invalidUrls.join(", ")}`,
    };
  }

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: MARKETING_HOST,
        key,
        keyLocation: `https://${MARKETING_HOST}/${key}.txt`,
        urlList,
      }),
    });

    const upstreamBody = (await response.text()) || null;
    const upstreamStatus = response.status;
    const success = upstreamStatus === 200 || upstreamStatus === 202;

    if (!success) {
      const bodySnippet = upstreamBody ? upstreamBody.slice(0, 300) : "<empty>";
      console.error(`[indexnow:marketing] upstream rejected submission; status=${upstreamStatus} body=${bodySnippet}`);
    }

    return {
      success,
      submitted: urlList.length,
      urls: urlList,
      upstreamStatus,
      upstreamBody,
      ...(success ? {} : { error: "IndexNow API error" }),
    };
  } catch (err) {
    return {
      success: false,
      submitted: urlList.length,
      urls: urlList,
      upstreamStatus: 500,
      upstreamBody: String(err),
      error: "Failed to contact IndexNow API",
    };
  }
}

let startupSubmitted = false;

export function triggerMarketingIndexNowAutoSubmit(reason: string) {
  if (startupSubmitted) return;
  startupSubmitted = true;

  void submitMarketingIndexNow()
    .then((result) => {
      console.log(`[indexnow:auto:marketing] reason=${reason} success=${result.success} submitted=${result.submitted} status=${result.upstreamStatus}`);
    })
    .catch((err) => {
      console.error(`[indexnow:auto:marketing] reason=${reason} failed`, err);
    });
}
