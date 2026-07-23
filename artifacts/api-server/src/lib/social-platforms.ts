import { decryptCredentials, encryptCredentials } from "./social-crypto";
import { supabaseAdmin } from "./supabase";

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
  connection_method?: string | null;
  token_metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface PostResult {
  postId?: string;
  postUrl?: string;
}

type XOAuth2RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

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

async function resolveImageUrlForPublishing(rawUrl: string): Promise<string> {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const markers = [
      "/storage/v1/object/public/",
      "/storage/v1/object/sign/",
      "/storage/v1/object/authenticated/",
    ];

    const marker = markers.find((m) => parsed.pathname.includes(m));
    if (!marker) return trimmed;

    const idx = parsed.pathname.indexOf(marker);
    const storagePath = parsed.pathname.slice(idx + marker.length);
    const firstSlash = storagePath.indexOf("/");
    if (firstSlash === -1) return trimmed;

    const bucket = decodeURIComponent(storagePath.slice(0, firstSlash));
    const objectPath = decodeURIComponent(storagePath.slice(firstSlash + 1));
    if (!bucket || !objectPath) return trimmed;

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 60);

    if (error || !data?.signedUrl) return trimmed;
    return data.signedUrl;
  } catch {
    return trimmed;
  }
}

function enforceXTextLimit(raw: string): string {
  const text = String(raw || "").trim();
  if (text.length <= 280) return text;

  const urlMatch = text.match(/\bhttps?:\/\/\S+$/);
  if (!urlMatch) {
    return `${text.slice(0, 277).trimEnd()}...`;
  }

  const url = urlMatch[0];
  const prefix = text.slice(0, urlMatch.index).trimEnd();
  const separator = prefix ? "\n\n" : "";
  const availablePrefixLength = 280 - url.length - separator.length;

  if (availablePrefixLength <= 0) {
    return url.slice(0, 280);
  }

  if (prefix.length <= availablePrefixLength) {
    return `${prefix}${separator}${url}`.trim();
  }

  const clippedPrefix = availablePrefixLength > 3
    ? `${prefix.slice(0, availablePrefixLength - 3).trimEnd()}...`
    : prefix.slice(0, availablePrefixLength);

  return `${clippedPrefix}${separator}${url}`.trim();
}

function formatXApiError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & {
      code?: number;
      data?: { title?: string; detail?: string; errors?: Array<{ message?: string }> };
    };

    const details: string[] = [];
    if (typeof anyErr.code === "number") {
      details.push(`code=${anyErr.code}`);
    }
    if (anyErr.data?.title) {
      details.push(anyErr.data.title);
    }
    if (anyErr.data?.detail) {
      details.push(anyErr.data.detail);
    }
    if (Array.isArray(anyErr.data?.errors) && anyErr.data?.errors.length > 0) {
      const firstCode = (anyErr.data.errors[0] as { code?: number } | undefined)?.code;
      if (typeof firstCode === "number") {
        details.push(`x_error_code=${firstCode}`);
      }
      const firstMsg = String(anyErr.data.errors[0]?.message || "").trim();
      if (firstMsg) details.push(firstMsg);
    }

    if (details.length > 0) {
      return `${anyErr.message} (${details.join(" | ")})`;
    }
    return anyErr.message;
  }

  return String(err);
}

function isXDuplicatePostError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as Error & {
    data?: { errors?: Array<{ code?: number; message?: string }> };
  };

  const first = anyErr.data?.errors?.[0];
  if (first?.code === 187) return true;
  const msg = String(first?.message || anyErr.message || "").toLowerCase();
  return msg.includes("duplicate") && msg.includes("status");
}

function isXAccessTokenExpired(account: SocialAccount): boolean {
  const expiresAt = String(account.expires_at || "").trim();
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return false;
  // Refresh 60s early to avoid race with in-flight API calls.
  return ms <= Date.now() + 60_000;
}

async function persistXOAuth2Credentials(args: {
  account: SocialAccount;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  expiresInSeconds: number | null;
}): Promise<void> {
  const { account, tokenType, accessToken, refreshToken, expiresAt, expiresInSeconds } = args;
  const table = account.tenant_id ? "social_accounts" : "platform_social_accounts";

  const encryptedCredentials = encryptCredentials({
    tokenType,
    accessToken,
    refreshToken,
  });

  const nextTokenMetadata = {
    ...(account.token_metadata || {}),
    last_refreshed_at: new Date().toISOString(),
    expires_in_seconds: expiresInSeconds,
  };

  let updateQuery = supabaseAdmin
    .from(table)
    .update({
      encrypted_credentials: encryptedCredentials,
      expires_at: expiresAt,
      token_metadata: nextTokenMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id)
    .eq("platform", "x");

  if (account.tenant_id) {
    updateQuery = updateQuery.eq("tenant_id", account.tenant_id);
  }

  const { error } = await updateQuery;
  if (error) {
    throw new Error(`Failed to persist refreshed X credentials: ${error.message}`);
  }
}

async function resolveXOAuth2AccessToken(
  account: SocialAccount,
  credentials: Record<string, string>,
): Promise<string> {
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

  const tokenType = String(credentials.tokenType || "oauth2").trim() || "oauth2";
  const existingAccessToken = String(credentials.accessToken || "").trim();
  const existingRefreshToken = String(credentials.refreshToken || "").trim();

  const shouldRefresh = !existingAccessToken || isXAccessTokenExpired(account);
  if (!shouldRefresh) {
    return existingAccessToken;
  }

  if (!existingRefreshToken || !clientId || !clientSecret) {
    if (existingAccessToken) return existingAccessToken;
    throw new Error("Missing X OAuth2 refresh credentials");
  }

  const refreshRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: existingRefreshToken,
    }).toString(),
  });

  if (!refreshRes.ok) {
    const errText = await refreshRes.text();
    throw new Error(`X OAuth2 token refresh failed: ${refreshRes.status} ${errText}`);
  }

  const refreshJson = await refreshRes.json() as XOAuth2RefreshResponse;
  const nextAccessToken = String(refreshJson.access_token || "").trim();
  const nextRefreshToken = String(refreshJson.refresh_token || existingRefreshToken).trim();
  const expiresIn = typeof refreshJson.expires_in === "number" ? refreshJson.expires_in : null;

  if (!nextAccessToken) {
    throw new Error("X OAuth2 token refresh did not return access token");
  }

  const expiresAt = expiresIn && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  await persistXOAuth2Credentials({
    account,
    tokenType,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt,
    expiresInSeconds: expiresIn,
  });

  return nextAccessToken;
}

async function postToX(
  post: SocialPost,
  credentials: Record<string, string>,
  account: SocialAccount,
): Promise<PostResult> {
  const tokenType = String(credentials.tokenType || "oauth1").trim();

  if (tokenType === "oauth2") {
    const accessToken = await resolveXOAuth2AccessToken(account, credentials);

    if (!accessToken) {
      throw new Error("Missing X OAuth2 access token");
    }

    const { TwitterApi } = await import("twitter-api-v2");
    const client = new TwitterApi(accessToken);

    let mediaId: string | undefined;
    if (post.image_url) {
      try {
        const publishImageUrl = await resolveImageUrlForPublishing(post.image_url);
        validateImageUrl(publishImageUrl);
        const imgRes = await fetch(publishImageUrl);
        if (!imgRes.ok) {
          throw new Error(`Failed to fetch image for X media upload: ${imgRes.status}`);
        }

        const mimeType = String(imgRes.headers.get("content-type") || "image/jpeg");
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        mediaId = await client.v1.uploadMedia(buffer, { mimeType });
      } catch (e) {
        console.error("Failed to upload media to X (OAuth2); posting text-only:", e);
      }
    }

    const tweetPayload: Record<string, unknown> = { text: enforceXTextLimit(post.content) };
    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    let tweetResult: Awaited<ReturnType<typeof client.v2.tweet>>;
    try {
      tweetResult = await client.v2.tweet(tweetPayload);
    } catch (err) {
      if (isXDuplicatePostError(err)) {
        throw new Error("X rejected this as a duplicate post. Edit the wording or add a unique line, then publish again.");
      }
      throw new Error(`X API error: ${formatXApiError(err)}`);
    }
    const tweetId = String(tweetResult.data?.id || "").trim();
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
      const publishImageUrl = await resolveImageUrlForPublishing(post.image_url);
      validateImageUrl(publishImageUrl);
      const imgRes = await fetch(publishImageUrl);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        mediaId = await client.v1.uploadMedia(buffer, { mimeType: "image/png" });
      }
    } catch (e) {
      console.error("Failed to upload media to X:", e);
    }
  }

  const tweetPayload: Record<string, unknown> = { text: enforceXTextLimit(post.content) };
  if (mediaId) {
    tweetPayload.media = { media_ids: [mediaId] };
  }

  let result: Awaited<ReturnType<typeof client.v2.tweet>>;
  try {
    result = await client.v2.tweet(tweetPayload);
  } catch (err) {
    if (isXDuplicatePostError(err)) {
      throw new Error("X rejected this as a duplicate post. Edit the wording or add a unique line, then publish again.");
    }
    throw new Error(`X API error: ${formatXApiError(err)}`);
  }
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

  if (post.image_url) {
    const publishImageUrl = await resolveImageUrlForPublishing(post.image_url);
    validateImageUrl(publishImageUrl);

    const photoBody: Record<string, string> = {
      url: publishImageUrl,
      access_token: accessToken,
      caption: post.content,
    };

    if (post.link_url) {
      photoBody.caption = `${post.content}\n\n${post.link_url}`;
    }

    const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(photoBody),
    });

    if (photoRes.ok) {
      const data = await photoRes.json() as { post_id?: string; id?: string };
      const postId = String(data.post_id || data.id || "").trim();
      return {
        postId,
        postUrl: postId ? `https://facebook.com/${postId}` : undefined,
      };
    }

    const photoErrBody = await photoRes.text();
    console.error(`[social-platforms] Facebook photo publish failed, falling back to feed post: ${photoRes.status} ${photoErrBody}`);
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

  const publishImageUrl = await resolveImageUrlForPublishing(post.image_url);

  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: publishImageUrl,
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
    const publishImageUrl = await resolveImageUrlForPublishing(post.image_url);
    validateImageUrl(publishImageUrl);
    postBody.media = [{ mediaFormat: "PHOTO", sourceUrl: publishImageUrl }];
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
