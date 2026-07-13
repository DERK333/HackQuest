// app-params.js — minimal shim kept for legacy references
// (base44 params were removed; all config now comes from VITE_* env vars via firebase.js)
export const appParams = {
  appId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  token: null,
  functionsVersion: null,
  appBaseUrl: '',
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
};
