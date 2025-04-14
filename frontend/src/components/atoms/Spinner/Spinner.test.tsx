import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders with status role', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Cargando...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Spinner className="my-spinner" />);
    expect(screen.getByRole('status').className).toContain('my-spinner');
  });
});
