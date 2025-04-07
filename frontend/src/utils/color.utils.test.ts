import { statusColor, priorityColor, statusLabel, priorityLabel, STATUS_COLORS, PRIORITY_COLORS } from './color.utils';

describe('statusColor', () => {
  it('returns the correct color for TODO', () => {
    expect(statusColor('TODO')).toBe(STATUS_COLORS.TODO);
  });

  it('returns the correct color for IN_PROGRESS', () => {
    expect(statusColor('IN_PROGRESS')).toBe(STATUS_COLORS.IN_PROGRESS);
  });

  it('returns the correct color for IN_REVIEW', () => {
    expect(statusColor('IN_REVIEW')).toBe(STATUS_COLORS.IN_REVIEW);
  });

  it('returns the correct color for DONE', () => {
    expect(statusColor('DONE')).toBe(STATUS_COLORS.DONE);
  });
});

describe('priorityColor', () => {
  it('returns the correct color for CRITICAL', () => {
    expect(priorityColor('CRITICAL')).toBe(PRIORITY_COLORS.CRITICAL);
  });

  it('returns the correct color for HIGH', () => {
    expect(priorityColor('HIGH')).toBe(PRIORITY_COLORS.HIGH);
  });

  it('returns the correct color for LOW', () => {
    expect(priorityColor('LOW')).toBe(PRIORITY_COLORS.LOW);
  });
});

describe('statusLabel', () => {
  it('returns "Pendiente" for TODO', () => {
    expect(statusLabel('TODO')).toBe('Pendiente');
  });

  it('returns "En progreso" for IN_PROGRESS', () => {
    expect(statusLabel('IN_PROGRESS')).toBe('En progreso');
  });

  it('returns "En revisión" for IN_REVIEW', () => {
    expect(statusLabel('IN_REVIEW')).toBe('En revisión');
  });

  it('returns "Listo" for DONE', () => {
    expect(statusLabel('DONE')).toBe('Listo');
  });
});

describe('priorityLabel', () => {
  it('returns "Crítica" for CRITICAL', () => {
    expect(priorityLabel('CRITICAL')).toBe('Crítica');
  });

  it('returns "Alta" for HIGH', () => {
    expect(priorityLabel('HIGH')).toBe('Alta');
  });

  it('returns "Media" for MEDIUM', () => {
    expect(priorityLabel('MEDIUM')).toBe('Media');
  });

  it('returns "Baja" for LOW', () => {
    expect(priorityLabel('LOW')).toBe('Baja');
  });
});
