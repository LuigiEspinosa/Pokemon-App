'use server'

import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://backend:4000/api';

export async function loginAction(formData: FormData) {
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');

  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  });

  if (!res.ok) {
    const j = await res.json();
    return { error: j.error || 'Login failed' } as const;
  }

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) (await cookies()).set('is-logged', '1', { httpOnly: false, sameSite: 'lax' });
  return { ok: true } as const;
}

export async function logoutAction() {
  const res = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) {
    const j = await res.json();
    return { error: j.error || 'Logout failed' } as const;
  }

  await (await cookies()).set('is-logged', '', { httpOnly: false, sameSite: 'lax', expires: new Date(0) });
  return { ok: true } as const;
}

export async function fetchJSON(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store'
  });

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
