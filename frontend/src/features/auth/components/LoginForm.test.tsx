import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

import { useAuth } from '@/hooks/useAuth';

const mockLogin = vi.fn();

function renderForm() {
  vi.mocked(useAuth).mockReturnValue({
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
    loading: false,
    user: null,
    isAuthenticated: false,
  });
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  );
}

describe('LoginForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders email and password fields', () => {
    renderForm();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('shows credential error inline on password field when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    renderForm();
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument();
  });

  it('clears credential error when user edits the password', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    renderForm();
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await screen.findByText(/credenciales inválidas/i);

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'newpassword' },
    });
    expect(screen.queryByText(/credenciales inválidas/i)).not.toBeInTheDocument();
  });

  it('clears credential error when user edits the email', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    renderForm();
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await screen.findByText(/credenciales inválidas/i);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'other@test.com' },
    });
    expect(screen.queryByText(/credenciales inválidas/i)).not.toBeInTheDocument();
  });

  it('calls login with correct email and password', async () => {
    mockLogin.mockResolvedValueOnce({});
    renderForm();
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123');
    });
  });
});
