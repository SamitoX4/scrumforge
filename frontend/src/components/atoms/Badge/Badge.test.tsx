import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge, PriorityBadge, RoleBadge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Custom label</Badge>);
    expect(screen.getByText('Custom label')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Badge className="my-class">Label</Badge>);
    expect(screen.getByText('Label').className).toContain('my-class');
  });
});

describe('StatusBadge', () => {
  it('shows translated label for TODO', () => {
    render(<StatusBadge status="TODO" />);
    expect(screen.getByText('Por hacer')).toBeInTheDocument();
  });

  it('shows translated label for IN_PROGRESS', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('En progreso')).toBeInTheDocument();
  });

  it('shows translated label for DONE', () => {
    render(<StatusBadge status="DONE" />);
    expect(screen.getByText('Listo')).toBeInTheDocument();
  });
});

describe('PriorityBadge', () => {
  it('shows translated label for HIGH', () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('shows translated label for CRITICAL', () => {
    render(<PriorityBadge priority="CRITICAL" />);
    expect(screen.getByText('Crítica')).toBeInTheDocument();
  });
});

describe('RoleBadge', () => {
  it('shows Product Owner label', () => {
    render(<RoleBadge role="PRODUCT_OWNER" />);
    expect(screen.getByText('Product Owner')).toBeInTheDocument();
  });

  it('shows Developer label', () => {
    render(<RoleBadge role="DEVELOPER" />);
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });
});
