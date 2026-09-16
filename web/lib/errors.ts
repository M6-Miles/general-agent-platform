export function errorMessage(cause: unknown, fallback = '请求失败'): string {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === 'string' && cause) return cause;
  return fallback;
}
