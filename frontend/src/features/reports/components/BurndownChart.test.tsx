import { render, screen } from '@testing-library/react';
import { BurndownChart } from './BurndownChart';

const mockData = [
  { date: '2026-01-01', remainingPoints: 40, idealPoints: 40 },
  { date: '2026-01-03', remainingPoints: 30, idealPoints: 27 },
  { date: '2026-01-07', remainingPoints: 10, idealPoints: 13 },
  { date: '2026-01-10', remainingPoints: 0, idealPoints: 0 },
];

describe('BurndownChart', () => {
  it('shows descriptive empty message when data is empty', () => {
    render(<BurndownChart data={[]} />);
    expect(
      screen.getByText(/historias del sprint no tienen puntos estimados/i),
    ).toBeInTheDocument();
  });

  it('renders the chart container when data is provided', () => {
    const { container } = render(<BurndownChart data={mockData} />);
    // Recharts renders an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not show empty message when data is provided', () => {
    render(<BurndownChart data={mockData} />);
    expect(
      screen.queryByText(/historias del sprint no tienen puntos estimados/i),
    ).not.toBeInTheDocument();
  });
});
