'use server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://backend:4000/api';

export async function fetchJSON(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store'
  });

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
