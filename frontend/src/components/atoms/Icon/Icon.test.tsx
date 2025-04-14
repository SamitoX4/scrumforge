import { render, screen } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('renders the icon character', () => {
    const { container } = render(<Icon name="🔍" />);
    expect(container.textContent).toBe('🔍');
  });

  it('is decorative (aria-hidden) when no label provided', () => {
    const { container } = render(<Icon name="⋮" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden');
  });

  it('is accessible with role=img when label is provided', () => {
    render(<Icon name="✓" label="Completado" />);
    const el = screen.getByRole('img', { name: 'Completado' });
    expect(el).toBeInTheDocument();
  });

  it('applies the size class', () => {
    const { container } = render(<Icon name="X" size="lg" />);
    expect(container.querySelector('[class*="icon--lg"]')).toBeInTheDocument();
  });

  it('defaults to md size', () => {
    const { container } = render(<Icon name="X" />);
    expect(container.querySelector('[class*="icon--md"]')).toBeInTheDocument();
  });
});
