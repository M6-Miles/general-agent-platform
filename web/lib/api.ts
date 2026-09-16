export type ApiEnvelope<T> = {data: T; request_id: string; meta?: Record<string, unknown>};
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function isAbortError(cause: unknown): boolean {
  return typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'AbortError'
    || cause instanceof Error && (cause.name === 'AbortError' || cause.message === 'The operation was aborted');
}

const GET_CACHE_TTL_MS = 5_000;
type CacheEntry = {expiresAt: number; value: ApiEnvelope<unknown>; scope: string};
type InFlightEntry = {promise: Promise<ApiEnvelope<unknown>>; scope: string};
const getCache = new Map<string, CacheEntry>();
const getInFlight = new Map<string, InFlightEntry>();
const scopeGenerations = new Map<string, number>();
let cacheGeneration = 0;
let refreshHandler: (() => Promise<string | null>) | null = null;

/** Registers the browser session refresh implementation owned by AuthProvider. */
export function registerAuthRefreshHandler(handler: () => Promise<string | null>): () => void {
  refreshHandler = handler;
  return () => { if (refreshHandler === handler) refreshHandler = null; };
}

function requestIdentity(token: string | undefined, headers: Headers): string {
  const authorization = headers.get('authorization') ?? (token ? `Bearer ${token}` : '');
  const tenantId = headers.get('x-tenant-id') ?? headers.get('x-tenant') ?? '';
  return `auth:${authorization}|tenant:${tenantId}`;
}

function requestHeaders(token: string | undefined, headers?: HeadersInit, replaceAuthorization = false): Headers {
  const result = new Headers(headers);
  if (!result.has('Content-Type')) result.set('Content-Type', 'application/json');
  if (token && (replaceAuthorization || !result.has('Authorization'))) {
    result.set('Authorization', `Bearer ${token}`);
  }
  return result;
}

function resourceKey(path: string): string {
  const pathname = path.split('?', 1)[0].replace(/\/+$/, '');
  const segments = pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  if (apiIndex >= 0 && segments[apiIndex + 1] === 'v1' && segments[apiIndex + 2]) {
    return `/${segments.slice(0, apiIndex + 3).join('/')}`;
  }
  return `/${segments[0] ?? ''}`;
}

function scopeKey(baseUrl: string, path: string, identity: string): string {
  return `${baseUrl}|${resourceKey(path)}|${identity}`;
}

function scopeGeneration(scope: string): number {
  return scopeGenerations.get(scope) ?? 0;
}

export function invalidateApiCache(baseUrl: string, path: string, token?: string, headers?: HeadersInit): void {
  const identity = requestIdentity(token, new Headers(headers));
  const scope = scopeKey(baseUrl, path, identity);
  scopeGenerations.set(scope, scopeGeneration(scope) + 1);
  for (const [key, entry] of getCache) if (entry.scope === scope) getCache.delete(key);
  for (const [key, entry] of getInFlight) if (entry.scope === scope) getInFlight.delete(key);
}

export function clearApiCache(): void {
  cacheGeneration += 1;
  getCache.clear();
  getInFlight.clear();
  scopeGenerations.clear();
}

async function sendRequest<T>(baseUrl: string, path: string, init: RequestInit, headers: Headers): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.code ?? body?.detail ?? `HTTP_${response.status}`);
    Object.assign(error, {status: response.status});
    throw error;
  }
  return body as ApiEnvelope<T>;
}

export async function apiRequest<T>(baseUrl: string, path: string, token?: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const cacheableGet = method === 'GET' && init.cache !== 'no-store';
  const initialHeaders = requestHeaders(token, init.headers);
  const identity = requestIdentity(undefined, initialHeaders);
  const scope = scopeKey(baseUrl, path, identity);
  if (method !== 'GET') invalidateApiCache(baseUrl, path, undefined, initialHeaders);
  const cacheKey = `${baseUrl}${path}|${identity}`;
  const requestGeneration = cacheGeneration;
  const requestScopeGeneration = scopeGeneration(scope);
  if (cacheableGet) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as ApiEnvelope<T>;
    if (cached) getCache.delete(cacheKey);
    // Abortable callers must not share an in-flight request: cancelling one
    // view should never cancel or reject another view's request.
    if (!init.signal) {
      const pending = getInFlight.get(cacheKey);
      if (pending) return pending.promise as Promise<ApiEnvelope<T>>;
    }
  }
  const request = (async () => {
    let result: ApiEnvelope<T>;
    let resultCacheKey = cacheKey;
    let resultScope = scope;
    let resultScopeGeneration = requestScopeGeneration;
    try {
      result = await sendRequest<T>(baseUrl, path, init, initialHeaders);
    } catch (cause) {
      const status = cause instanceof Error && 'status' in cause ? (cause as Error & {status?: number}).status : undefined;
      const isAuthEndpoint = path === '/api/v1/auth/login' || path === '/api/v1/auth/refresh';
      // A refresh happens at most once per request. AuthProvider coalesces
      // concurrent refresh attempts, so expired-token bursts cause one refresh.
      const refreshedToken = status === 401 && !isAuthEndpoint && refreshHandler
        ? await refreshHandler()
        : null;
      if (!refreshedToken) throw cause;
      const refreshedHeaders = requestHeaders(refreshedToken, init.headers, true);
      const refreshedIdentity = requestIdentity(undefined, refreshedHeaders);
      resultScope = scopeKey(baseUrl, path, refreshedIdentity);
      resultCacheKey = `${baseUrl}${path}|${refreshedIdentity}`;
      resultScopeGeneration = scopeGeneration(resultScope);
      result = await sendRequest<T>(baseUrl, path, init, refreshedHeaders);
    }
    if (cacheableGet && !init.signal?.aborted && requestGeneration === cacheGeneration && resultScopeGeneration === scopeGeneration(resultScope)) {
      getCache.set(resultCacheKey, {expiresAt: Date.now() + GET_CACHE_TTL_MS, value: result, scope: resultScope});
    }
    return result;
  })();
  if (cacheableGet && !init.signal) {
    const entry: InFlightEntry = {promise: request as Promise<ApiEnvelope<unknown>>, scope};
    getInFlight.set(cacheKey, entry);
    request.finally(() => { if (getInFlight.get(cacheKey)?.promise === request) getInFlight.delete(cacheKey); }).catch(() => undefined);
  }
  return request;
}
