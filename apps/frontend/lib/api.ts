'use server'

import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://backend:4000/api';

/**
 * loginAction
 * -----------
 * Server Action used by login form submissions.
 *
 * Behavior:
 * - Sends provided username/password to backend /login.
 * - Backend sets an HttpOnly 'auth-token' cookie (not accessible by JS).
 * - To let the UI know the user is logged in, we set a **separate** non-HttpOnly cookie `is-logged`.
 *
 * Why:
 * - Next.js Server Actions allow secure credential handling server-side.
 * - The UI state cookie enables client components to detect login state.
 *
 * @param formData - The posted form data containing username & password.
 * @returns { ok: true } on success, or { error: string } on failure.
 */
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

  /**
   * If backend returned a Set-Cookie header (for auth-token),
   * we update our UI-side cookie to reflect login state.
   */
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) (await cookies()).set('is-logged', '1', { httpOnly: false, sameSite: 'lax' });
  return { ok: true } as const;
}

/**
 * logoutAction
 * ------------
 * Logs the user out by:
 * - Calling backend /logout to clear the actual HttpOnly auth cookie.
 * - Clearing UI state cookie `is-logged` by writing it with an expired timestamp.
 *
 * @returns { ok: true } on success, or { error: string } on failure.
 */
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

/**
 * fetchJSON
 * ---------
 * Helper for API requests requiring JSON responses.
 *
 * Features:
 * - Always includes credentials → ensures session cookie is sent.
 * - Enforces `Content-Type: application/json`.
 * - Disables caching (`cache: 'no-store'`) to always fetch fresh data.
 *
 * @param path - API endpoint path relative to API_BASE.
 * @param init - Optional RequestInit overrides.
 * @throws Error if response status is non-2xx.
 */

export async function fetchJSON(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store'
  });

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
