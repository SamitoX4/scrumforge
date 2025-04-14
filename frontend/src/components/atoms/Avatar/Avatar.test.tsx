import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders initials from single-word name', () => {
    render(<Avatar name="Carlos" />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders initials from two-word name', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders initials as uppercase', () => {
    render(<Avatar name="ana garcia" />);
    expect(screen.getByText('AG')).toBeInTheDocument();
  });

  it('renders an img when avatarUrl is provided', () => {
    render(<Avatar name="John Doe" avatarUrl="https://example.com/avatar.jpg" />);
    const img = screen.getByRole('img', { name: 'John Doe' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('falls back to initials when avatarUrl is null', () => {
    render(<Avatar name="Jane Smith" avatarUrl={null} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });
});
