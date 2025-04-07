import '@testing-library/jest-dom';
import i18n from '@/i18n/i18n';

// Tests use Spanish locale to match component translation assertions
i18n.changeLanguage('es');

// Recharts uses ResizeObserver which is not available in jsdom.
// Provide a mock that reports a non-zero size so ResponsiveContainer renders its children.
(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe(_target: Element) {
    this.cb(
      [{ contentRect: { width: 600, height: 300 } } as ResizeObserverEntry],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
};
