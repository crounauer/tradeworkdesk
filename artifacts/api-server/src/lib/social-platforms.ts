import { decryptCredentials } from "./social-crypto";

export interface SocialPost {
  id: string;
  tenant_id: string;
  account_id?: string | null;
  platform: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  link_url?: string | null;
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
  tenant_id: string;
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
): Promise<PostResult> {
  const { appKey, appSecret, accessToken, accessSecret } = credentials;
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
  const { clientId, clientSecret, refreshToken } = credentials;
  // page_id             → Google Account resource name  e.g. "accounts/123456"
  // instagram_business_id → Location resource ID        e.g. "locations/789012"
  const accountName = account.page_id;
  const locationId = account.instagram_business_id;

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
      return postToX(post, credentials);
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
