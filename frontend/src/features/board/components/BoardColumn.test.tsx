import { render, screen } from '@testing-library/react';
import { BoardColumn } from './BoardColumn';
import type { UserStory } from '@/types/api.types';

// Mock dnd-kit so tests don't need pointer-event support
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    isOver: false,
    setNodeRef: vi.fn(),
  }),
}));

// Minimal mock for BoardCard children
vi.mock('./BoardCard', () => ({
  BoardCard: ({ story }: { story: UserStory }) => <div data-testid="board-card">{story.title}</div>,
}));

function makeStory(id: string, title: string): UserStory {
  return {
    id,
    title,
    description: null,
    epicId: null,
    projectId: 'project-1',
    sprintId: 'sprint-1',
    status: 'TODO',
    points: 3,
    priority: 'MEDIUM',
    assigneeId: null,
    order: 0,
    isBlocked: false,
    blockedReason: null,
    createdAt: '2026-01-01',
    tasks: [],
  };
}

describe('BoardColumn', () => {
  it('renders column label', () => {
    render(<BoardColumn columnId="TODO" label="Por hacer" stories={[]} />);
    expect(screen.getByText('Por hacer')).toBeInTheDocument();
  });

  it('shows placeholder when column is empty', () => {
    render(<BoardColumn columnId="TODO" label="Por hacer" stories={[]} />);
    expect(screen.getByText('Arrastra aquí')).toBeInTheDocument();
  });

  it('does not show placeholder when column has stories', () => {
    const stories = [makeStory('s1', 'Historia 1'), makeStory('s2', 'Historia 2')];
    render(<BoardColumn columnId="TODO" label="Por hacer" stories={stories} />);
    expect(screen.queryByText('Arrastra aquí')).not.toBeInTheDocument();
  });

  it('shows story count without WIP limit', () => {
    const stories = [makeStory('s1', 'Historia 1'), makeStory('s2', 'Historia 2')];
    render(<BoardColumn columnId="TODO" label="Por hacer" stories={stories} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows count/limit badge when WIP limit is set', () => {
    const stories = [makeStory('s1', 'Historia 1')];
    render(<BoardColumn columnId="TODO" label="Por hacer" stories={stories} wipLimit={3} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('shows count/limit badge in exceeded state when WIP is surpassed', () => {
    const stories = [makeStory('s1', 'H1'), makeStory('s2', 'H2'), makeStory('s3', 'H3'), makeStory('s4', 'H4')];
    render(<BoardColumn columnId="IN_PROGRESS" label="En progreso" stories={stories} wipLimit={3} />);
    const badge = screen.getByText('4/3');
    expect(badge).toBeInTheDocument();
    // Badge should have the exceeded class (check accessible title)
    expect(badge).toHaveAttribute('title', 'Límite WIP superado (4/3)');
  });

  it('renders a card for each story', () => {
    const stories = [makeStory('s1', 'Historia A'), makeStory('s2', 'Historia B')];
    render(<BoardColumn columnId="TODO" label="Por hacer" stories={stories} />);
    expect(screen.getAllByTestId('board-card')).toHaveLength(2);
    expect(screen.getByText('Historia A')).toBeInTheDocument();
    expect(screen.getByText('Historia B')).toBeInTheDocument();
  });
});
