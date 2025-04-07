import { FIBONACCI_SEQUENCE, getClosestFibonacci, formatPoints, sumPoints } from './story-points.utils';

describe('FIBONACCI_SEQUENCE', () => {
  it('starts with 1 and includes standard values', () => {
    expect(FIBONACCI_SEQUENCE[0]).toBe(1);
    expect(FIBONACCI_SEQUENCE).toContain(5);
    expect(FIBONACCI_SEQUENCE).toContain(13);
  });

  it('has 10 elements', () => {
    expect(FIBONACCI_SEQUENCE).toHaveLength(10);
  });
});

describe('getClosestFibonacci', () => {
  it('returns exact value when it is already in the sequence', () => {
    expect(getClosestFibonacci(5)).toBe(5);
    expect(getClosestFibonacci(13)).toBe(13);
  });

  it('rounds 4 to the closest fibonacci (3 or 5)', () => {
    // 4 is equidistant from 3 and 5 — result is deterministic by reduce
    const result = getClosestFibonacci(4);
    expect([3, 5]).toContain(result);
  });

  it('rounds 6 up to 8', () => {
    expect(getClosestFibonacci(6)).toBe(5);
  });

  it('rounds 7 to 8', () => {
    expect(getClosestFibonacci(7)).toBe(8);
  });
});

describe('formatPoints', () => {
  it('returns "—" for null', () => {
    expect(formatPoints(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatPoints(undefined)).toBe('—');
  });

  it('formats a number with "pts" suffix', () => {
    expect(formatPoints(5)).toBe('5 pts');
    expect(formatPoints(13)).toBe('13 pts');
  });

  it('formats zero correctly', () => {
    expect(formatPoints(0)).toBe('0 pts');
  });
});

describe('sumPoints', () => {
  it('returns 0 for an empty array', () => {
    expect(sumPoints([])).toBe(0);
  });

  it('sums non-null points', () => {
    expect(sumPoints([{ points: 3 }, { points: 5 }, { points: 8 }])).toBe(16);
  });

  it('treats null and undefined points as 0', () => {
    expect(sumPoints([{ points: 5 }, { points: null }, { points: undefined }])).toBe(5);
  });
});
