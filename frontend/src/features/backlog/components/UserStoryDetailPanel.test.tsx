import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { vi } from 'vitest';
import { UserStoryDetailPanel } from './UserStoryDetailPanel';
import { GET_USER_STORY } from '@/graphql/backlog/backlog.queries';
import { GET_COMMENTS } from '@/graphql/comment/comment.operations';
import { CREATE_TASK } from '@/graphql/task/task.mutations';
import type { Epic } from '@/types/api.types';

vi.mock('@/store/ui.store', () => ({
  useUIStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'user-1', name: 'Demo User' } }),
}));

const mockStory = {
  id: 'story-1',
  title: 'Historia de prueba',
  description: 'Descripción de la historia',
  status: 'TODO',
  points: 5,
  priority: 'HIGH',
  order: 0,
  epicId: null,
  sprintId: null,
  assigneeId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  epic: null,
  sprint: null,
  assignee: null,
  tasks: [],
};

const storyQueryMock = {
  request: { query: GET_USER_STORY, variables: { id: 'story-1' } },
  result: { data: { userStory: mockStory } },
};

const commentsQueryMock = {
  request: { query: GET_COMMENTS, variables: { userStoryId: 'story-1' } },
  result: { data: { comments: [] } },
};

const epics: Epic[] = [];

function renderPanel(storyId: string | null = 'story-1', extraMocks: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[storyQueryMock, commentsQueryMock, ...extraMocks]}>
      <UserStoryDetailPanel
        storyId={storyId}
        projectId="project-1"
        epics={epics}
        onClose={vi.fn()}
      />
    </MockedProvider>,
  );
}

describe('UserStoryDetailPanel', () => {
  it('renders nothing when storyId is null', () => {
    const { container } = renderPanel(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows story title after data loads', async () => {
    renderPanel();
    expect(await screen.findByDisplayValue('Historia de prueba')).toBeInTheDocument();
  });

  it('shows story description after data loads', async () => {
    renderPanel();
    expect(await screen.findByDisplayValue('Descripción de la historia')).toBeInTheDocument();
  });

  it('shows Guardar button when title is edited', async () => {
    renderPanel();
    const titleInput = await screen.findByDisplayValue('Historia de prueba');
    fireEvent.change(titleInput, { target: { value: 'Nuevo título' } });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });

  it('shows "Añadir" button for subtasks', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: /añadir/i })).toBeInTheDocument();
  });

  it('shows inline task input when Añadir is clicked', async () => {
    renderPanel();
    const addBtn = await screen.findByRole('button', { name: /añadir/i });
    fireEvent.click(addBtn);
    expect(screen.getByPlaceholderText(/título de la subtarea/i)).toBeInTheDocument();
  });

  it('creates a task on Enter in task input', async () => {
    const createTaskMock = {
      request: {
        query: CREATE_TASK,
        variables: { input: { title: 'Nueva subtarea', userStoryId: 'story-1' } },
      },
      result: {
        data: {
          createTask: {
            id: 'task-1',
            title: 'Nueva subtarea',
            status: 'TODO',
            order: 0,
            assigneeId: null,
            assignee: null,
          },
        },
      },
    };

    renderPanel('story-1', [storyQueryMock, commentsQueryMock, createTaskMock]);

    const addBtn = await screen.findByRole('button', { name: /añadir/i });
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText(/título de la subtarea/i);
    fireEvent.change(input, { target: { value: 'Nueva subtarea' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/título de la subtarea/i)).not.toBeInTheDocument();
    });
  });

  it('closes task input on Escape', async () => {
    renderPanel();
    const addBtn = await screen.findByRole('button', { name: /añadir/i });
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText(/título de la subtarea/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText(/título de la subtarea/i)).not.toBeInTheDocument();
  });

  it('shows comments section', async () => {
    renderPanel();
    expect(await screen.findByText(/comentarios/i)).toBeInTheDocument();
  });
});
