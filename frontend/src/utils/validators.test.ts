import { isNotEmpty, isValidEmail, isValidUrl, hasMinLength, isInRange } from './validators';

describe('isNotEmpty', () => {
  it('returns true for a non-empty string', () => {
    expect(isNotEmpty('hola')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isNotEmpty('')).toBe(false);
  });

  it('returns false for a string with only spaces', () => {
    expect(isNotEmpty('   ')).toBe(false);
  });

  it('returns true for a string with spaces around content', () => {
    expect(isNotEmpty('  hola  ')).toBe(true);
  });
});

describe('isValidEmail', () => {
  it('returns true for a valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('returns false for a missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('returns false for a missing domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('ignores leading/trailing spaces', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

describe('isValidUrl', () => {
  it('returns true for an http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('returns true for an https URL', () => {
    expect(isValidUrl('https://scrumforge.dev/path?q=1')).toBe(true);
  });

  it('returns false for a non-URL string', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('returns false for ftp protocol', () => {
    expect(isValidUrl('ftp://files.example.com')).toBe(false);
  });
});

describe('hasMinLength', () => {
  it('returns true when value meets the minimum', () => {
    expect(hasMinLength('password', 6)).toBe(true);
  });

  it('returns false when value is too short', () => {
    expect(hasMinLength('abc', 6)).toBe(false);
  });

  it('counts trimmed length', () => {
    expect(hasMinLength('   ab   ', 6)).toBe(false);
  });
});

describe('isInRange', () => {
  it('returns true when value is within range', () => {
    expect(isInRange(5, 1, 10)).toBe(true);
  });

  it('returns true for boundary values', () => {
    expect(isInRange(1, 1, 10)).toBe(true);
    expect(isInRange(10, 1, 10)).toBe(true);
  });

  it('returns false when value is below range', () => {
    expect(isInRange(0, 1, 10)).toBe(false);
  });

  it('returns false when value is above range', () => {
    expect(isInRange(11, 1, 10)).toBe(false);
  });
});
