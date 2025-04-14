import { render, screen, fireEvent } from '@testing-library/react';
import { PrioritySelector } from './PrioritySelector';

describe('PrioritySelector', () => {
  it('renders all four priority options', () => {
    render(<PrioritySelector value="MEDIUM" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /crítica/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /baja/i })).toBeInTheDocument();
  });

  it('marks the selected option as pressed', () => {
    render(<PrioritySelector value="HIGH" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /alta/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /media/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked priority', () => {
    const onChange = vi.fn();
    render(<PrioritySelector value="LOW" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /crítica/i }));
    expect(onChange).toHaveBeenCalledWith('CRITICAL');
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<PrioritySelector value="LOW" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /alta/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has a group role with accessible label', () => {
    render(<PrioritySelector value="MEDIUM" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: /prioridad/i })).toBeInTheDocument();
  });
});
