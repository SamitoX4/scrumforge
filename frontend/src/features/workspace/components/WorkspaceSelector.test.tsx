import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceSelector } from './WorkspaceSelector';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';

const workspacesMock = {
  request: { query: GET_WORKSPACES },
  result: {
    data: {
      workspaces: [
        { id: 'w1', name: 'Acme Corp', slug: 'acme-corp', ownerId: 'u1', createdAt: '2024-01-01', teams: [] },
        { id: 'w2', name: 'Side Project', slug: 'side-project', ownerId: 'u1', createdAt: '2024-01-02', teams: [] },
      ],
    },
  },
};

function renderSelector(collapsed = false) {
  return render(
    <MockedProvider mocks={[workspacesMock]}>
      <MemoryRouter>
        <WorkspaceSelector collapsed={collapsed} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('WorkspaceSelector', () => {
  beforeEach(() => localStorage.clear());

  it('renders nothing until workspaces are loaded', () => {
    const { container } = renderSelector();
    // Nothing shown yet (query pending)
    expect(container.querySelector('button')).toBeNull();
  });

  it('shows workspace name after data loads', async () => {
    renderSelector();
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('opens menu when trigger is clicked', async () => {
    renderSelector();
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all workspaces in the menu', async () => {
    renderSelector();
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Side Project')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1);
  });

  it('closes menu when Escape is pressed', async () => {
    renderSelector();
    await waitFor(() => screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('does not show name when collapsed', async () => {
    renderSelector(true);
    await waitFor(() => screen.getByRole('button'));
    // In collapsed mode the menu name is hidden; button exists but no visible name text
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });
});
