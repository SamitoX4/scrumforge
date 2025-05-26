import { render, screen, fireEvent } from '@testing-library/react';
import { BoardFilters, type BoardFilterState } from './BoardFilters';
import type { User } from '@/types/api.types';

const assignees: User[] = [
  { id: 'u1', name: 'Alice', email: 'alice@test.com', emailVerified: true, createdAt: '' },
  { id: 'u2', name: 'Bob', email: 'bob@test.com', emailVerified: true, createdAt: '' },
];

const defaultFilters: BoardFilterState = { assigneeId: '', priority: '' };

describe('BoardFilters', () => {
  it('renders priority select always', () => {
    render(
      <BoardFilters
        assignees={[]}
        filters={defaultFilters}
        onChange={vi.fn()}
        totalCount={10}
        filteredCount={10}
      />,
    );
    expect(screen.getByRole('combobox', { name: /filtrar/i })).toBeInTheDocument();
  });

  it('renders assignee select when assignees are provided', () => {
    render(
      <BoardFilters
        assignees={assignees}
        filters={defaultFilters}
        onChange={vi.fn()}
        totalCount={5}
        filteredCount={5}
      />,
    );
    expect(screen.getByRole('combobox', { name: /responsable/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
  });

  it('does not render assignee select when no assignees', () => {
    render(
      <BoardFilters
        assignees={[]}
        filters={defaultFilters}
        onChange={vi.fn()}
        totalCount={5}
        filteredCount={5}
      />,
    );
    expect(screen.queryByRole('combobox', { name: /responsable/i })).not.toBeInTheDocument();
  });

  it('calls onChange when priority changes', () => {
    const onChange = vi.fn();
    render(
      <BoardFilters
        assignees={[]}
        filters={defaultFilters}
        onChange={onChange}
        totalCount={5}
        filteredCount={5}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /filtrar/i }), {
      target: { value: 'HIGH' },
    });
    expect(onChange).toHaveBeenCalledWith({ assigneeId: '', priority: 'HIGH' });
  });

  it('calls onChange when assignee changes', () => {
    const onChange = vi.fn();
    render(
      <BoardFilters
        assignees={assignees}
        filters={defaultFilters}
        onChange={onChange}
        totalCount={5}
        filteredCount={5}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /responsable/i }), {
      target: { value: 'u1' },
    });
    expect(onChange).toHaveBeenCalledWith({ assigneeId: 'u1', priority: '' });
  });

  it('shows clear button and count when a filter is active', () => {
    render(
      <BoardFilters
        assignees={assignees}
        filters={{ assigneeId: 'u1', priority: '' }}
        onChange={vi.fn()}
        totalCount={10}
        filteredCount={3}
      />,
    );
    expect(screen.getByRole('button', { name: /filtrar/i })).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10/)).toBeInTheDocument();
  });

  it('hides clear button and count when no filter active', () => {
    render(
      <BoardFilters
        assignees={assignees}
        filters={defaultFilters}
        onChange={vi.fn()}
        totalCount={10}
        filteredCount={10}
      />,
    );
    expect(screen.queryByRole('button', { name: /filtrar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
  });

  it('clears all filters when clear button is clicked', () => {
    const onChange = vi.fn();
    render(
      <BoardFilters
        assignees={assignees}
        filters={{ assigneeId: 'u1', priority: 'HIGH' }}
        onChange={onChange}
        totalCount={10}
        filteredCount={2}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /filtrar/i }));
    expect(onChange).toHaveBeenCalledWith({ assigneeId: '', priority: '' });
  });
});
