import { decryptCredentials } from "./social-crypto";

export interface SocialPost {
  id: string;
  tenant_id?: string | null;
  created_by_user_id?: string | null;
  account_id?: string | null;
  platform: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  link_url?: string | null;
  post_type?: "business" | "website_promotion";
  website_page_id?: string | null;
  website_page_url?: string | null;
  final_link_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  scheduled_for?: string | null;
  status: string;
  post_id?: string | null;
  post_url?: string | null;
  error?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SocialAccount {
  id: string;
  tenant_id?: string | null;
  platform: string;
  encrypted_credentials: string;
  page_id?: string | null;
  page_name?: string | null;
  instagram_business_id?: string | null;
  profile_name: string;
  expires_at?: string | null;
  is_active: boolean;
  auto_post: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PostResult {
  postId?: string;
  postUrl?: string;
}

function getOptionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return undefined;
}

function getScopedOptionalEnv(account: SocialAccount, tenantNames: string[], platformNames: string[]): string | undefined {
  const isPlatformScope = !account.tenant_id;
  return isPlatformScope
    ? getOptionalEnv(...platformNames, ...tenantNames)
    : getOptionalEnv(...tenantNames);
}

function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid image URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Image URL must use HTTPS");
  }

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
    "metadata.google.internal",
    "169.254.169.254",
  ];
  if (blocked.includes(hostname)) {
    throw new Error("Image URL points to a blocked host");
  }

  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    hostname.startsWith("192.168.")
  ) {
    throw new Error("Image URL points to a private network");
  }
}

async function postToX(
  post: SocialPost,
  credentials: Record<string, string>,
  account: SocialAccount,
): Promise<PostResult> {
  const tokenType = String(credentials.tokenType || "oauth1").trim();

  if (tokenType === "oauth2") {
    const clientId = getScopedOptionalEnv(
      account,
      ["X_OAUTH_CLIENT_ID"],
      ["PLATFORM_X_OAUTH_CLIENT_ID"],
    );
    const clientSecret = getScopedOptionalEnv(
      account,
      ["X_OAUTH_CLIENT_SECRET"],
      ["PLATFORM_X_OAUTH_CLIENT_SECRET"],
    );
    const refreshToken = String(credentials.refreshToken || "").trim();

    let accessToken = String(credentials.accessToken || "").trim();
    if (refreshToken && clientId && clientSecret) {
      const refreshRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
      });

      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json() as { access_token?: string };
        accessToken = String(refreshJson.access_token || accessToken).trim();
      }
    }

    if (!accessToken) {
      throw new Error("Missing X OAuth2 access token");
    }

    if (post.image_url) {
      console.warn("[social-platforms] X OAuth2 publishing currently sends text-only posts");
    }

    const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text: post.content }),
    });

    if (!tweetRes.ok) {
      const errText = await tweetRes.text();
      throw new Error(`X API error: ${tweetRes.status} ${errText}`);
    }

    const tweetJson = await tweetRes.json() as { data?: { id?: string } };
    const tweetId = String(tweetJson.data?.id || "").trim();
    if (!tweetId) {
      throw new Error("X API did not return a tweet id");
    }

    return {
      postId: tweetId,
      postUrl: `https://x.com/i/web/status/${tweetId}`,
    };
  }

  const appKey = String(credentials.appKey || getScopedOptionalEnv(account, ["X_APP_KEY", "X_OAUTH1_APP_KEY"], ["PLATFORM_X_APP_KEY", "PLATFORM_X_OAUTH1_APP_KEY"]) || "").trim();
  const appSecret = String(credentials.appSecret || getScopedOptionalEnv(account, ["X_APP_SECRET", "X_OAUTH1_APP_SECRET"], ["PLATFORM_X_APP_SECRET", "PLATFORM_X_OAUTH1_APP_SECRET"]) || "").trim();
  const accessToken = String(credentials.accessToken || "").trim();
  const accessSecret = String(credentials.accessSecret || "").trim();
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Missing X/Twitter OAuth credentials");
  }

  const { TwitterApi } = await import("twitter-api-v2");
  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });

  let mediaId: string | undefined;

  if (post.image_url) {
    try {
      validateImageUrl(post.image_url);
      const imgRes = await fetch(post.image_url);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        mediaId = await client.v1.uploadMedia(buffer, { mimeType: "image/png" });
      }
    } catch (e) {
      console.error("Failed to upload media to X:", e);
    }
  }

  const tweetPayload: Record<string, unknown> = { text: post.content };
  if (mediaId) {
    tweetPayload.media = { media_ids: [mediaId] };
  }

  const result = await client.v2.tweet(tweetPayload);
  const tweetId = result.data.id;

  return {
    postId: tweetId,
    postUrl: `https://x.com/i/status/${tweetId}`,
  };
}

async function postToFacebook(
  post: SocialPost,
  credentials: Record<string, string>,
  account: SocialAccount,
): Promise<PostResult> {
  const { accessToken } = credentials;
  const pageId = account.page_id;
  if (!accessToken || !pageId) {
    throw new Error("Missing Facebook Page Access Token or Page ID");
  }

  const body: Record<string, string> = {
    message: post.content,
    access_token: accessToken,
  };
  if (post.link_url) body.link = post.link_url;

  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Facebook API error: ${res.status} ${errBody}`);
  }

  const data = await res.json() as { id: string };
  return {
    postId: data.id,
    postUrl: `https://facebook.com/${data.id}`,
  };
}

async function postToInstagram(
  post: SocialPost,
  credentials: Record<string, string>,
  account: SocialAccount,
): Promise<PostResult> {
  const { accessToken } = credentials;
  const igId = account.instagram_business_id;
  if (!accessToken || !igId) {
    throw new Error("Missing Instagram Business ID or Access Token");
  }
  if (!post.image_url) {
    throw new Error("Instagram posts require an image_url");
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: post.image_url,
        caption: post.content,
        access_token: accessToken,
      }),
    },
  );

  if (!containerRes.ok) {
    const errBody = await containerRes.text();
    throw new Error(`Instagram container error: ${containerRes.status} ${errBody}`);
  }

  const containerData = await containerRes.json() as { id: string };

  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken,
      }),
    },
  );

  if (!publishRes.ok) {
    const errBody = await publishRes.text();
    throw new Error(`Instagram publish error: ${publishRes.status} ${errBody}`);
  }

  const publishData = await publishRes.json() as { id: string };
  return {
    postId: publishData.id,
    postUrl: `https://instagram.com/p/${publishData.id}`,
  };
}

async function postToGoogleBusiness(
  post: SocialPost,
  credentials: Record<string, string>,
  account: SocialAccount,
): Promise<PostResult> {
  const clientId = String(
    credentials.clientId
    || getScopedOptionalEnv(account, ["GOOGLE_BUSINESS_OAUTH_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_ID"], ["PLATFORM_GOOGLE_BUSINESS_OAUTH_CLIENT_ID", "PLATFORM_GOOGLE_BUSINESS_CLIENT_ID"])
    || "",
  ).trim();
  const clientSecret = String(
    credentials.clientSecret
    || getScopedOptionalEnv(account, ["GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET", "GOOGLE_BUSINESS_CLIENT_SECRET"], ["PLATFORM_GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET", "PLATFORM_GOOGLE_BUSINESS_CLIENT_SECRET"])
    || "",
  ).trim();
  const refreshToken = String(credentials.refreshToken || "").trim();
  // page_id             → Google Account resource name  e.g. "accounts/123456"
  // instagram_business_id → Location resource ID        e.g. "locations/789012"
  const accountName = String(account.page_id || "").trim();
  const locationRaw = String(account.instagram_business_id || "").trim();
  const locationId = locationRaw.replace(/^locations\//, "");

  if (!clientId || !clientSecret || !refreshToken || !accountName || !locationId) {
    throw new Error("Missing Google Business credentials, account name, or location ID");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to refresh Google token: ${tokenRes.status} ${errText}`);
  }

  const { access_token: accessToken } = await tokenRes.json() as { access_token: string };
  const name = `${accountName}/locations/${locationId}`;

  const postBody: Record<string, unknown> = {
    languageCode: "en-GB",
    summary: post.content,
  };

  if (post.link_url) {
    postBody.callToAction = { actionType: "LEARN_MORE", url: post.link_url };
  }

  if (post.image_url) {
    validateImageUrl(post.image_url);
    postBody.media = [{ mediaFormat: "PHOTO", sourceUrl: post.image_url }];
  }

  const apiRes = await fetch(
    `https://mybusiness.googleapis.com/v4/${name}/localPosts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(postBody),
    },
  );

  if (!apiRes.ok) {
    const errBody = await apiRes.text();
    throw new Error(`Google Business API error: ${apiRes.status} ${errBody}`);
  }

  const postData = await apiRes.json() as { name: string; searchUrl?: string };
  return {
    postId: postData.name,
    postUrl: postData.searchUrl,
  };
}

export async function dispatchPost(
  post: SocialPost,
  account: SocialAccount,
): Promise<PostResult> {
  const credentials = decryptCredentials(account.encrypted_credentials);

  switch (post.platform) {
    case "x":
      return postToX(post, credentials, account);
    case "facebook":
      return postToFacebook(post, credentials, account);
    case "instagram":
      return postToInstagram(post, credentials, account);
    case "google_business":
      return postToGoogleBusiness(post, credentials, account);
    case "linkedin":
    case "pinterest":
    case "tiktok":
    case "youtube":
      console.warn(`[social-platforms] Platform "${post.platform}" is not yet supported`);
      throw new Error(`Platform "${post.platform}" is not yet supported`);
    default:
      throw new Error(`Unknown platform: ${post.platform}`);
  }
}
