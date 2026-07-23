import { Router, type IRouter } from "express";
import crypto from "crypto";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";
import { encryptCredentials } from "../lib/social-crypto";
import { dispatchPost } from "../lib/social-platforms";
import { generatePostSuggestions, generateSocialImage, type SuggestionItem } from "../lib/social-ai";
import {
  SOCIAL_POST_TYPES,
  type SocialPostType,
  buildUtmTaggedUrl,
  listPromotionPages,
  resolvePromotionPageUrl,
} from "../lib/social-website-promotion";

const SUPPORTED_PLATFORMS = ["x", "facebook", "instagram", "google_business"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
const SUPPORTED_SOCIAL_CHANNELS = ["x", "facebook", "google_business", "instagram"] as const;

const FACEBOOK_POST_PERMISSIONS = [
  "facebook_post_create",
  "facebook_post_publish",
  "facebook_post_schedule",
  "facebook_post_manage_connections",
] as const;

const FACEBOOK_GRAPH_VERSION = "v19.0";
const FACEBOOK_STATE_TTL_MS = 10 * 60 * 1000;
const X_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_BUSINESS_STATE_TTL_MS = 10 * 60 * 1000;
const INSTAGRAM_STATE_TTL_MS = 10 * 60 * 1000;
const FACEBOOK_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
] as const;
const INSTAGRAM_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;
const X_OAUTH_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"] as const;
const GOOGLE_BUSINESS_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
] as const;

type FacebookPostPermission = (typeof FACEBOOK_POST_PERMISSIONS)[number];

const FACEBOOK_ROLE_PERMISSIONS: Record<string, Set<FacebookPostPermission>> = {
  admin: new Set(FACEBOOK_POST_PERMISSIONS),
  super_admin: new Set(FACEBOOK_POST_PERMISSIONS),
};

function isSupportedPlatform(p: string): p is SupportedPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}

function getRequiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function getPublicAppOrigin(req: AuthenticatedRequest): string {
  const configured = String(process.env.APP_URL || "").trim();
  if (configured) return normalizeOrigin(configured);

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = req.get("host") || "localhost:3001";
  return normalizeOrigin(`${proto}://${host}`);
}

function getFacebookCallbackUrl(req: AuthenticatedRequest): string {
  return `${getPublicAppOrigin(req)}/api/admin/social/facebook/callback`;
}

function getInstagramCallbackUrl(req: AuthenticatedRequest): string {
  return `${getPublicAppOrigin(req)}/api/admin/social/instagram/callback`;
}

function getXCallbackUrl(req: AuthenticatedRequest): string {
  return `${getPublicAppOrigin(req)}/api/admin/social/x/callback`;
}

function getGoogleBusinessCallbackUrl(req: AuthenticatedRequest): string {
  return `${getPublicAppOrigin(req)}/api/admin/social/google-business/callback`;
}

function getScopedRequiredEnv(isPlatformScope: boolean, tenantNames: string[], platformNames: string[]): string {
  const names = isPlatformScope ? platformNames : tenantNames;
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

function sanitizeReturnPath(raw: unknown): string {
  const fallback = "/admin/social?tab=accounts";
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

async function exchangeFacebookCodeForToken(code: string, redirectUri: string): Promise<{ accessToken: string; expiresIn: number | null; tokenSource: "long_lived" | "short_lived" }> {
  const appId = getRequiredEnv("META_APP_ID");
  const appSecret = getRequiredEnv("META_APP_SECRET");

  const shortTokenUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`);
  shortTokenUrl.searchParams.set("client_id", appId);
  shortTokenUrl.searchParams.set("client_secret", appSecret);
  shortTokenUrl.searchParams.set("redirect_uri", redirectUri);
  shortTokenUrl.searchParams.set("code", code);

  const shortRes = await fetch(shortTokenUrl.toString());
  if (!shortRes.ok) {
    throw new Error(`Facebook token exchange failed (${shortRes.status})`);
  }

  const shortJson = await shortRes.json() as { access_token?: string; expires_in?: number };
  const shortToken = String(shortJson.access_token || "").trim();
  if (!shortToken) {
    throw new Error("Facebook token exchange did not return an access token");
  }

  const longTokenUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`);
  longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
  longTokenUrl.searchParams.set("client_id", appId);
  longTokenUrl.searchParams.set("client_secret", appSecret);
  longTokenUrl.searchParams.set("fb_exchange_token", shortToken);

  const longRes = await fetch(longTokenUrl.toString());
  if (longRes.ok) {
    const longJson = await longRes.json() as { access_token?: string; expires_in?: number };
    const longToken = String(longJson.access_token || "").trim();
    if (longToken) {
      return {
        accessToken: longToken,
        expiresIn: typeof longJson.expires_in === "number" ? longJson.expires_in : null,
        tokenSource: "long_lived",
      };
    }
  }

  return {
    accessToken: shortToken,
    expiresIn: typeof shortJson.expires_in === "number" ? shortJson.expires_in : null,
    tokenSource: "short_lived",
  };
}

async function fetchFacebookPages(userAccessToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const pagesUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token");
  pagesUrl.searchParams.set("access_token", userAccessToken);

  const pagesRes = await fetch(pagesUrl.toString());
  if (!pagesRes.ok) {
    throw new Error(`Failed to fetch Facebook pages (${pagesRes.status})`);
  }

  const pagesJson = await pagesRes.json() as { data?: Array<{ id?: string; name?: string; access_token?: string }> };
  const rows = pagesJson.data || [];
  return rows
    .map((row) => ({
      id: String(row.id || "").trim(),
      name: String(row.name || "").trim(),
      access_token: String(row.access_token || "").trim(),
    }))
    .filter((row) => !!row.id && !!row.name && !!row.access_token);
}

async function fetchInstagramBusinessAccounts(userAccessToken: string): Promise<Array<{
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramBusinessId: string;
  instagramUsername: string;
}>> {
  const pagesUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  pagesUrl.searchParams.set("access_token", userAccessToken);

  const pagesRes = await fetch(pagesUrl.toString());
  if (!pagesRes.ok) {
    throw new Error(`Failed to fetch Instagram-linked pages (${pagesRes.status})`);
  }

  const pagesJson = await pagesRes.json() as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: {
        id?: string;
        username?: string;
      };
    }>;
  };

  const rows = pagesJson.data || [];
  return rows
    .map((row) => ({
      pageId: String(row.id || "").trim(),
      pageName: String(row.name || "").trim(),
      pageAccessToken: String(row.access_token || "").trim(),
      instagramBusinessId: String(row.instagram_business_account?.id || "").trim(),
      instagramUsername: String(row.instagram_business_account?.username || "").trim(),
    }))
    .filter((row) => !!row.pageId && !!row.pageAccessToken && !!row.instagramBusinessId);
}

async function fetchXProfile(accessToken: string): Promise<{ id: string; username: string; name: string }> {
  const profileRes = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileRes.ok) {
    throw new Error(`Failed to fetch X profile (${profileRes.status})`);
  }

  const profileJson = await profileRes.json() as {
    data?: { id?: string; username?: string; name?: string };
  };

  const id = String(profileJson.data?.id || "").trim();
  const username = String(profileJson.data?.username || "").trim();
  const name = String(profileJson.data?.name || "").trim();
  if (!id || !username) {
    throw new Error("X profile response missing required fields");
  }

  return { id, username, name: name || username };
}

type GoogleBusinessTokenResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number | null;
};

async function exchangeGoogleBusinessCodeForTokens(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleBusinessTokenResult> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${errBody}`);
  }

  const tokenJson = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = String(tokenJson.access_token || "").trim();
  const refreshToken = String(tokenJson.refresh_token || "").trim();

  if (!accessToken || !refreshToken) {
    throw new Error("Google token exchange did not return required tokens");
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : null,
  };
}

type GoogleBusinessLocation = {
  accountName: string;
  locationId: string;
  locationName: string;
};

async function fetchGoogleBusinessLocations(accessToken: string): Promise<GoogleBusinessLocation[]> {
  const accountsRes = await fetch("https://mybusiness.googleapis.com/v4/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!accountsRes.ok) {
    const errBody = await accountsRes.text();
    throw new Error(`Failed to list Google Business accounts (${accountsRes.status}): ${errBody}`);
  }

  const accountsJson = await accountsRes.json() as {
    accounts?: Array<{ name?: string; accountName?: string }>;
  };

  const results: GoogleBusinessLocation[] = [];

  for (const account of accountsJson.accounts || []) {
    const accountName = String(account.name || "").trim();
    if (!accountName) continue;

    const locationsRes = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/locations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!locationsRes.ok) {
      continue;
    }

    const locationsJson = await locationsRes.json() as {
      locations?: Array<{ name?: string; locationName?: string; title?: string }>;
    };

    for (const location of locationsJson.locations || []) {
      const fullName = String(location.name || "").trim();
      const locationName = String(location.locationName || location.title || fullName || "").trim();
      const match = fullName.match(/\/locations\/(.+)$/);
      const locationId = String(match?.[1] || "").trim();
      if (!locationId) continue;

      results.push({
        accountName,
        locationId,
        locationName: locationName || locationId,
      });
    }
  }

  return results;
}

function hasFacebookPermission(req: AuthenticatedRequest, permission: FacebookPostPermission): boolean {
  if (!req.userRole) return false;
  return FACEBOOK_ROLE_PERMISSIONS[req.userRole]?.has(permission) ?? false;
}

function isPlatformSocialScope(req: AuthenticatedRequest): boolean {
  return req.userRole === "super_admin";
}

function resolveTenantId(req: AuthenticatedRequest): string | undefined {
  return req.tenantId;
}

function getSocialScopeErrorMessage(req: AuthenticatedRequest): string {
  if (req.userRole === "super_admin") {
    return "Unable to resolve platform marketing social scope";
  }
  return "Unable to resolve social tenant scope";
}

function coercePostType(value: unknown): SocialPostType {
  const raw = String(value || "business");
  return (SOCIAL_POST_TYPES as readonly string[]).includes(raw)
    ? (raw as SocialPostType)
    : "business";
}

function sanitizeCampaignValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function buildDefaultCampaign(tenantId: string, postType: SocialPostType): Promise<string> {
  const { data: company } = await supabaseAdmin
    .from("company_settings")
    .select("name, trading_name")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();

  const rawName = String(company?.name || company?.trading_name || "platform");
  const normalizedName = sanitizeCampaignValue(rawName) || "platform";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${postType}-${normalizedName}-${date}`;
}

const router: IRouter = Router();

router.post(
  "/admin/social/facebook/oauth/start",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthenticated user" });
        return;
      }

      const tenantId = resolveTenantId(req);
      const isPlatformScope = isPlatformSocialScope(req);
      if (!isPlatformScope && !tenantId) {
        res.status(400).json({ error: getSocialScopeErrorMessage(req) });
        return;
      }

      const appId = getRequiredEnv("META_APP_ID");
      const configurationId = getRequiredEnv("META_CONFIGURATION_ID");
      const callbackUrl = getFacebookCallbackUrl(req);
      const returnPath = sanitizeReturnPath(req.body?.returnPath);

      const state = crypto.randomBytes(32).toString("hex");
      const stateHash = sha256(state);
      const expiresAt = new Date(Date.now() + FACEBOOK_STATE_TTL_MS).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from(isPlatformScope ? "platform_facebook_oauth_states" : "facebook_oauth_states")
        .insert(
          isPlatformScope
            ? {
              created_by_user_id: req.userId,
              state_hash: stateHash,
              return_path: returnPath,
              expires_at: expiresAt,
            }
            : {
              tenant_id: tenantId,
              created_by_user_id: req.userId,
              state_hash: stateHash,
              return_path: returnPath,
              expires_at: expiresAt,
            },
        );

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      const authUrl = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", FACEBOOK_OAUTH_SCOPES.join(","));
      authUrl.searchParams.set("config_id", configurationId);

      res.json({ authUrl: authUrl.toString(), callbackUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/admin/social/facebook/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const appOrigin = getPublicAppOrigin(req);
    const fallbackReturnPath = "/admin/social?tab=accounts";
    const fallbackRedirect = (status: string, message?: string) => {
      const url = new URL(fallbackReturnPath, appOrigin);
      url.searchParams.set("facebook_oauth", status);
      if (message) url.searchParams.set("message", message);
      res.redirect(url.toString());
    };

    try {
      const oauthError = String(req.query.error || "").trim();
      const oauthErrorReason = String(req.query.error_reason || "").trim();
      const oauthErrorDescription = String(req.query.error_description || "").trim();
      const state = String(req.query.state || "").trim();
      const code = String(req.query.code || "").trim();

      if (!state) {
        fallbackRedirect("error", "missing_state");
        return;
      }

      const stateHash = sha256(state);
      const nowIso = new Date().toISOString();
      const { data: tenantState, error: tenantStateError } = await supabaseAdmin
        .from("facebook_oauth_states")
        .select("id, tenant_id, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const { data: platformState, error: platformStateError } = await supabaseAdmin
        .from("platform_facebook_oauth_states")
        .select("id, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const pendingState = tenantState || platformState;
      const tenantScopeTenantId = tenantState?.tenant_id || null;
      const isPlatformScope = !!platformState;
      const stateError = tenantStateError || platformStateError;

      if (stateError || !pendingState) {
        fallbackRedirect("error", "invalid_or_expired_state");
        return;
      }

      const returnPath = sanitizeReturnPath(pendingState.return_path);
      const redirectWith = (status: string, message?: string, connectedCount?: number) => {
        const redirectUrl = new URL(returnPath, appOrigin);
        redirectUrl.searchParams.set("facebook_oauth", status);
        if (message) redirectUrl.searchParams.set("message", message);
        if (typeof connectedCount === "number") redirectUrl.searchParams.set("connected", String(connectedCount));
        res.redirect(redirectUrl.toString());
      };

      await supabaseAdmin
        .from(isPlatformScope ? "platform_facebook_oauth_states" : "facebook_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", pendingState.id)
        .is("used_at", null);

      if (oauthError) {
        const message = oauthErrorDescription || oauthErrorReason || oauthError;
        redirectWith("error", message);
        return;
      }

      if (!code) {
        redirectWith("error", "missing_code");
        return;
      }

      const callbackUrl = getFacebookCallbackUrl(req);
      const tokenResult = await exchangeFacebookCodeForToken(code, callbackUrl);
      const pages = await fetchFacebookPages(tokenResult.accessToken);

      if (pages.length === 0) {
        redirectWith("error", "no_pages_found");
        return;
      }

      const expiresAt = tokenResult.expiresIn && tokenResult.expiresIn > 0
        ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
        : null;

      for (const page of pages) {
        const encryptedCredentials = encryptCredentials({ accessToken: page.access_token });
        const tokenMetadata = {
          type: "facebook_page_access_token",
          oauth_flow: "facebook_login_for_business",
          token_source: tokenResult.tokenSource,
          connected_at: new Date().toISOString(),
          user_token_expires_in_seconds: tokenResult.expiresIn,
          configuration_id: String(process.env.META_CONFIGURATION_ID || "").trim() || null,
        };

        const accountPayload = {
          platform: "facebook",
          encrypted_credentials: encryptedCredentials,
          profile_name: page.name,
          page_id: page.id,
          page_name: page.name,
          expires_at: expiresAt,
          is_active: true,
          connection_method: "facebook_oauth",
          token_metadata: tokenMetadata,
          updated_at: new Date().toISOString(),
        };

        const accountTable = isPlatformScope ? "platform_social_accounts" : "social_accounts";
        const scopedPayload = isPlatformScope
          ? accountPayload
          : { ...accountPayload, tenant_id: tenantScopeTenantId };

        let findQuery = supabaseAdmin
          .from(accountTable)
          .select("id")
          .eq("platform", "facebook")
          .eq("page_id", page.id)
          .limit(1);

        if (!isPlatformScope) {
          findQuery = findQuery.eq("tenant_id", tenantScopeTenantId);
        }

        const { data: existingAccount, error: findError } = await findQuery.maybeSingle();

        if (findError) {
          throw new Error(findError.message);
        }

        if (existingAccount?.id) {
          let updateQuery = supabaseAdmin
            .from(accountTable)
            .update(scopedPayload)
            .eq("id", existingAccount.id);

          if (!isPlatformScope) {
            updateQuery = updateQuery.eq("tenant_id", tenantScopeTenantId);
          }

          const { error: updateError } = await updateQuery;

          if (updateError) {
            throw new Error(updateError.message);
          }
          continue;
        }

        const { error: insertError } = await supabaseAdmin
          .from(accountTable)
          .insert(scopedPayload);

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      redirectWith("success", undefined, pages.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "oauth_callback_failed";
      fallbackRedirect("error", message);
    }
  },
);

router.delete(
  "/admin/social/facebook/oauth/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const tenantId = resolveTenantId(req);
    const isPlatformScope = isPlatformSocialScope(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const { id } = req.params;
    let deleteQuery = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .delete()
      .eq("id", id)
      .eq("platform", "facebook");

    if (!isPlatformScope) {
      deleteQuery = deleteQuery.eq("tenant_id", tenantId!);
    }

    const { error } = await deleteQuery;

    if (error) {
      res.status(404).json({ error: "Facebook account not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.post(
  "/admin/social/instagram/oauth/start",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthenticated user" });
        return;
      }

      const tenantId = resolveTenantId(req);
      const isPlatformScope = isPlatformSocialScope(req);
      if (!isPlatformScope && !tenantId) {
        res.status(400).json({ error: getSocialScopeErrorMessage(req) });
        return;
      }

      const appId = getRequiredEnv("META_APP_ID");
      const configurationId = String(process.env.INSTAGRAM_CONFIGURATION_ID || process.env.META_CONFIGURATION_ID || "").trim();
      const callbackUrl = getInstagramCallbackUrl(req);
      const returnPath = sanitizeReturnPath(req.body?.returnPath);

      const state = crypto.randomBytes(32).toString("hex");
      const stateHash = sha256(state);
      const expiresAt = new Date(Date.now() + INSTAGRAM_STATE_TTL_MS).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from(isPlatformScope ? "platform_instagram_oauth_states" : "instagram_oauth_states")
        .insert(
          isPlatformScope
            ? {
              created_by_user_id: req.userId,
              state_hash: stateHash,
              return_path: returnPath,
              expires_at: expiresAt,
            }
            : {
              tenant_id: tenantId,
              created_by_user_id: req.userId,
              state_hash: stateHash,
              return_path: returnPath,
              expires_at: expiresAt,
            },
        );

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      const authUrl = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES.join(","));
      if (configurationId) {
        authUrl.searchParams.set("config_id", configurationId);
      }

      res.json({ authUrl: authUrl.toString(), callbackUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/admin/social/instagram/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const appOrigin = getPublicAppOrigin(req);
    const fallbackReturnPath = "/admin/social?tab=accounts";
    const fallbackRedirect = (status: string, message?: string) => {
      const url = new URL(fallbackReturnPath, appOrigin);
      url.searchParams.set("instagram_oauth", status);
      if (message) url.searchParams.set("message", message);
      res.redirect(url.toString());
    };

    try {
      const oauthError = String(req.query.error || "").trim();
      const oauthErrorReason = String(req.query.error_reason || "").trim();
      const oauthErrorDescription = String(req.query.error_description || "").trim();
      const state = String(req.query.state || "").trim();
      const code = String(req.query.code || "").trim();

      if (!state) {
        fallbackRedirect("error", "missing_state");
        return;
      }

      const stateHash = sha256(state);
      const nowIso = new Date().toISOString();
      const { data: tenantState, error: tenantStateError } = await supabaseAdmin
        .from("instagram_oauth_states")
        .select("id, tenant_id, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const { data: platformState, error: platformStateError } = await supabaseAdmin
        .from("platform_instagram_oauth_states")
        .select("id, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const pendingState = tenantState || platformState;
      const tenantScopeTenantId = tenantState?.tenant_id || null;
      const isPlatformScope = !!platformState;
      const stateError = tenantStateError || platformStateError;

      if (stateError || !pendingState) {
        fallbackRedirect("error", "invalid_or_expired_state");
        return;
      }

      const returnPath = sanitizeReturnPath(pendingState.return_path);
      const redirectWith = (status: string, message?: string, connectedCount?: number) => {
        const redirectUrl = new URL(returnPath, appOrigin);
        redirectUrl.searchParams.set("instagram_oauth", status);
        if (message) redirectUrl.searchParams.set("message", message);
        if (typeof connectedCount === "number") redirectUrl.searchParams.set("connected", String(connectedCount));
        res.redirect(redirectUrl.toString());
      };

      await supabaseAdmin
        .from(isPlatformScope ? "platform_instagram_oauth_states" : "instagram_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", pendingState.id)
        .is("used_at", null);

      if (oauthError) {
        const message = oauthErrorDescription || oauthErrorReason || oauthError;
        redirectWith("error", message);
        return;
      }

      if (!code) {
        redirectWith("error", "missing_code");
        return;
      }

      const callbackUrl = getInstagramCallbackUrl(req);
      const tokenResult = await exchangeFacebookCodeForToken(code, callbackUrl);
      const accounts = await fetchInstagramBusinessAccounts(tokenResult.accessToken);

      if (accounts.length === 0) {
        redirectWith("error", "no_instagram_business_accounts_found");
        return;
      }

      const expiresAt = tokenResult.expiresIn && tokenResult.expiresIn > 0
        ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
        : null;

      for (const account of accounts) {
        const encryptedCredentials = encryptCredentials({ accessToken: account.pageAccessToken });
        const tokenMetadata = {
          type: "instagram_page_access_token",
          oauth_flow: "instagram_login_for_business",
          token_source: tokenResult.tokenSource,
          connected_at: new Date().toISOString(),
          user_token_expires_in_seconds: tokenResult.expiresIn,
          configuration_id: String(process.env.INSTAGRAM_CONFIGURATION_ID || process.env.META_CONFIGURATION_ID || "").trim() || null,
        };

        const accountPayload = {
          platform: "instagram",
          encrypted_credentials: encryptedCredentials,
          profile_name: account.instagramUsername || account.pageName,
          page_id: account.pageId,
          page_name: account.pageName,
          instagram_business_id: account.instagramBusinessId,
          expires_at: expiresAt,
          is_active: true,
          connection_method: "instagram_oauth",
          token_metadata: tokenMetadata,
          updated_at: new Date().toISOString(),
        };

        const accountTable = isPlatformScope ? "platform_social_accounts" : "social_accounts";
        const scopedPayload = isPlatformScope
          ? accountPayload
          : { ...accountPayload, tenant_id: tenantScopeTenantId };

        let findQuery = supabaseAdmin
          .from(accountTable)
          .select("id")
          .eq("platform", "instagram")
          .eq("instagram_business_id", account.instagramBusinessId)
          .limit(1);

        if (!isPlatformScope) {
          findQuery = findQuery.eq("tenant_id", tenantScopeTenantId);
        }

        const { data: existingAccount, error: findError } = await findQuery.maybeSingle();

        if (findError) {
          throw new Error(findError.message);
        }

        if (existingAccount?.id) {
          let updateQuery = supabaseAdmin
            .from(accountTable)
            .update(scopedPayload)
            .eq("id", existingAccount.id);

          if (!isPlatformScope) {
            updateQuery = updateQuery.eq("tenant_id", tenantScopeTenantId);
          }

          const { error: updateError } = await updateQuery;

          if (updateError) {
            throw new Error(updateError.message);
          }
          continue;
        }

        const { error: insertError } = await supabaseAdmin
          .from(accountTable)
          .insert(scopedPayload);

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      redirectWith("success", undefined, accounts.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "oauth_callback_failed";
      fallbackRedirect("error", message);
    }
  },
);

router.delete(
  "/admin/social/instagram/oauth/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const tenantId = resolveTenantId(req);
    const isPlatformScope = isPlatformSocialScope(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const { id } = req.params;
    let deleteQuery = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .delete()
      .eq("id", id)
      .eq("platform", "instagram");

    if (!isPlatformScope) {
      deleteQuery = deleteQuery.eq("tenant_id", tenantId!);
    }

    const { error } = await deleteQuery;

    if (error) {
      res.status(404).json({ error: "Instagram account not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.post(
  "/admin/social/x/oauth/start",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthenticated user" });
        return;
      }

      const tenantId = resolveTenantId(req);
      const isPlatformScope = isPlatformSocialScope(req);
      if (!isPlatformScope && !tenantId) {
        res.status(400).json({ error: getSocialScopeErrorMessage(req) });
        return;
      }

      const clientId = getScopedRequiredEnv(
        isPlatformScope,
        ["X_OAUTH_CLIENT_ID"],
        ["PLATFORM_X_OAUTH_CLIENT_ID"],
      );
      const clientSecret = getScopedRequiredEnv(
        isPlatformScope,
        ["X_OAUTH_CLIENT_SECRET"],
        ["PLATFORM_X_OAUTH_CLIENT_SECRET"],
      );

      const { TwitterApi } = await import("twitter-api-v2");
      const client = new TwitterApi({ clientId, clientSecret });
      const callbackUrl = getXCallbackUrl(req);
      const returnPath = sanitizeReturnPath(req.body?.returnPath);
      const authLink = client.generateOAuth2AuthLink(callbackUrl, {
        scope: [...X_OAUTH_SCOPES],
      });

      const stateHash = sha256(authLink.state);
      const expiresAt = new Date(Date.now() + X_STATE_TTL_MS).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from(isPlatformScope ? "platform_x_oauth_states" : "x_oauth_states")
        .insert(
          isPlatformScope
            ? {
              created_by_user_id: req.userId,
              state_hash: stateHash,
              code_verifier: authLink.codeVerifier,
              return_path: returnPath,
              expires_at: expiresAt,
            }
            : {
              tenant_id: tenantId,
              created_by_user_id: req.userId,
              state_hash: stateHash,
              code_verifier: authLink.codeVerifier,
              return_path: returnPath,
              expires_at: expiresAt,
            },
        );

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      res.json({ authUrl: authLink.url, callbackUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/admin/social/x/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const appOrigin = getPublicAppOrigin(req);
    const fallbackReturnPath = "/admin/social?tab=accounts";
    const fallbackRedirect = (status: string, message?: string) => {
      const url = new URL(fallbackReturnPath, appOrigin);
      url.searchParams.set("x_oauth", status);
      if (message) url.searchParams.set("message", message);
      res.redirect(url.toString());
    };

    try {
      const oauthError = String(req.query.error || "").trim();
      const oauthErrorDescription = String(req.query.error_description || "").trim();
      const state = String(req.query.state || "").trim();
      const code = String(req.query.code || "").trim();

      if (!state) {
        fallbackRedirect("error", "missing_state");
        return;
      }

      const stateHash = sha256(state);
      const nowIso = new Date().toISOString();
      const { data: tenantState, error: tenantStateError } = await supabaseAdmin
        .from("x_oauth_states")
        .select("id, tenant_id, code_verifier, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const { data: platformState, error: platformStateError } = await supabaseAdmin
        .from("platform_x_oauth_states")
        .select("id, code_verifier, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const pendingState = tenantState || platformState;
      const tenantScopeTenantId = tenantState?.tenant_id || null;
      const isPlatformScope = !!platformState;
      const stateError = tenantStateError || platformStateError;

      if (stateError || !pendingState) {
        fallbackRedirect("error", "invalid_or_expired_state");
        return;
      }

      const returnPath = sanitizeReturnPath(pendingState.return_path);
      const redirectWith = (status: string, message?: string, connectedCount?: number) => {
        const redirectUrl = new URL(returnPath, appOrigin);
        redirectUrl.searchParams.set("x_oauth", status);
        if (message) redirectUrl.searchParams.set("message", message);
        if (typeof connectedCount === "number") redirectUrl.searchParams.set("connected", String(connectedCount));
        res.redirect(redirectUrl.toString());
      };

      await supabaseAdmin
        .from(isPlatformScope ? "platform_x_oauth_states" : "x_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", pendingState.id)
        .is("used_at", null);

      if (oauthError) {
        redirectWith("error", oauthErrorDescription || oauthError);
        return;
      }

      if (!code) {
        redirectWith("error", "missing_code");
        return;
      }

      const codeVerifier = String(pendingState.code_verifier || "").trim();
      if (!codeVerifier) {
        redirectWith("error", "missing_code_verifier");
        return;
      }

      const clientId = getScopedRequiredEnv(
        isPlatformScope,
        ["X_OAUTH_CLIENT_ID"],
        ["PLATFORM_X_OAUTH_CLIENT_ID"],
      );
      const clientSecret = getScopedRequiredEnv(
        isPlatformScope,
        ["X_OAUTH_CLIENT_SECRET"],
        ["PLATFORM_X_OAUTH_CLIENT_SECRET"],
      );
      const callbackUrl = getXCallbackUrl(req);

      const { TwitterApi } = await import("twitter-api-v2");
      const client = new TwitterApi({ clientId, clientSecret });
      const loginResult = await client.loginWithOAuth2({ code, codeVerifier, redirectUri: callbackUrl });

      const accessToken = String(loginResult.accessToken || "").trim();
      const refreshToken = String(loginResult.refreshToken || "").trim();
      if (!accessToken || !refreshToken) {
        redirectWith("error", "missing_x_tokens");
        return;
      }

      const profile = await fetchXProfile(accessToken);

      const expiresAt = loginResult.expiresIn && loginResult.expiresIn > 0
        ? new Date(Date.now() + loginResult.expiresIn * 1000).toISOString()
        : null;

      const encryptedCredentials = encryptCredentials({
        tokenType: "oauth2",
        accessToken,
        refreshToken,
      });

      const accountPayload = {
        platform: "x",
        encrypted_credentials: encryptedCredentials,
        profile_name: `@${profile.username}`,
        page_id: profile.id,
        page_name: profile.name,
        expires_at: expiresAt,
        is_active: true,
        connection_method: "x_oauth",
        token_metadata: {
          type: "x_oauth2_user_token",
          oauth_flow: "x_oauth2",
          connected_at: new Date().toISOString(),
          expires_in_seconds: loginResult.expiresIn ?? null,
        },
        updated_at: new Date().toISOString(),
      };

      const accountTable = isPlatformScope ? "platform_social_accounts" : "social_accounts";
      const scopedPayload = isPlatformScope
        ? accountPayload
        : { ...accountPayload, tenant_id: tenantScopeTenantId };

      let findQuery = supabaseAdmin
        .from(accountTable)
        .select("id")
        .eq("platform", "x")
        .eq("page_id", profile.id)
        .limit(1);

      if (!isPlatformScope) {
        findQuery = findQuery.eq("tenant_id", tenantScopeTenantId);
      }

      const { data: existingAccount, error: findError } = await findQuery.maybeSingle();
      if (findError) {
        throw new Error(findError.message);
      }

      if (existingAccount?.id) {
        let updateQuery = supabaseAdmin
          .from(accountTable)
          .update(scopedPayload)
          .eq("id", existingAccount.id);

        if (!isPlatformScope) {
          updateQuery = updateQuery.eq("tenant_id", tenantScopeTenantId);
        }

        const { error: updateError } = await updateQuery;
        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from(accountTable)
          .insert(scopedPayload);
        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      redirectWith("success", undefined, 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "oauth_callback_failed";
      fallbackRedirect("error", message);
    }
  },
);

router.delete(
  "/admin/social/x/oauth/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const tenantId = resolveTenantId(req);
    const isPlatformScope = isPlatformSocialScope(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const { id } = req.params;
    let deleteQuery = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .delete()
      .eq("id", id)
      .eq("platform", "x");

    if (!isPlatformScope) {
      deleteQuery = deleteQuery.eq("tenant_id", tenantId!);
    }

    const { error } = await deleteQuery;

    if (error) {
      res.status(404).json({ error: "X account not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.post(
  "/admin/social/google-business/oauth/start",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthenticated user" });
        return;
      }

      const tenantId = resolveTenantId(req);
      const isPlatformScope = isPlatformSocialScope(req);
      if (!isPlatformScope && !tenantId) {
        res.status(400).json({ error: getSocialScopeErrorMessage(req) });
        return;
      }

      const clientId = getScopedRequiredEnv(
        isPlatformScope,
        ["GOOGLE_BUSINESS_OAUTH_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_ID"],
        ["PLATFORM_GOOGLE_BUSINESS_OAUTH_CLIENT_ID", "PLATFORM_GOOGLE_BUSINESS_CLIENT_ID"],
      );
      getScopedRequiredEnv(
        isPlatformScope,
        ["GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET", "GOOGLE_BUSINESS_CLIENT_SECRET"],
        ["PLATFORM_GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET", "PLATFORM_GOOGLE_BUSINESS_CLIENT_SECRET"],
      );

      const callbackUrl = getGoogleBusinessCallbackUrl(req);
      const returnPath = sanitizeReturnPath(req.body?.returnPath);
      const state = crypto.randomBytes(32).toString("hex");
      const stateHash = sha256(state);
      const expiresAt = new Date(Date.now() + GOOGLE_BUSINESS_STATE_TTL_MS).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from(isPlatformScope ? "platform_google_business_oauth_states" : "google_business_oauth_states")
        .insert(
          isPlatformScope
            ? {
              created_by_user_id: req.userId,
              state_hash: stateHash,
              return_path: returnPath,
              expires_at: expiresAt,
            }
            : {
              tenant_id: tenantId,
              created_by_user_id: req.userId,
              state_hash: stateHash,
              return_path: returnPath,
              expires_at: expiresAt,
            },
        );

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", GOOGLE_BUSINESS_OAUTH_SCOPES.join(" "));
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");

      res.json({ authUrl: authUrl.toString(), callbackUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/admin/social/google-business/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const appOrigin = getPublicAppOrigin(req);
    const fallbackReturnPath = "/admin/social?tab=accounts";
    const fallbackRedirect = (status: string, message?: string) => {
      const url = new URL(fallbackReturnPath, appOrigin);
      url.searchParams.set("google_business_oauth", status);
      if (message) url.searchParams.set("message", message);
      res.redirect(url.toString());
    };

    try {
      const oauthError = String(req.query.error || "").trim();
      const oauthErrorDescription = String(req.query.error_description || "").trim();
      const state = String(req.query.state || "").trim();
      const code = String(req.query.code || "").trim();

      if (!state) {
        fallbackRedirect("error", "missing_state");
        return;
      }

      const stateHash = sha256(state);
      const nowIso = new Date().toISOString();
      const { data: tenantState, error: tenantStateError } = await supabaseAdmin
        .from("google_business_oauth_states")
        .select("id, tenant_id, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const { data: platformState, error: platformStateError } = await supabaseAdmin
        .from("platform_google_business_oauth_states")
        .select("id, return_path, expires_at")
        .eq("state_hash", stateHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();

      const pendingState = tenantState || platformState;
      const tenantScopeTenantId = tenantState?.tenant_id || null;
      const isPlatformScope = !!platformState;
      const stateError = tenantStateError || platformStateError;

      if (stateError || !pendingState) {
        fallbackRedirect("error", "invalid_or_expired_state");
        return;
      }

      const returnPath = sanitizeReturnPath(pendingState.return_path);
      const redirectWith = (status: string, message?: string, connectedCount?: number) => {
        const redirectUrl = new URL(returnPath, appOrigin);
        redirectUrl.searchParams.set("google_business_oauth", status);
        if (message) redirectUrl.searchParams.set("message", message);
        if (typeof connectedCount === "number") redirectUrl.searchParams.set("connected", String(connectedCount));
        res.redirect(redirectUrl.toString());
      };

      await supabaseAdmin
        .from(isPlatformScope ? "platform_google_business_oauth_states" : "google_business_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", pendingState.id)
        .is("used_at", null);

      if (oauthError) {
        redirectWith("error", oauthErrorDescription || oauthError);
        return;
      }

      if (!code) {
        redirectWith("error", "missing_code");
        return;
      }

      const clientId = getScopedRequiredEnv(
        isPlatformScope,
        ["GOOGLE_BUSINESS_OAUTH_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_ID"],
        ["PLATFORM_GOOGLE_BUSINESS_OAUTH_CLIENT_ID", "PLATFORM_GOOGLE_BUSINESS_CLIENT_ID"],
      );
      const clientSecret = getScopedRequiredEnv(
        isPlatformScope,
        ["GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET", "GOOGLE_BUSINESS_CLIENT_SECRET"],
        ["PLATFORM_GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET", "PLATFORM_GOOGLE_BUSINESS_CLIENT_SECRET"],
      );
      const callbackUrl = getGoogleBusinessCallbackUrl(req);
      const tokenResult = await exchangeGoogleBusinessCodeForTokens({
        code,
        clientId,
        clientSecret,
        redirectUri: callbackUrl,
      });
      const locations = await fetchGoogleBusinessLocations(tokenResult.accessToken);

      if (locations.length === 0) {
        redirectWith("error", "no_business_locations_found");
        return;
      }

      const expiresAt = tokenResult.expiresIn && tokenResult.expiresIn > 0
        ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
        : null;

      const accountTable = isPlatformScope ? "platform_social_accounts" : "social_accounts";

      for (const location of locations) {
        const encryptedCredentials = encryptCredentials({
          refreshToken: tokenResult.refreshToken,
        });

        const accountPayload = {
          platform: "google_business",
          encrypted_credentials: encryptedCredentials,
          profile_name: location.locationName,
          page_id: location.accountName,
          page_name: location.locationName,
          instagram_business_id: location.locationId,
          expires_at: expiresAt,
          is_active: true,
          connection_method: "google_business_oauth",
          token_metadata: {
            type: "google_business_refresh_token",
            oauth_flow: "google_business_oauth",
            connected_at: new Date().toISOString(),
            access_token_expires_in_seconds: tokenResult.expiresIn,
          },
          updated_at: new Date().toISOString(),
        };

        const scopedPayload = isPlatformScope
          ? accountPayload
          : { ...accountPayload, tenant_id: tenantScopeTenantId };

        let findQuery = supabaseAdmin
          .from(accountTable)
          .select("id")
          .eq("platform", "google_business")
          .eq("page_id", location.accountName)
          .eq("instagram_business_id", location.locationId)
          .limit(1);

        if (!isPlatformScope) {
          findQuery = findQuery.eq("tenant_id", tenantScopeTenantId);
        }

        const { data: existingAccount, error: findError } = await findQuery.maybeSingle();
        if (findError) {
          throw new Error(findError.message);
        }

        if (existingAccount?.id) {
          let updateQuery = supabaseAdmin
            .from(accountTable)
            .update(scopedPayload)
            .eq("id", existingAccount.id);

          if (!isPlatformScope) {
            updateQuery = updateQuery.eq("tenant_id", tenantScopeTenantId);
          }

          const { error: updateError } = await updateQuery;
          if (updateError) {
            throw new Error(updateError.message);
          }
        } else {
          const { error: insertError } = await supabaseAdmin
            .from(accountTable)
            .insert(scopedPayload);
          if (insertError) {
            throw new Error(insertError.message);
          }
        }
      }

      redirectWith("success", undefined, locations.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "oauth_callback_failed";
      fallbackRedirect("error", message);
    }
  },
);

router.delete(
  "/admin/social/google-business/oauth/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const tenantId = resolveTenantId(req);
    const isPlatformScope = isPlatformSocialScope(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const { id } = req.params;
    let deleteQuery = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .delete()
      .eq("id", id)
      .eq("platform", "google_business");

    if (!isPlatformScope) {
      deleteQuery = deleteQuery.eq("tenant_id", tenantId!);
    }

    const { error } = await deleteQuery;

    if (error) {
      res.status(404).json({ error: "Google Business account not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.get(
  "/admin/social/context",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (isPlatformSocialScope(req)) {
      res.json({
        tenantId: null,
        scope: "platform_marketing",
        socialChannels: SUPPORTED_SOCIAL_CHANNELS,
        postTypes: SOCIAL_POST_TYPES,
        permissions: FACEBOOK_POST_PERMISSIONS.filter((permission) => hasFacebookPermission(req, permission)),
        websitePromotion: {
          enabled: false,
          disabledMessage: "Website Promotion Post is only available in tenant social workspaces.",
        },
      });
      return;
    }

    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const pages = await listPromotionPages(tenantId);
    const availablePromotionPages = pages.filter((p) => p.status === "published" && !!p.pageUrl);

    res.json({
      tenantId,
      scope: req.userRole === "super_admin" ? "platform_marketing" : "tenant_business",
      socialChannels: SUPPORTED_SOCIAL_CHANNELS,
      postTypes: SOCIAL_POST_TYPES,
      permissions: FACEBOOK_POST_PERMISSIONS.filter((permission) => hasFacebookPermission(req, permission)),
      websitePromotion: {
        enabled: availablePromotionPages.length > 0,
        disabledMessage: availablePromotionPages.length === 0
          ? "Website required to use Website Promotion Post"
          : null,
      },
    });
  },
);

router.get(
  "/admin/social/website-pages",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (isPlatformSocialScope(req)) {
      res.json({
        enabled: false,
        disabledMessage: "Website Promotion Post is only available in tenant social workspaces.",
        pages: [],
      });
      return;
    }

    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const pages = await listPromotionPages(tenantId);
    const publishedPages = pages.filter((p) => p.status === "published" && !!p.pageUrl);

    res.json({
      enabled: publishedPages.length > 0,
      disabledMessage: publishedPages.length === 0
        ? "Website required to use Website Promotion Post"
        : null,
      pages: publishedPages,
    });
  },
);

router.get(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    let query = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .select("id, platform, page_id, page_name, instagram_business_id, profile_name, expires_at, is_active, auto_post, created_at")
      .order("created_at", { ascending: false });

    if (!isPlatformScope) {
      query = query.eq("tenant_id", tenantId!);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  },
);

router.post(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { platform, credentials, profileName, pageId, pageName, instagramBusinessId } = req.body;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);

    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    if (!platform || !credentials || !profileName) {
      res.status(400).json({ error: "platform, credentials, and profileName are required" });
      return;
    }

    if (!isSupportedPlatform(platform)) {
      res.status(400).json({ error: `Platform "${platform}" is not supported. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` });
      return;
    }

    const encrypted = encryptCredentials(credentials);

    const payload = {
      platform,
      encrypted_credentials: encrypted,
      profile_name: profileName,
      page_id: pageId || null,
      page_name: pageName || null,
      instagram_business_id: instagramBusinessId || null,
    };

    const { data, error } = await supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .insert(isPlatformScope ? payload : { ...payload, tenant_id: tenantId })
      .select("id, platform, profile_name, page_id, page_name, instagram_business_id, is_active, auto_post, created_at")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  },
);

router.patch(
  "/admin/social/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { id } = req.params;
    const {
      isActive,
      autoPost,
      profileName,
      pageId,
      pageName,
      instagramBusinessId,
      credentials,
    } = req.body;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (isActive !== undefined) updates.is_active = isActive;
    if (autoPost !== undefined) updates.auto_post = autoPost;
    if (profileName !== undefined) {
      const trimmed = String(profileName).trim();
      if (!trimmed) {
        res.status(400).json({ error: "profileName cannot be empty" });
        return;
      }
      updates.profile_name = trimmed;
    }
    if (pageId !== undefined) updates.page_id = pageId ? String(pageId).trim() : null;
    if (pageName !== undefined) updates.page_name = pageName ? String(pageName).trim() : null;
    if (instagramBusinessId !== undefined) {
      updates.instagram_business_id = instagramBusinessId ? String(instagramBusinessId).trim() : null;
    }
    if (credentials !== undefined) {
      if (typeof credentials !== "object" || credentials === null || Array.isArray(credentials)) {
        res.status(400).json({ error: "credentials must be an object" });
        return;
      }

      const credentialValues = Object.values(credentials as Record<string, unknown>);
      if (credentialValues.length === 0 || credentialValues.some((value) => !String(value || "").trim())) {
        res.status(400).json({ error: "credentials must include non-empty values" });
        return;
      }

      updates.encrypted_credentials = encryptCredentials(credentials as Record<string, string>);
    }

    let query = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .update(updates)
      .eq("id", id);

    if (!isPlatformScope) {
      query = query.eq("tenant_id", tenantId!);
    }

    const { data, error } = await query
      .select("id, platform, profile_name, page_id, page_name, instagram_business_id, is_active, auto_post")
      .single();

    if (error) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json(data);
  },
);

router.delete(
  "/admin/social/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { id } = req.params;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    let query = supabaseAdmin
      .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
      .delete()
      .eq("id", id);

    if (!isPlatformScope) {
      query = query.eq("tenant_id", tenantId!);
    }

    const { error } = await query;

    if (error) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.get(
  "/admin/social/posts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { status, platform, page = "1", limit = "20", postType } = req.query as Record<string, string>;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from(isPlatformScope ? "platform_social_posts" : "social_posts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);
    if (!isPlatformScope) {
      query = query.eq("tenant_id", tenantId!);
    }
    if (status) query = query.eq("status", status);
    if (platform) query = query.eq("platform", platform);
    if (postType) query = query.eq("post_type", postType);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ posts: data, total: count ?? 0 });
  },
);

router.post(
  "/admin/social/post",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_create")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const {
      platform,
      content,
      imageUrl,
      videoUrl,
      linkUrl,
      scheduledFor,
      postType: rawPostType,
      websitePageId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    } = req.body;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);

    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    if (!platform || !content) {
      res.status(400).json({ error: "platform and content are required" });
      return;
    }

    if (!isSupportedPlatform(platform)) {
      res.status(400).json({ error: `Platform "${platform}" is not supported. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` });
      return;
    }

    const postType = coercePostType(rawPostType);
    if (postType === "website_promotion" && platform !== "facebook") {
      res.status(400).json({ error: "Website Promotion Post is currently supported for Facebook only" });
      return;
    }

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduled = scheduledDate && scheduledDate > new Date();

    if (isScheduled && !hasFacebookPermission(req, "facebook_post_schedule")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    if (!isScheduled && !hasFacebookPermission(req, "facebook_post_publish")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const campaignDefault = isPlatformScope
      ? `${postType}-tradeworkdesk-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
      : await buildDefaultCampaign(tenantId!, postType);
    const normalizedUtm = {
      source: String(utmSource || "facebook").trim() || "facebook",
      medium: String(utmMedium || "social").trim() || "social",
      campaign: String(utmCampaign || campaignDefault).trim() || campaignDefault,
      content: utmContent ? String(utmContent).trim() : null,
    };

    let resolvedWebsitePageId: string | null = null;
    let resolvedWebsitePageUrl: string | null = null;
    let finalLinkUrl: string | null = linkUrl ? String(linkUrl) : null;

    if (postType === "website_promotion" && isPlatformScope) {
      res.status(400).json({ error: "Website Promotion Post is not available in superadmin social workspace" });
      return;
    }

    if (postType === "website_promotion") {
      if (!websitePageId) {
        res.status(400).json({ error: "websitePageId is required for Website Promotion Post" });
        return;
      }

      const page = await resolvePromotionPageUrl({
        tenantId: tenantId!,
        websitePageId: String(websitePageId),
        requirePublished: true,
      });

      resolvedWebsitePageId = page.pageId;
      resolvedWebsitePageUrl = page.pageUrl;
      finalLinkUrl = buildUtmTaggedUrl(page.pageUrl, normalizedUtm);
    }

    const { data: post, error: insertError } = await supabaseAdmin
      .from(isPlatformScope ? "platform_social_posts" : "social_posts")
      .insert(isPlatformScope
        ? {
          created_by_user_id: req.userId || null,
          platform,
          content,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
          link_url: finalLinkUrl,
          post_type: postType,
          website_page_id: resolvedWebsitePageId,
          website_page_url: resolvedWebsitePageUrl,
          final_link_url: finalLinkUrl,
          utm_source: normalizedUtm.source,
          utm_medium: normalizedUtm.medium,
          utm_campaign: normalizedUtm.campaign,
          utm_content: normalizedUtm.content,
          scheduled_for: scheduledDate ? scheduledDate.toISOString() : null,
          status: isScheduled ? "scheduled" : "draft",
        }
        : {
          tenant_id: tenantId,
          created_by_user_id: req.userId || null,
          platform,
          content,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
          link_url: finalLinkUrl,
          post_type: postType,
          website_page_id: resolvedWebsitePageId,
          website_page_url: resolvedWebsitePageUrl,
          final_link_url: finalLinkUrl,
          utm_source: normalizedUtm.source,
          utm_medium: normalizedUtm.medium,
          utm_campaign: normalizedUtm.campaign,
          utm_content: normalizedUtm.content,
          scheduled_for: scheduledDate ? scheduledDate.toISOString() : null,
          status: isScheduled ? "scheduled" : "draft",
        })
      .select()
      .single();

    if (insertError || !post) {
      res.status(500).json({ error: insertError?.message ?? "Failed to create post" });
      return;
    }

    if (!isScheduled) {
      let accountQuery = supabaseAdmin
        .from(isPlatformScope ? "platform_social_accounts" : "social_accounts")
        .select("*")
        .eq("platform", platform)
        .eq("is_active", true)
        .limit(1);

      if (!isPlatformScope) {
        accountQuery = accountQuery.eq("tenant_id", tenantId!);
      }

      const { data: account } = await accountQuery.single();

      if (!account) {
        await supabaseAdmin
          .from(isPlatformScope ? "platform_social_posts" : "social_posts")
          .update({ status: "failed", error: `No active ${platform} account found`, updated_at: new Date().toISOString() })
          .eq("id", post.id);
        res.status(400).json({ error: `No active ${platform} account connected` });
        return;
      }

      try {
        const result = await dispatchPost(post, account);
        const { data: updated } = await supabaseAdmin
          .from(isPlatformScope ? "platform_social_posts" : "social_posts")
          .update({
            status: "posted",
            post_id: result.postId || null,
            post_url: result.postUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id)
          .select()
          .single();
        res.json(updated);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabaseAdmin
          .from(isPlatformScope ? "platform_social_posts" : "social_posts")
          .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
          .eq("id", post.id);
        res.status(500).json({ error: message });
        return;
      }
    }

    res.json(post);
  },
);

router.post(
  "/admin/social/bulk-schedule",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_schedule")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { posts, intervalMinutes = 60 } = req.body;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);

    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    if (!Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "posts array is required" });
      return;
    }

    const now = new Date();
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < posts.length; i += 1) {
      const p = posts[i] as Record<string, unknown>;
      const postType = coercePostType(p.postType);
      const platform = String(p.platform || "");
      const websitePageId = p.websitePageId ? String(p.websitePageId) : null;
      const campaignDefault = isPlatformScope
        ? `${postType}-tradeworkdesk-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
        : await buildDefaultCampaign(tenantId!, postType);
      const normalizedUtm = {
        source: String(p.utmSource || "facebook").trim() || "facebook",
        medium: String(p.utmMedium || "social").trim() || "social",
        campaign: String(p.utmCampaign || campaignDefault).trim() || campaignDefault,
        content: p.utmContent ? String(p.utmContent).trim() : null,
      };

      let resolvedWebsitePageId: string | null = null;
      let resolvedWebsitePageUrl: string | null = null;
      let finalLinkUrl: string | null = p.linkUrl ? String(p.linkUrl) : null;

      if (postType === "website_promotion" && isPlatformScope) {
        res.status(400).json({ error: "Website Promotion Post is not available in superadmin social workspace" });
        return;
      }

      if (postType === "website_promotion") {
        if (platform !== "facebook") {
          res.status(400).json({ error: "Website Promotion Post is currently supported for Facebook only" });
          return;
        }
        if (!websitePageId) {
          res.status(400).json({ error: "websitePageId is required for Website Promotion Post" });
          return;
        }

        const page = await resolvePromotionPageUrl({
          tenantId: tenantId!,
          websitePageId,
          requirePublished: true,
        });
        resolvedWebsitePageId = page.pageId;
        resolvedWebsitePageUrl = page.pageUrl;
        finalLinkUrl = buildUtmTaggedUrl(page.pageUrl, normalizedUtm);
      }

      rows.push(isPlatformScope
        ? {
          created_by_user_id: req.userId || null,
          platform,
          content: p.content,
          image_url: p.imageUrl || null,
          video_url: p.videoUrl || null,
          link_url: finalLinkUrl,
          post_type: postType,
          website_page_id: resolvedWebsitePageId,
          website_page_url: resolvedWebsitePageUrl,
          final_link_url: finalLinkUrl,
          utm_source: normalizedUtm.source,
          utm_medium: normalizedUtm.medium,
          utm_campaign: normalizedUtm.campaign,
          utm_content: normalizedUtm.content,
          scheduled_for: new Date(now.getTime() + i * (intervalMinutes as number) * 60 * 1000).toISOString(),
          status: "scheduled",
          entity_type: p.entityType || null,
          entity_id: p.entityId || null,
        }
        : {
          tenant_id: tenantId,
          created_by_user_id: req.userId || null,
          platform,
          content: p.content,
          image_url: p.imageUrl || null,
          video_url: p.videoUrl || null,
          link_url: finalLinkUrl,
          post_type: postType,
          website_page_id: resolvedWebsitePageId,
          website_page_url: resolvedWebsitePageUrl,
          final_link_url: finalLinkUrl,
          utm_source: normalizedUtm.source,
          utm_medium: normalizedUtm.medium,
          utm_campaign: normalizedUtm.campaign,
          utm_content: normalizedUtm.content,
          scheduled_for: new Date(now.getTime() + i * (intervalMinutes as number) * 60 * 1000).toISOString(),
          status: "scheduled",
          entity_type: p.entityType || null,
          entity_id: p.entityId || null,
        });
    }

    const { data, error } = await supabaseAdmin
      .from(isPlatformScope ? "platform_social_posts" : "social_posts")
      .insert(rows)
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ scheduled: data?.length ?? 0, posts: data });
  },
);

router.get(
  "/admin/social/suggestions",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const isPlatformScope = isPlatformSocialScope(req);
      const tenantId = resolveTenantId(req);
      if (!isPlatformScope && !tenantId) {
        res.status(400).json({ error: getSocialScopeErrorMessage(req) });
        return;
      }

      const items: SuggestionItem[] = [];

      const recentJobs = isPlatformScope
        ? []
        : (await supabaseAdmin
          .from("jobs")
          .select("id, job_type, description, status")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(5)).data;

      for (const job of recentJobs ?? []) {
        items.push({
          entityType: "article",
          entityId: `job-${job.id}`,
          title: `${job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)} Job ${job.status === "completed" ? "Completed" : "Update"}`,
          description: job.description || `A ${job.job_type} job is ${job.status}`,
        });
      }

      const recentCustomers = isPlatformScope
        ? []
        : (await supabaseAdmin
          .from("customers")
          .select("id, first_name, last_name, city")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(3)).data;

      for (const customer of recentCustomers ?? []) {
        const fullName = `${customer.first_name} ${customer.last_name}`;
        items.push({
          entityType: "article",
          entityId: `customer-${customer.id}`,
          title: `Customer Spotlight: ${fullName}`,
          description: `Highlight the work done for ${fullName}${customer.city ? ` in ${customer.city}` : ""}`,
        });
      }

      if (items.length === 0) {
        items.push(
          {
            entityType: "product",
            entityId: "tradeworkdesk-platform",
            title: "TradeWorkDesk Platform",
            description: "Manage jobs, create certificates, and track service records digitally",
          },
          {
            entityType: "article",
            entityId: "boiler-service-tips",
            title: "Essential Boiler Maintenance Tips",
            description: "Key maintenance tips to keep boilers running efficiently",
          },
        );
      }

      const platforms = (req.query.platforms as string)?.split(",") || ["x", "facebook", "instagram"];
      const suggestions = await generatePostSuggestions(items, platforms);

      // Attach a recent gallery photo to each suggestion
      const photoRows = isPlatformScope
        ? []
        : (await supabaseAdmin
          .from("file_attachments")
          .select("storage_path")
          .eq("tenant_id", tenantId)
          .like("file_type", "image/%")
          .order("created_at", { ascending: false })
          .limit(10)).data;

      const photoUrls = (photoRows ?? []).flatMap((p) => {
        const { data } = supabaseAdmin.storage
          .from("service-photos")
          .getPublicUrl((p as { storage_path: string }).storage_path);
        return data.publicUrl ? [data.publicUrl] : [];
      });

      res.json(
        suggestions.map((s) =>
          photoUrls.length > 0
            ? { ...s, imageUrl: photoUrls[Math.floor(Math.random() * photoUrls.length)] }
            : s,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[social] Suggestions error:", message);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  },
);

router.post(
  "/admin/social/generate-image",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    try {
      const url = await generateSocialImage(prompt);
      res.json({ url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[social] Image generation error:", message);
      res.status(500).json({ error: "Failed to generate image" });
    }
  },
);

router.patch(
  "/admin/social/posts/:id/dismiss",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;
    const isPlatformScope = isPlatformSocialScope(req);
    const tenantId = resolveTenantId(req);
    if (!isPlatformScope && !tenantId) {
      res.status(400).json({ error: getSocialScopeErrorMessage(req) });
      return;
    }

    let query = supabaseAdmin
      .from(isPlatformScope ? "platform_social_posts" : "social_posts")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!isPlatformScope) {
      query = query.eq("tenant_id", tenantId!);
    }

    const { data, error } = await query.select().single();

    if (error) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(data);
  },
);

export default router;
