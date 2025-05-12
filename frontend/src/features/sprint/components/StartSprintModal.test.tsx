import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { StartSprintModal } from './StartSprintModal';
import { START_SPRINT } from '@/graphql/sprint/sprint.mutations';
import { GET_SPRINTS, GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import type { Sprint } from '@/types/api.types';

const PROJECT_ID = 'proj-1';

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    name: 'Sprint 1',
    goal: null,
    projectId: PROJECT_ID,
    startDate: null,
    endDate: null,
    status: 'PLANNING',
    createdAt: '2026-01-01',
    userStories: [],
    stats: { totalPoints: 10, completedPoints: 0, totalStories: 3, completedStories: 0, progressPercent: 0 },
    ...overrides,
  };
}

const startMock = {
  request: {
    query: START_SPRINT,
    variables: {
      id: 'sprint-1',
      input: {
        goal: 'Completar autenticación',
        startDate: expect.any(String),
        endDate: expect.any(String),
      },
    },
  },
  result: {
    data: {
      startSprint: {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Completar autenticación',
        status: 'ACTIVE',
        startDate: '2026-03-17T00:00:00.000Z',
        endDate: '2026-03-31T00:00:00.000Z',
      },
    },
  },
};

const refetchMocks = [
  {
    request: { query: GET_SPRINTS, variables: { projectId: PROJECT_ID } },
    result: { data: { sprints: [] } },
  },
  {
    request: { query: GET_ACTIVE_SPRINT, variables: { projectId: PROJECT_ID } },
    result: { data: { activeSprint: null } },
  },
];

function renderModal(sprint: Sprint | null = makeSprint(), onClose = vi.fn()) {
  return render(
    <MockedProvider mocks={[startMock, ...refetchMocks]}>
      <StartSprintModal sprint={sprint} projectId={PROJECT_ID} onClose={onClose} />
    </MockedProvider>,
  );
}

describe('StartSprintModal', () => {
  it('renders nothing when sprint is null', () => {
    renderModal(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows sprint name in title', () => {
    renderModal();
    expect(screen.getByText(/Iniciar Sprint 1/i)).toBeInTheDocument();
  });

  it('shows story and point counts when sprint has stats', () => {
    renderModal(makeSprint({ stats: { totalStories: 3, totalPoints: 10, completedPoints: 0, completedStories: 0, progressPercent: 0 } }));
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows warning when no goal is set', () => {
    renderModal();
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/sin objetivo/i);
  });

  it('hides warning when goal is entered', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText(/flujo de autenticación/i), {
      target: { value: 'Completar login' },
    });
    expect(screen.queryByText(/sin objetivo/i)).not.toBeInTheDocument();
  });

  it('shows duration warning for very short sprint', async () => {
    renderModal();
    const startInput = screen.getByLabelText(/fecha de inicio/i);
    const endInput = screen.getByLabelText(/fecha de fin/i);
    // Set start and end to consecutive days
    fireEvent.change(startInput, { target: { value: '2026-03-17' } });
    fireEvent.change(endInput, { target: { value: '2026-03-18' } });
    await waitFor(() => {
      expect(screen.getByText(/muy corto/i)).toBeInTheDocument();
    });
  });

  it('shows duration warning for sprint longer than 4 weeks', async () => {
    renderModal();
    const startInput = screen.getByLabelText(/fecha de inicio/i);
    const endInput = screen.getByLabelText(/fecha de fin/i);
    fireEvent.change(startInput, { target: { value: '2026-03-01' } });
    fireEvent.change(endInput, { target: { value: '2026-04-30' } });
    await waitFor(() => {
      expect(screen.getByText(/supera las 4 semanas/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal(makeSprint(), onClose);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders start button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /iniciar sprint/i })).toBeInTheDocument();
  });

  it('renders date fields pre-filled', () => {
    renderModal();
    const startInput = screen.getByLabelText(/fecha de inicio/i);
    const endInput = screen.getByLabelText(/fecha de fin/i);
    expect((startInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((endInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
