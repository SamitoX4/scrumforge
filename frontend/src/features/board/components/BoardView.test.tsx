import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BoardView from './BoardView';
import { GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import { GET_EPICS } from '@/graphql/backlog/backlog.queries';
import { GET_BOARD_COLUMNS } from '@/graphql/board/board.queries';

// ── dnd-kit mock ─────────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), isDragging: false }),
}));

// ── hook mocks ────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMyProjectRole', () => ({
  useMyProjectRole: () => 'DEVELOPER',
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useBoardRealtime', () => ({
  useBoardRealtime: vi.fn(),
}));

vi.mock('@/hooks/useBoardDnd', () => ({
  useBoardDnd: () => ({
    activeStory: null,
    sensors: [],
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}));

// ── Constants ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-1';

const activeSprint = {
  id: 'sp-1',
  name: 'Sprint 1',
  goal: 'Terminar el login',
  status: 'ACTIVE',
  startDate: '2026-03-01',
  endDate: '2026-03-15',
  stats: { totalPoints: 15, completedPoints: 5, totalStories: 4, completedStories: 1, progressPercent: 25 },
  userStories: [
    {
      id: 'story-1', title: 'Historia en progreso', description: null,
      status: 'IN_PROGRESS', points: 5, priority: 'HIGH', order: 0,
      assigneeId: null, isBlocked: false, blockedReason: null,
      assignee: null, tasks: [],
    },
    {
      id: 'story-2', title: 'Historia pendiente', description: null,
      status: 'TODO', points: 3, priority: 'MEDIUM', order: 1,
      assigneeId: null, isBlocked: false, blockedReason: null,
      assignee: null, tasks: [],
    },
  ],
};

const activeSprintMock = {
  request: { query: GET_ACTIVE_SPRINT, variables: { projectId: PROJECT_ID } },
  result: { data: { activeSprint } },
};

const noActiveSprintMock = {
  request: { query: GET_ACTIVE_SPRINT, variables: { projectId: PROJECT_ID } },
  result: { data: { activeSprint: null } },
};

const epicsMock = {
  request: { query: GET_EPICS, variables: { projectId: PROJECT_ID } },
  result: { data: { epics: [] } },
};

const columnsMock = {
  request: { query: GET_BOARD_COLUMNS, variables: { projectId: PROJECT_ID } },
  result: {
    data: {
      boardColumns: [
        { id: 'TODO', title: 'Por hacer', status: 'TODO', color: null, order: 0, wipLimit: null },
        { id: 'IN_PROGRESS', title: 'En progreso', status: 'IN_PROGRESS', color: null, order: 1, wipLimit: null },
        { id: 'IN_REVIEW', title: 'En revisión', status: 'IN_REVIEW', color: null, order: 2, wipLimit: null },
        { id: 'DONE', title: 'Listo', status: 'DONE', color: null, order: 3, wipLimit: null },
      ],
    },
  },
};

function renderView(mocks: MockedResponse[] = [activeSprintMock, epicsMock, columnsMock]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[`/ws/${PROJECT_ID}/board`]}>
        <Routes>
          <Route path="/ws/:projectId/board" element={<BoardView />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BoardView', () => {
  it('shows loading spinner initially', () => {
    renderView();
    expect(document.querySelector('svg, [class*="spinner"]')).toBeTruthy();
  });

  it('shows "no sprint" message when there is no active sprint', async () => {
    renderView([noActiveSprintMock, epicsMock, columnsMock]);
    await waitFor(() => {
      expect(screen.getByText(/Sin sprint activo/i)).toBeInTheDocument();
    });
  });

  it('renders sprint name when active sprint exists', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    });
  });

  it('renders sprint goal', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Terminar el login')).toBeInTheDocument();
    });
  });

  it('renders board column headers', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Por hacer')).toBeInTheDocument();
      expect(screen.getByText('En progreso')).toBeInTheDocument();
      expect(screen.getByText('Listo')).toBeInTheDocument();
    });
  });

  it('renders sprint stats (stories and points)', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/1\/4 historias/i)).toBeInTheDocument();
      expect(screen.getByText(/5\/15 pts/i)).toBeInTheDocument();
    });
  });

  it('renders story cards in correct columns', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Historia en progreso')).toBeInTheDocument();
      expect(screen.getByText('Historia pendiente')).toBeInTheDocument();
    });
  });

  it('renders Zen mode button', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /zen/i })).toBeInTheDocument();
    });
  });

  it('renders Columnas button', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /columnas/i })).toBeInTheDocument();
    });
  });
});
