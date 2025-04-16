import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { CREATE_WORKSPACE } from '@/graphql/project/project.mutations';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';

const workspacesMock = {
  request: { query: GET_WORKSPACES },
  result: { data: { workspaces: [] } },
};

const createMock = {
  request: {
    query: CREATE_WORKSPACE,
    variables: { input: { name: 'Nuevo Corp', slug: 'nuevo-corp' } },
  },
  result: {
    data: {
      createWorkspace: { id: 'w-new', name: 'Nuevo Corp', slug: 'nuevo-corp', teams: [] },
    },
  },
};

function renderModal(isOpen = true, onClose = vi.fn(), onCreated = vi.fn()) {
  return render(
    <MockedProvider mocks={[workspacesMock, createMock]}>
      <MemoryRouter>
        <CreateWorkspaceModal isOpen={isOpen} onClose={onClose} onCreated={onCreated} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('CreateWorkspaceModal', () => {
  it('renders nothing when closed', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the form fields when open', () => {
    renderModal();
    expect(screen.getByLabelText(/nombre del workspace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/identificador/i)).toBeInTheDocument();
  });

  it('auto-generates slug from name', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/nombre del workspace/i), {
      target: { value: 'Mi Empresa' },
    });
    expect(screen.getByLabelText(/identificador/i)).toHaveValue('mi-empresa');
  });

  it('disables submit when name or slug is empty', () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /crear workspace/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit when both fields are filled', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/nombre del workspace/i), {
      target: { value: 'Nuevo Corp' },
    });
    expect(screen.getByRole('button', { name: /crear workspace/i })).not.toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onCreated with the new workspace id on success', async () => {
    const onCreated = vi.fn();
    renderModal(true, vi.fn(), onCreated);
    fireEvent.change(screen.getByLabelText(/nombre del workspace/i), {
      target: { value: 'Nuevo Corp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear workspace/i }));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('w-new');
    });
  });
});
