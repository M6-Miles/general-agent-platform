const hasExplicitTimezone = /(Z|[+-]\d{2}:\d{2})$/i;

export function parseApiDate(value: string): Date {
  return new Date(hasExplicitTimezone.test(value) ? value : `${value}Z`);
}
