import { supabase } from './supabase';

const originalFetch = window.fetch;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenReady: Promise<void>;
let resolveTokenReady: () => void;

tokenReady = new Promise<void>((resolve) => {
  resolveTokenReady = resolve;
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    cachedToken = session.access_token;
    tokenExpiresAt = (session.expires_at ?? 0) * 1000;
    resolveTokenReady();
  }
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

async function refreshTokenFromSession(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      cachedToken = data.session.access_token;
      tokenExpiresAt = (data.session.expires_at ?? 0) * 1000;
      return cachedToken;
    }
  } catch {}
  return null;
}

function getTokenWithTimeout(timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(cachedToken), timeoutMs);

    tokenReady.then(() => {
      clearTimeout(timer);
      if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
        resolve(cachedToken);
      } else {
        refreshTokenFromSession().then(resolve);
      }
    });
  });
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
      init.headers = merged;
    }
  }

  return originalFetch(input, init);
};
