import { render, screen } from '@testing-library/react';
import { VelocityChart } from './VelocityChart';

const mockData = [
  { sprintId: 's1', sprintName: 'Sprint 1', completedPoints: 32, plannedPoints: 40 },
  { sprintId: 's2', sprintName: 'Sprint 2', completedPoints: 45, plannedPoints: 45 },
  { sprintId: 's3', sprintName: 'Sprint 3', completedPoints: 28, plannedPoints: 35 },
];

describe('VelocityChart', () => {
  it('shows placeholder when data is empty', () => {
    render(<VelocityChart data={[]} />);
    expect(
      screen.getByText(/completa tu primer sprint/i),
    ).toBeInTheDocument();
  });

  it('renders the bar chart when data is provided', () => {
    const { container } = render(<VelocityChart data={mockData} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not show placeholder when data is provided', () => {
    render(<VelocityChart data={mockData} />);
    expect(screen.queryByText(/completa tu primer sprint/i)).not.toBeInTheDocument();
  });
});
