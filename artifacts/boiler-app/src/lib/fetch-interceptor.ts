import { supabase } from './supabase';

// We intercept the global fetch to attach the Supabase Auth token
// to any requests going to our /api endpoints.
const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
  }

  // Only intercept relative /api calls or fully qualified API calls
  if (url.includes('/api/')) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    
    if (token) {
      init = init || {};
      init.headers = {
        ...init.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }

  return originalFetch(input, init);
};
