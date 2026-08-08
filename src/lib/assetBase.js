// Deployment base path: app is served at root (hack-quest.com/) AND at /HackQuest/.
// Static asset URLs must be prefixed accordingly or they 404 on one of the two.
export function assetBase() {
  return window.location.pathname.startsWith('/HackQuest') ? '/HackQuest' : '';
}

export function assetUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${assetBase()}${p}`;
}