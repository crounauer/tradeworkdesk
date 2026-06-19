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
