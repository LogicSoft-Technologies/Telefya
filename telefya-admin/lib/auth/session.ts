const ACCESS_TOKEN_KEY = "telefya_admin_access_token";
const REFRESH_TOKEN_KEY = "telefya_admin_refresh_token";

export function getAdminAccessToken() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAdminAccessToken(token: string) {
  if (typeof window === "undefined" || !token) return;

  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.dispatchEvent(new Event("telefya-admin-auth-change"));
}

export function getAdminRefreshToken() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveAdminRefreshToken(token: string) {
  if (typeof window === "undefined" || !token) return;

  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  window.dispatchEvent(new Event("telefya-admin-auth-change"));
}