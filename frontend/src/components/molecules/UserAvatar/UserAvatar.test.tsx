import { render, screen } from '@testing-library/react';
import { UserAvatar } from './UserAvatar';

const user = { name: 'Ana García', email: 'ana@test.com', avatarUrl: null };

describe('UserAvatar', () => {
  it('renders the user name', () => {
    render(<UserAvatar user={user} />);
    expect(screen.getByText('Ana García')).toBeInTheDocument();
  });

  it('renders the role label when role is provided', () => {
    render(<UserAvatar user={user} role="PRODUCT_OWNER" />);
    expect(screen.getByText('Product Owner')).toBeInTheDocument();
  });

  it('renders email when no role is provided', () => {
    render(<UserAvatar user={user} />);
    expect(screen.getByText('ana@test.com')).toBeInTheDocument();
  });

  it('does not render email or role when showName is false', () => {
    render(<UserAvatar user={user} showName={false} />);
    expect(screen.queryByText('Ana García')).not.toBeInTheDocument();
    expect(screen.queryByText('ana@test.com')).not.toBeInTheDocument();
  });

  it('renders all four role labels correctly', () => {
    const roles: Array<[import('@/types/api.types').TeamRole, string]> = [
      ['SCRUM_MASTER', 'Scrum Master'],
      ['DEVELOPER', 'Developer'],
      ['STAKEHOLDER', 'Stakeholder'],
    ];
    for (const [role, label] of roles) {
      const { unmount } = render(<UserAvatar user={user} role={role} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
