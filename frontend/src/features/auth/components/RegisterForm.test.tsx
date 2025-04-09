import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { RegisterForm } from './RegisterForm';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

import { useAuth } from '@/hooks/useAuth';

const mockRegister = vi.fn();

function renderForm() {
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    register: mockRegister,
    logout: vi.fn(),
    loading: false,
    user: null,
    isAuthenticated: false,
  });
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  );
}

describe('RegisterForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders all fields', () => {
    renderForm();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('shows password inline error when password is shorter than 8 characters', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'juan@test.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('clears password error when user edits the password field', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '12345678' } });
    expect(screen.queryByText(/al menos 8 caracteres/i)).not.toBeInTheDocument();
  });

  it('shows email inline error when backend returns email conflict', async () => {
    mockRegister.mockRejectedValueOnce(new Error('El email ya está registrado'));
    renderForm();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'juan@test.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/email ya está registrado/i)).toBeInTheDocument();
  });

  it('clears email error when user edits the email field', async () => {
    mockRegister.mockRejectedValueOnce(new Error('El email ya está registrado'));
    renderForm();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'juan@test.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));
    await screen.findByText(/email ya está registrado/i);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'otro@test.com' } });
    expect(screen.queryByText(/email ya está registrado/i)).not.toBeInTheDocument();
  });

  it('calls register with correct args when form is valid', async () => {
    mockRegister.mockResolvedValueOnce({});
    renderForm();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'juan@test.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Juan', 'juan@test.com', 'password123');
    });
  });
});
