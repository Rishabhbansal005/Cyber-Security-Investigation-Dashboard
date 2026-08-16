import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let cachedToken: string | null = null;
let cachedTokenAt = 0;

apiClient.interceptors.request.use(async (config) => {
  try {
    const now = Date.now();
    if (!cachedToken || now - cachedTokenAt > 60000) {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      cachedToken = session?.access_token ?? null;
      cachedTokenAt = now;
    }
    if (cachedToken) {
      config.headers.Authorization = `Bearer ${cachedToken}`;
    }
  } catch {
    // Supabase not configured
  }
  return config;
});

// Global error handling — never redirect on 401/403, only log.
// Redirecting on every 401 causes infinite reload loops when Supabase is not configured.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      // Silently ignore auth errors — the backend is in dev mode, not all
      // endpoints require a real Supabase token. Do NOT redirect here.
      console.warn(`[CCID] API request returned ${status} — request skipped silently.`);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
