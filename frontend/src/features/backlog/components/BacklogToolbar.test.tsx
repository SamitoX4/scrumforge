import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { BacklogToolbar } from './BacklogToolbar';
import { GET_SPRINTS } from '@/graphql/sprint/sprint.queries';

const PROJECT_ID = 'proj-1';

const sprintsMock = {
  request: { query: GET_SPRINTS, variables: { projectId: PROJECT_ID } },
  result: {
    data: {
      sprints: [
        { id: 'sp-1', name: 'Sprint 1', goal: '', status: 'PLANNING', startDate: null, endDate: null, stats: null },
        { id: 'sp-2', name: 'Sprint 2', goal: '', status: 'ACTIVE', startDate: null, endDate: null, stats: null },
        { id: 'sp-3', name: 'Sprint 3', goal: '', status: 'COMPLETED', startDate: null, endDate: null, stats: null },
      ],
    },
  },
};

function renderToolbar(selectedIds: string[] = ['s1', 's2'], overrides = {}) {
  const props = {
    projectId: PROJECT_ID,
    selectedIds: new Set(selectedIds),
    totalCount: 5,
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onActionComplete: vi.fn(),
    ...overrides,
  };

  return render(
    <MockedProvider mocks={[sprintsMock]}>
      <BacklogToolbar {...props} />
    </MockedProvider>,
  );
}

describe('BacklogToolbar', () => {
  it('renders nothing when selectedIds is empty', () => {
    const { container } = renderToolbar([]);
    expect(container.firstChild).toBeNull();
  });

  it('shows count of selected vs total', () => {
    renderToolbar(['s1', 's2']);
    expect(screen.getByText(/2 de 5 seleccionadas/i)).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    renderToolbar(['s1']);
    expect(screen.getByRole('button', { name: /mover al sprint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('calls onDeselectAll when cancel is clicked', () => {
    const onDeselectAll = vi.fn();
    renderToolbar(['s1'], { onDeselectAll });
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onDeselectAll).toHaveBeenCalled();
  });

  it('shows sprint menu when move button is clicked', async () => {
    renderToolbar(['s1']);
    fireEvent.click(screen.getByRole('button', { name: /mover al sprint/i }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /quitar del sprint/i })).toBeInTheDocument();
    });
  });

  it('shows planning and active sprints in the menu, not completed ones', async () => {
    renderToolbar(['s1']);
    fireEvent.click(screen.getByRole('button', { name: /mover al sprint/i }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Sprint 1/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Sprint 2/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('menuitem', { name: /Sprint 3/i })).not.toBeInTheDocument();
  });

  it('shows confirm dialog when delete is clicked', async () => {
    renderToolbar(['s1']);
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls onSelectAll when select-all checkbox is clicked while not all selected', () => {
    const onSelectAll = vi.fn();
    renderToolbar(['s1', 's2'], { onSelectAll, totalCount: 5 });
    const checkbox = screen.getByRole('checkbox', { name: /todos/i });
    fireEvent.click(checkbox);
    expect(onSelectAll).toHaveBeenCalled();
  });
});
