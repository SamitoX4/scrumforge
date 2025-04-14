import { render, screen, fireEvent } from '@testing-library/react';
import { PointsEstimator } from './PointsEstimator';

describe('PointsEstimator', () => {
  it('renders the first 7 Fibonacci values plus "?" button', () => {
    render(<PointsEstimator value={null} onChange={vi.fn()} />);
    for (const n of [1, 2, 3, 5, 8, 13, 21]) {
      expect(screen.getByRole('button', { name: String(n) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /sin estimar/i })).toBeInTheDocument();
  });

  it('marks the selected value as pressed', () => {
    render(<PointsEstimator value={5} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks "?" as pressed when value is null', () => {
    render(<PointsEstimator value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sin estimar/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<PointsEstimator value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '13' }));
    expect(onChange).toHaveBeenCalledWith(13);
  });

  it('calls onChange with null when the active value is clicked again', () => {
    const onChange = vi.fn();
    render(<PointsEstimator value={8} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with null when "?" is clicked', () => {
    const onChange = vi.fn();
    render(<PointsEstimator value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sin estimar/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<PointsEstimator value={null} onChange={vi.fn()} disabled />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });
});
