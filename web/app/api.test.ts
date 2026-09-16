import {afterEach, describe, expect, it, vi} from 'vitest';
import {apiRequest, clearApiCache, isAbortError, registerAuthRefreshHandler} from '../lib/api';

afterEach(() => { clearApiCache(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('apiRequest abort and cache behavior', () => {
  it('recognizes browser and runtime abort errors', () => {
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true);
    const error = new Error('The operation was aborted'); error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error('network'))).toBe(false);
  });
  it('does not deduplicate abortable GET requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => ({data: {value: 1}, request_id: 'r'})}); vi.stubGlobal('fetch', fetchMock);
    await Promise.all([apiRequest('', '/resource', 'token', {signal: new AbortController().signal}), apiRequest('', '/resource', 'token', {signal: new AbortController().signal})]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not cache a response after its signal is aborted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => ({data: {value: 2}, request_id: 'r'})}); vi.stubGlobal('fetch', fetchMock);
    const path = `/uncached-${Date.now()}`; const controller = new AbortController(); const pending = apiRequest('', path, 'token', {signal: controller.signal}); controller.abort(); await pending; await apiRequest('', path, 'token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('clears failed in-flight requests so the next GET can retry', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({ok: true, json: async () => ({data: {value: 3}, request_id: 'r'})});
    vi.stubGlobal('fetch', fetchMock);
    const path = `/retry-${Date.now()}`;
    await expect(apiRequest('', path, 'token')).rejects.toThrow('temporary network failure');
    await expect(apiRequest('', path, 'token')).resolves.toMatchObject({data: {value: 3}});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('drops expired cache entries before refetching', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => ({data: {value: 4}, request_id: 'r'})});
    vi.stubGlobal('fetch', fetchMock);
    const path = `/expire-${Date.now()}`;
    await apiRequest('', path, 'token');
    vi.advanceTimersByTime(5_001);
    await apiRequest('', path, 'token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('bypasses the GET cache when no-store is requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => ({data: {value: fetchMock.mock.calls.length}, request_id: 'r'})});
    vi.stubGlobal('fetch', fetchMock);
    const path = `/live-status-${Date.now()}`;
    await apiRequest('', path, 'token', {cache: 'no-store'});
    await apiRequest('', path, 'token', {cache: 'no-store'});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('isolates cached GET responses by authentication and tenant identity', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ok: true, json: async () => ({data: {tenant: 'a'}, request_id: 'a'})})
      .mockResolvedValueOnce({ok: true, json: async () => ({data: {tenant: 'b'}, request_id: 'b'})});
    vi.stubGlobal('fetch', fetchMock);
    const path = `/tenant-cache-${Date.now()}`;
    await expect(apiRequest('', path, 'token-a', {headers: {'X-Tenant-ID': 'tenant-a'}})).resolves.toMatchObject({data: {tenant: 'a'}});
    await expect(apiRequest('', path, 'token-b', {headers: {'X-Tenant-ID': 'tenant-b'}})).resolves.toMatchObject({data: {tenant: 'b'}});
    await apiRequest('', path, 'token-a', {headers: {'X-Tenant-ID': 'tenant-a'}});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('uses the effective authorization header in the cache key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ok: true, json: async () => ({data: {user: 'a'}, request_id: 'a'})})
      .mockResolvedValueOnce({ok: true, json: async () => ({data: {user: 'b'}, request_id: 'b'})});
    vi.stubGlobal('fetch', fetchMock);
    const path = `/header-cache-${Date.now()}`;
    await apiRequest('', path, 'ignored', {headers: {Authorization: 'Bearer user-a'}});
    await apiRequest('', path, 'ignored', {headers: {Authorization: 'Bearer user-b'}});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('refreshes an expired authenticated request once and retries it', async () => {
    const refresh = vi.fn().mockResolvedValue('fresh-token');
    const unregister = registerAuthRefreshHandler(refresh);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ok: false, status: 401, json: async () => ({detail: 'UNAUTHORIZED'})})
      .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({data: {value: 'fresh'}, request_id: 'retry'})});
    vi.stubGlobal('fetch', fetchMock);
    const path = `/refresh-retry-${Date.now()}`;
    await expect(apiRequest('', path, 'expired-token')).resolves.toMatchObject({data: {value: 'fresh'}});
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer fresh-token');
    await apiRequest('', path, 'fresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unregister();
  });
  it('replaces an explicit expired authorization header after refresh', async () => {
    const refresh = vi.fn().mockResolvedValue('fresh-token');
    const unregister = registerAuthRefreshHandler(refresh);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ok: false, status: 401, json: async () => ({detail: 'UNAUTHORIZED'})})
      .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({data: {value: 'fresh'}, request_id: 'retry'})});
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('', `/explicit-refresh-${Date.now()}`, 'expired-token', {
      headers: {Authorization: 'Bearer explicitly-expired-token'},
    });
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer fresh-token');
    unregister();
  });
  it('does not recursively refresh the refresh endpoint', async () => {
    const refresh = vi.fn().mockResolvedValue('fresh-token');
    const unregister = registerAuthRefreshHandler(refresh);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 401, json: async () => ({detail: 'UNAUTHORIZED'})}));
    await expect(apiRequest('', '/api/v1/auth/refresh', undefined, {method: 'POST'})).rejects.toThrow('UNAUTHORIZED');
    expect(refresh).not.toHaveBeenCalled();
    unregister();
  });
  it('invalidates completed and in-flight GET cache entries after a write', async () => {
    let resolveGet!: (response: unknown) => void;
    let getCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toString().toUpperCase() === 'GET') {
        getCount += 1;
        if (getCount > 1) return Promise.resolve({ok: true, json: async () => ({data: {value: 'fresh'}, request_id: 'get-2'})});
        return new Promise((resolve) => { resolveGet = resolve; });
      }
      return Promise.resolve({ok: true, json: async () => ({data: {ok: true}, request_id: 'write'})});
    });
    vi.stubGlobal('fetch', fetchMock);
    const path = `/write-invalidate-${Date.now()}`;
    const pending = apiRequest('', path, 'token');
    await apiRequest('', `${path}/mutate`, 'token', {method: 'POST', body: '{}'});
    resolveGet({ok: true, json: async () => ({data: {value: 'stale'}, request_id: 'get'})});
    await pending;
    await apiRequest('', path, 'token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('invalidates only the mutated resource for the current identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => ({data: {ok: true}, request_id: String(fetchMock.mock.calls.length)})});
    vi.stubGlobal('fetch', fetchMock);
    const agentPath = `/api/v1/agents/${Date.now()}`;
    const costPath = '/api/v1/costs/summary';
    await apiRequest('', agentPath, 'token-a');
    await apiRequest('', costPath, 'token-a');
    await apiRequest('', `${agentPath}/publish`, 'token-a', {method: 'POST'});
    await apiRequest('', agentPath, 'token-a');
    await apiRequest('', costPath, 'token-a');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
