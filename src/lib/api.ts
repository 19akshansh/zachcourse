export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("session_token");
  const headers = new Headers(options.headers || {});
  
  const userKey = localStorage.getItem("zc_user_key");
  if (userKey) {
    headers.set("x-user-key", userKey);
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}
