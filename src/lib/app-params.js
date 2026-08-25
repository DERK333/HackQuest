// Bootstrap params shared with auth-flow pages (e.g. the MCP OAuth consent
// page). appId is static from the build env; token is the SDK-persisted access
// token, read lazily so a freshly issued session is picked up.

const CANDIDATE_KEYS = [
  "base44_token",
  "base44:token",
  "base44_access_token",
  "access_token",
  "token",
];

function readToken() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    for (const key of CANDIDATE_KEYS) {
      const v = window.localStorage.getItem(key);
      if (v) return v;
    }
    // Fallback: the SDK may key storage by appId — scan for a JWT-shaped value.
    for (let i = 0; i < window.localStorage.length; i++) {
      const v = window.localStorage.getItem(window.localStorage.key(i));
      if (v && v.startsWith("eyJ") && v.split(".").length === 3) return v;
    }
  } catch {
    /* localStorage unavailable */
  }
  return null;
}

export const appParams = {
  appId: import.meta.env.VITE_BASE44_APP_ID,
  get token() {
    return readToken();
  },
};