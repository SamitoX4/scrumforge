import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('renders the input with the given placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} placeholder="Buscar historias" />);
    expect(screen.getByRole('searchbox', { name: 'Buscar historias' })).toBeInTheDocument();
  });

  it('shows the current value', () => {
    render(<SearchBar value="sprint" onChange={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toHaveValue('sprint');
  });

  it('calls onChange on input change', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'épica' } });
    expect(onChange).toHaveBeenCalledWith('épica');
  });

  it('shows clear button when value is non-empty', () => {
    render(<SearchBar value="texto" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear button is clicked', () => {
    const onChange = vi.fn();
    render(<SearchBar value="algo" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('disables the input when disabled prop is true', () => {
    render(<SearchBar value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });
});
