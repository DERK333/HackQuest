// Shared HTML-escaping helper for backend functions that interpolate
// user/entity data into HTML email templates. Import from:
//   import { escapeHtml } from "../../shared/escapeHtml.ts";
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}