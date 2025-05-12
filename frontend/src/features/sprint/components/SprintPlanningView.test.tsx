import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SprintPlanningView from './SprintPlanningView';
import { GET_SPRINTS } from '@/graphql/sprint/sprint.queries';
import { GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { GET_VELOCITY } from '@/graphql/reports/reports.queries';
import { CREATE_SPRINT } from '@/graphql/sprint/sprint.mutations';

// ── dnd-kit mock ─────────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, isDragging: false }),
}));

// ── Constants ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-1';

function makeSprintsMock(sprints = [
  {
    id: 'sp-1', name: 'Sprint 1', goal: 'Autenticación', status: 'PLANNING',
    startDate: null, endDate: null, createdAt: '2026-01-01',
    stats: { totalPoints: 8, completedPoints: 0, totalStories: 2, completedStories: 0, progressPercent: 0 },
  },
]) {
  return {
    request: { query: GET_SPRINTS, variables: { projectId: PROJECT_ID } },
    result: { data: { sprints } },
  };
}

const backlogMock = {
  request: { query: GET_BACKLOG, variables: { projectId: PROJECT_ID } },
  result: {
    data: {
      backlog: [
        {
          id: 'story-1', title: 'Historia en backlog', description: null,
          status: 'TODO', points: 5, priority: 'HIGH', order: 0,
          epicId: null, sprintId: null, assigneeId: null, createdAt: '2026-01-01',
          epic: null, assignee: null,
        },
      ],
    },
  },
};

const emptyBacklogMock = {
  request: { query: GET_BACKLOG, variables: { projectId: PROJECT_ID } },
  result: { data: { backlog: [] } },
};

const velocityMock = {
  request: { query: GET_VELOCITY, variables: { projectId: PROJECT_ID, lastSprints: 3 } },
  result: { data: { velocityReport: { projectId: PROJECT_ID, averageVelocity: 20, sprints: [] } } },
};

const noVelocityMock = {
  request: { query: GET_VELOCITY, variables: { projectId: PROJECT_ID, lastSprints: 3 } },
  result: { data: { velocityReport: { projectId: PROJECT_ID, averageVelocity: 0, sprints: [] } } },
};

const createSprintMock = {
  request: {
    query: CREATE_SPRINT,
    variables: { input: { name: 'Sprint 2', projectId: PROJECT_ID } },
  },
  result: {
    data: {
      createSprint: {
        id: 'sp-2', name: 'Sprint 2', goal: null, status: 'PLANNING',
        startDate: null, endDate: null, projectId: PROJECT_ID,
      },
    },
  },
};

function renderView(mocks: MockedResponse[] = [makeSprintsMock(), backlogMock, velocityMock]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[`/ws/${PROJECT_ID}/planning`]}>
        <Routes>
          <Route path="/ws/:projectId/planning" element={<SprintPlanningView />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SprintPlanningView', () => {
  it('shows loading spinner initially', () => {
    renderView();
    expect(document.querySelector('svg, [class*="spinner"]')).toBeTruthy();
  });

  it('renders heading after data loads', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Planificación de Sprint')).toBeInTheDocument();
    });
  });

  it('renders "Nuevo sprint" button', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo sprint/i })).toBeInTheDocument();
    });
  });

  it('shows sprint name in list', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    });
  });

  it('shows backlog story', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Historia en backlog')).toBeInTheDocument();
    });
  });

  it('shows empty backlog message when no stories', async () => {
    renderView([makeSprintsMock(), emptyBacklogMock, velocityMock]);
    await waitFor(() => {
      expect(screen.getByText(/El backlog está vacío/i)).toBeInTheDocument();
    });
  });

  it('shows "no hay sprints" when sprint list is empty', async () => {
    renderView([makeSprintsMock([]), emptyBacklogMock, noVelocityMock]);
    await waitFor(() => {
      expect(screen.getByText(/No hay sprints/i)).toBeInTheDocument();
    });
  });

  it('opens create sprint modal when button is clicked', async () => {
    renderView();
    await waitFor(() => screen.getByRole('button', { name: /nuevo sprint/i }));
    fireEvent.click(screen.getByRole('button', { name: /nuevo sprint/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/nombre del sprint/i)).toBeInTheDocument();
    });
  });

  it('closes create modal when cancel is clicked', async () => {
    renderView();
    await waitFor(() => screen.getByRole('button', { name: /nuevo sprint/i }));
    fireEvent.click(screen.getByRole('button', { name: /nuevo sprint/i }));
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows "Iniciar sprint" button for planning sprints', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /iniciar sprint/i })).toBeInTheDocument();
    });
  });

  it('shows velocity info when available', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/velocidad promedio/i)).toBeInTheDocument();
      expect(screen.getByText('20 pts')).toBeInTheDocument();
    });
  });

  it('shows "Sin historial" when velocity is 0', async () => {
    renderView([makeSprintsMock(), backlogMock, noVelocityMock]);
    await waitFor(() => {
      expect(screen.getByText(/sin historial de velocidad/i)).toBeInTheDocument();
    });
  });

  it('submits create sprint form', async () => {
    renderView([makeSprintsMock(), backlogMock, velocityMock, createSprintMock, makeSprintsMock()]);
    await waitFor(() => screen.getByRole('button', { name: /nuevo sprint/i }));
    fireEvent.click(screen.getByRole('button', { name: /nuevo sprint/i }));
    await waitFor(() => screen.getByLabelText(/nombre del sprint/i));
    fireEvent.change(screen.getByLabelText(/nombre del sprint/i), { target: { value: 'Sprint 2' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
