import { supabase } from './supabase';

const originalFetch = window.fetch;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    cachedToken = session.access_token;
    tokenExpiresAt = (session.expires_at ?? 0) * 1000;
  } else {
    cachedToken = null;
    tokenExpiresAt = 0;
  }
});

supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    cachedToken = data.session.access_token;
    tokenExpiresAt = (data.session.expires_at ?? 0) * 1000;
  }
});

function getTokenWithTimeout(timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(cachedToken), timeoutMs);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timer);
      if (data.session) {
        cachedToken = data.session.access_token;
        tokenExpiresAt = (data.session.expires_at ?? 0) * 1000;
      }
      resolve(data.session?.access_token ?? null);
    }).catch(() => {
      clearTimeout(timer);
      resolve(cachedToken);
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
