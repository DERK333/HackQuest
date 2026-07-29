import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID,
  serverUrl: import.meta.env.VITE_BASE44_APP_BASE_URL || 'https://base44.app',
  appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
});