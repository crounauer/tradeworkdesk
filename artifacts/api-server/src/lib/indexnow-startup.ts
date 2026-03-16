const HOST = "boilertech.replit.app";

const SITEMAP_URLS = [
  `https://${HOST}/`,
  `https://${HOST}/features`,
  `https://${HOST}/pricing`,
  `https://${HOST}/about`,
  `https://${HOST}/contact`,
  `https://${HOST}/blog`,
  `https://${HOST}/gas-engineer-software`,
  `https://${HOST}/boiler-service-management-software`,
  `https://${HOST}/job-management-software-heating-engineers`,
  `https://${HOST}/blog/how-to-go-paperless-as-a-gas-engineer`,
  `https://${HOST}/blog/gas-safe-record-keeping-guide`,
  `https://${HOST}/blog/best-software-for-heating-engineers`,
  `https://${HOST}/blog/managing-boiler-service-contracts`,
  `https://${HOST}/blog/heat-pump-service-software`,
  `https://${HOST}/privacy-policy`,
  `https://${HOST}/terms-of-service`,
];

let submitted = false;

export async function submitIndexNowOnStartup() {
  if (submitted) return;
  if (process.env.NODE_ENV !== "production") {
    console.log("IndexNow: skipping startup submission (not production)");
    return;
  }

  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log("IndexNow: INDEXNOW_KEY not set, skipping startup submission");
    return;
  }

  submitted = true;

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `https://${HOST}/${key}.txt`,
        urlList: SITEMAP_URLS,
      }),
    });

    console.log(`IndexNow: startup submission complete — ${response.status} (${SITEMAP_URLS.length} URLs)`);
  } catch (err) {
    console.error("IndexNow: startup submission failed —", err);
  }
}
