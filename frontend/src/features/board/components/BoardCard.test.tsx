import { render, screen, fireEvent } from '@testing-library/react';
import { BoardCard } from './BoardCard';
import type { UserStory } from '@/types/api.types';

// Mock dnd-kit so tests don't need pointer-event support
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}));

function makeStory(overrides: Partial<UserStory> = {}): UserStory {
  return {
    id: 'story-1',
    title: 'Historia de prueba',
    description: null,
    epicId: null,
    projectId: 'project-1',
    sprintId: 'sprint-1',
    status: 'TODO',
    points: 5,
    priority: 'HIGH',
    assigneeId: null,
    order: 0,
    isBlocked: false,
    blockedReason: null,
    createdAt: '2026-01-01',
    tasks: [],
    ...overrides,
  };
}

describe('BoardCard', () => {
  it('renders story title and points', () => {
    render(<BoardCard story={makeStory()} />);
    expect(screen.getByText('Historia de prueba')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onCardClick when clicked', () => {
    const onCardClick = vi.fn();
    render(<BoardCard story={makeStory()} onCardClick={onCardClick} />);
    fireEvent.click(screen.getByText('Historia de prueba'));
    expect(onCardClick).toHaveBeenCalledWith('story-1');
  });

  // ── Blocked indicator ─────────────────────────────────────────────────────

  it('does NOT show blocked badge when story is not blocked', () => {
    render(<BoardCard story={makeStory({ isBlocked: false })} />);
    expect(screen.queryByText(/bloqueada/i)).not.toBeInTheDocument();
  });

  it('shows blocked badge when story is blocked', () => {
    render(<BoardCard story={makeStory({ isBlocked: true, blockedReason: 'Falta API' })} />);
    expect(screen.getByText(/bloqueada/i)).toBeInTheDocument();
  });

  it('shows blocked badge title with the blocked reason', () => {
    render(
      <BoardCard story={makeStory({ isBlocked: true, blockedReason: 'Dependencia externa pendiente' })} />,
    );
    const badge = screen.getByText(/bloqueada/i);
    expect(badge).toHaveAttribute('title', 'Dependencia externa pendiente');
  });

  it('shows generic title on blocked badge when no reason provided', () => {
    render(<BoardCard story={makeStory({ isBlocked: true, blockedReason: null })} />);
    const badge = screen.getByText(/bloqueada/i);
    expect(badge).toHaveAttribute('title', 'Historia bloqueada');
  });

  // ── Block / Unblock menu actions ──────────────────────────────────────────

  it('shows "Marcar bloqueada" option in menu when story is NOT blocked', () => {
    const onBlockClick = vi.fn();
    render(
      <BoardCard story={makeStory({ isBlocked: false })} onBlockClick={onBlockClick} />,
    );
    fireEvent.click(screen.getByLabelText('Opciones'));
    expect(screen.getByText('Marcar bloqueada')).toBeInTheDocument();
  });

  it('calls onBlockClick when "Marcar bloqueada" is clicked', () => {
    const onBlockClick = vi.fn();
    render(
      <BoardCard story={makeStory({ isBlocked: false })} onBlockClick={onBlockClick} />,
    );
    fireEvent.click(screen.getByLabelText('Opciones'));
    fireEvent.click(screen.getByText('Marcar bloqueada'));
    expect(onBlockClick).toHaveBeenCalledWith('story-1');
  });

  it('shows "Resolver bloqueo" option in menu when story IS blocked', () => {
    const onUnblockClick = vi.fn();
    render(
      <BoardCard
        story={makeStory({ isBlocked: true, blockedReason: 'Falta API' })}
        onUnblockClick={onUnblockClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Opciones'));
    expect(screen.getByText('Resolver bloqueo')).toBeInTheDocument();
  });

  it('calls onUnblockClick when "Resolver bloqueo" is clicked', () => {
    const onUnblockClick = vi.fn();
    render(
      <BoardCard
        story={makeStory({ isBlocked: true, blockedReason: 'Falta API' })}
        onUnblockClick={onUnblockClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Opciones'));
    fireEvent.click(screen.getByText('Resolver bloqueo'));
    expect(onUnblockClick).toHaveBeenCalledWith('story-1');
  });

  it('does NOT show "Marcar bloqueada" when story is already blocked', () => {
    render(
      <BoardCard
        story={makeStory({ isBlocked: true })}
        onBlockClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Opciones'));
    expect(screen.queryByText('Marcar bloqueada')).not.toBeInTheDocument();
  });

  it('does NOT show "Resolver bloqueo" when story is not blocked', () => {
    render(
      <BoardCard
        story={makeStory({ isBlocked: false })}
        onUnblockClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Opciones'));
    expect(screen.queryByText('Resolver bloqueo')).not.toBeInTheDocument();
  });
});
