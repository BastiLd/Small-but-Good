export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function withBasePath(path) {
  if (!path) return "";
  if (/^(?:https?:\/\/|data:|blob:)/i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}

// Inverse of withBasePath: turn a real browser pathname (which includes the
// basePath prefix and a trailing slash from trailingSlash:true) into a clean
// app-relative path like "/projekte/my-slug" for route matching.
export function stripBasePath(pathname) {
  if (!pathname) return "/";
  let normalized = pathname;
  if (BASE_PATH && normalized.startsWith(BASE_PATH)) {
    normalized = normalized.slice(BASE_PATH.length);
  }
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  // Drop trailing slash (keep root "/").
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
