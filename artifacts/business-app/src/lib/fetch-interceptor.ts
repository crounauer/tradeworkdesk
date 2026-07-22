import { supabase } from './supabase';

const originalFetch = window.fetch;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenReady: Promise<void>;
let resolveTokenReady: () => void;

tokenReady = new Promise<void>((resolve) => {
  resolveTokenReady = resolve;
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    cachedToken = session.access_token;
    tokenExpiresAt = (session.expires_at ?? 0) * 1000;
  } else {
    cachedToken = null;
    tokenExpiresAt = 0;
  }
  resolveTokenReady();
});

function getTokenWithTimeout(timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(cachedToken), timeoutMs);

    tokenReady.then(() => {
      clearTimeout(timer);
      resolve(cachedToken);
    });
  });
}

function isCommunityApiRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.startsWith('/api/community');
  } catch {
    return url.includes('/api/community');
  }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
  }

  if (url.includes('/api/')) {
    let token: string | null = null;

    if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
      token = cachedToken;
    } else {
      token = await getTokenWithTimeout(3000);
    }

    if (token) {
      init = init || {};
      const merged = new Headers(init.headers);
      merged.set('Authorization', `Bearer ${token}`);

      const communityTenantId = localStorage.getItem('superadmin_community_tenant_id');
      const readOnlyTenantId = localStorage.getItem('superadmin_readonly_tenant_id');
      const platformCommunityTenantId = localStorage.getItem('superadmin_platform_community_tenant_id');
      if (communityTenantId) {
        merged.set('x-superadmin-tenant-id', communityTenantId);
        merged.set('x-superadmin-readonly', '0');
      } else if (readOnlyTenantId) {
        merged.set('x-superadmin-tenant-id', readOnlyTenantId);
        merged.set('x-superadmin-readonly', '1');
      } else if (platformCommunityTenantId && isCommunityApiRequest(url)) {
        merged.set('x-superadmin-tenant-id', platformCommunityTenantId);
        merged.set('x-superadmin-readonly', '0');
      }

      init.headers = merged;
    }
  }

  return originalFetch(input, init);
};
