const BASE_URL = import.meta.env.VITE_API_URL;

function assertBaseUrl() {
  if (!BASE_URL) {
    throw new Error(
      "VITE_API_URL is not set. Add it to frontend/.env for local dev and to Vercel env vars for production."
    );
  }
}

export async function apiGet(path) {
  assertBaseUrl();
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function apiPost(path, body) {
  assertBaseUrl();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}
