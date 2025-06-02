import { render, screen } from '@testing-library/react';
import { SprintSummaryCard } from './SprintSummaryCard';
import type { Sprint } from '@/types/api.types';

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    goal: null,
    projectId: 'p1',
    startDate: '2026-03-01T00:00:00.000Z',
    endDate: '2099-12-31T00:00:00.000Z', // far future — always "days remaining"
    status: 'ACTIVE',
    createdAt: '2026-03-01T00:00:00.000Z',
    userStories: [],
    stats: {
      totalPoints: 40,
      completedPoints: 20,
      totalStories: 10,
      completedStories: 5,
      progressPercent: 50,
    },
    ...overrides,
  };
}

describe('SprintSummaryCard', () => {
  it('renders sprint name', () => {
    render(<SprintSummaryCard sprint={makeSprint()} />);
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
  });

  it('renders sprint goal when provided', () => {
    render(<SprintSummaryCard sprint={makeSprint({ goal: 'Lanzar MVP' })} />);
    expect(screen.getByText('Lanzar MVP')).toBeInTheDocument();
  });

  it('does not render goal paragraph when goal is null', () => {
    render(<SprintSummaryCard sprint={makeSprint({ goal: null })} />);
    expect(screen.queryByText('Lanzar MVP')).not.toBeInTheDocument();
  });

  it('renders progress bar with correct aria attributes', () => {
    render(<SprintSummaryCard sprint={makeSprint()} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders progress label', () => {
    render(<SprintSummaryCard sprint={makeSprint()} />);
    expect(screen.getByText(/50% completado/)).toBeInTheDocument();
  });

  it('renders stories and points stats', () => {
    render(<SprintSummaryCard sprint={makeSprint()} />);
    expect(screen.getByText('5')).toBeInTheDocument();   // completedStories
    expect(screen.getByText('/ 10 historias')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();  // completedPoints
    expect(screen.getByText('/ 40 pts')).toBeInTheDocument();
  });

  it('shows overdue label when sprint end date is in the past', () => {
    render(<SprintSummaryCard sprint={makeSprint({ endDate: '2020-01-01T00:00:00.000Z' })} />);
    expect(screen.getByText(/retraso/i)).toBeInTheDocument();
  });

  it('shows days remaining label when sprint end date is in the future', () => {
    render(<SprintSummaryCard sprint={makeSprint({ endDate: '2099-12-31T00:00:00.000Z' })} />);
    expect(screen.getByText(/restantes/i)).toBeInTheDocument();
  });
});
