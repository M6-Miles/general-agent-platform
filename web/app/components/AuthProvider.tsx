'use client';

import {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {apiBaseUrl, apiRequest, clearApiCache, registerAuthRefreshHandler} from '../../lib/api';

type User = {id: string; tenant_id: string; tenant_name?: string | null; email: string; display_name: string; role: string};
type AuthValue = {token: string; user: User | null; ready: boolean; login: (email: string, password: string, tenantSlug?: string) => Promise<void>; register: (tenantSlug: string, tenantName: string, email: string, displayName: string, password: string) => Promise<void>; logout: () => Promise<void>};
const AuthContext = createContext<AuthValue | null>(null);

export default function AuthProvider({children}: {children: React.ReactNode}) {
  // Keep the server and client initial render identical. Browser storage is
  // restored from the HttpOnly refresh cookie after hydration has completed.
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  function clearSession() {
    setToken('');
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    // Clear refresh tokens left behind by previous releases.
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_session_hint');
    clearApiCache();
  }

  function refreshSession(): Promise<string | null> {
    if (refreshPromise.current) return refreshPromise.current;
    refreshPromise.current = apiRequest<{access_token: string; user: User}>(
      apiBaseUrl,
      '/api/v1/auth/refresh',
      undefined,
      {method: 'POST'}
    )
      .then((result) => {
        setToken(result.data.access_token);
        setUser(result.data.user);
        localStorage.setItem('auth_session_hint', '1');
        return result.data.access_token;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => { refreshPromise.current = null; });
    return refreshPromise.current;
  }

  useEffect(() => {
    let active = true;
    // A refresh cookie is HttpOnly, so the browser cannot inspect it directly.
    // Keep a non-sensitive local hint to avoid issuing a guaranteed 401 on
    // every first visit while logged out. If the hint is stale, refreshSession
    // clears it after the server rejects the cookie.
    const hasSessionHint = localStorage.getItem('auth_session_hint') === '1'
      || Boolean(localStorage.getItem('auth_token'));
    const restore = hasSessionHint ? refreshSession() : Promise.resolve(null);
    restore.finally(() => { if (active) setReady(true); });

    return () => { active = false; };
  }, []);

  useEffect(() => registerAuthRefreshHandler(refreshSession), []);

  async function login(email: string, password: string, tenantSlug?: string) {
    const result = await apiRequest<{access_token: string; user: User}>(apiBaseUrl, '/api/v1/auth/login', undefined, {method: 'POST', body: JSON.stringify({email, password, tenant_slug: tenantSlug || undefined})});
    setToken(result.data.access_token);
    setUser(result.data.user);
    localStorage.setItem('auth_session_hint', '1');
    clearApiCache();
  }

  async function register(tenantSlug: string, tenantName: string, email: string, displayName: string, password: string) {
    const result = await apiRequest<{access_token: string; user: User}>(apiBaseUrl, '/api/v1/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify({tenant_slug: tenantSlug, tenant_name: tenantName, email, display_name: displayName, password}),
    });
    setToken(result.data.access_token);
    setUser(result.data.user);
    localStorage.setItem('auth_session_hint', '1');
    clearApiCache();
  }

  async function logout() {
    if (token) await apiRequest(apiBaseUrl, '/api/v1/auth/logout', token, {method: 'POST'}).catch(() => undefined);
    clearSession();
  }

  const value = useMemo(() => ({token, user, ready, login, register, logout}), [token, user, ready]);
  // Do not mount route components until the Cookie-backed session check is
  // complete. Several routes redirect when token is empty; mounting them early
  // creates a race that sends a valid restored session back to the login page.
  return <AuthContext.Provider value={value}>{ready ? children : <div aria-busy="true" />}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AUTH_PROVIDER_MISSING'); return value; }
