import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { gql } from '@apollo/client';
import BacklogView from './BacklogView';
import { GET_EPICS, GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { GET_SPRINTS } from '@/graphql/sprint/sprint.queries';

const GET_PROJECT = gql`
  query GetProject($id: ID!) {
    project(id: $id) {
      id name key teamId
      team { id name }
    }
  }
`;

// ── dnd-kit mock ─────────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  closestCenter: vi.fn(),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: 'vertical',
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

// ── Constants ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-1';

const epicsMock = {
  request: { query: GET_EPICS, variables: { projectId: PROJECT_ID } },
  result: {
    data: {
      epics: [
        { id: 'epic-1', title: 'Autenticación', description: null, priority: 'HIGH', color: '#3B82F6', order: 0, createdAt: '2026-01-01' },
      ],
    },
  },
};

const backlogMock = {
  request: { query: GET_BACKLOG, variables: { projectId: PROJECT_ID } },
  result: {
    data: {
      backlog: [
        {
          id: 'story-1',
          title: 'Inicio de sesión',
          description: null,
          status: 'TODO',
          points: 5,
          priority: 'HIGH',
          order: 0,
          epicId: 'epic-1',
          sprintId: null,
          assigneeId: null,
          createdAt: '2026-01-01',
          epic: { id: 'epic-1', title: 'Autenticación', color: '#3B82F6' },
          assignee: null,
        },
        {
          id: 'story-2',
          title: 'Registro de usuario',
          description: null,
          status: 'TODO',
          points: 3,
          priority: 'MEDIUM',
          order: 1,
          epicId: null,
          sprintId: null,
          assigneeId: null,
          createdAt: '2026-01-01',
          epic: null,
          assignee: null,
        },
      ],
    },
  },
};

const emptyEpicsMock = {
  request: { query: GET_EPICS, variables: { projectId: PROJECT_ID } },
  result: { data: { epics: [] } },
};

const emptyBacklogMock = {
  request: { query: GET_BACKLOG, variables: { projectId: PROJECT_ID } },
  result: { data: { backlog: [] } },
};

const projectMock = {
  request: { query: GET_PROJECT, variables: { id: PROJECT_ID } },
  result: { data: { project: { id: PROJECT_ID, name: 'Demo', key: 'DEMO', teamId: 'team-1', team: { id: 'team-1', name: 'Demo Team' } } } },
};

const sprintsMock = {
  request: { query: GET_SPRINTS, variables: { projectId: PROJECT_ID } },
  result: { data: { sprints: [] } },
};

const BASE_MOCKS = [projectMock, sprintsMock];

function renderView(mocks = [...BASE_MOCKS, epicsMock, backlogMock]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[`/ws/${PROJECT_ID}/backlog`]}>
        <Routes>
          <Route path="/ws/:projectId/backlog" element={<BacklogView />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BacklogView', () => {
  it('shows loading spinner initially', () => {
    renderView();
    expect(document.querySelector('svg, [class*="spinner"], [aria-label*="loading"]')).toBeTruthy();
  });

  it('renders the page title after data loads', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Product Backlog')).toBeInTheDocument();
    });
  });

  it('renders story titles after loading', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Inicio de sesión')).toBeInTheDocument();
      expect(screen.getByText('Registro de usuario')).toBeInTheDocument();
    });
  });

  it('renders epic group headers', async () => {
    renderView();
    await waitFor(() => {
      // "Autenticación" appears in EpicList sidebar AND in EpicGroup header
      expect(screen.getAllByText('Autenticación').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Sin épica')).toBeInTheDocument();
    });
  });

  it('shows story count in epic group headers', async () => {
    renderView();
    await waitFor(() => {
      // epic group count badges
      const countBadges = screen.getAllByText('1');
      expect(countBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders correctly with empty backlog', async () => {
    renderView([...BASE_MOCKS, emptyEpicsMock, emptyBacklogMock]);
    await waitFor(() => {
      expect(screen.getByText('Product Backlog')).toBeInTheDocument();
    });
    expect(screen.queryByText('Inicio de sesión')).not.toBeInTheDocument();
  });
});
