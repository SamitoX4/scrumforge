import { formatRelativeTime, formatDate, getDaysRemaining } from './date.utils';

describe('formatRelativeTime', () => {
  function isoSecondsAgo(seconds: number): string {
    return new Date(Date.now() - seconds * 1000).toISOString();
  }

  it('returns "ahora mismo" for less than a minute ago', () => {
    expect(formatRelativeTime(isoSecondsAgo(30))).toBe('ahora mismo');
  });

  it('returns minutes for less than an hour ago', () => {
    expect(formatRelativeTime(isoSecondsAgo(5 * 60))).toBe('hace 5 min');
  });

  it('returns hours for less than a day ago', () => {
    expect(formatRelativeTime(isoSecondsAgo(3 * 60 * 60))).toBe('hace 3h');
  });

  it('returns days for less than a month ago', () => {
    expect(formatRelativeTime(isoSecondsAgo(7 * 24 * 60 * 60))).toBe('hace 7d');
  });
});

describe('formatDate', () => {
  it('returns "—" for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a valid ISO date string', () => {
    // Use a fixed date that doesn't depend on locale timezone edge cases
    const result = formatDate('2026-03-15T12:00:00Z');
    expect(result).toMatch(/15/);   // day present
    expect(result).toMatch(/2026/); // year present
  });
});

describe('getDaysRemaining', () => {
  it('returns null for null input', () => {
    expect(getDaysRemaining(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getDaysRemaining(undefined)).toBeNull();
  });

  it('returns 0 for today', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(getDaysRemaining(today.toISOString())).toBe(0);
  });

  it('returns positive days for a future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(getDaysRemaining(future.toISOString())).toBe(5);
  });

  it('returns negative days for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(getDaysRemaining(past.toISOString())).toBe(-3);
  });
});
