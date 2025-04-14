import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders label text', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders required asterisk when required=true', () => {
    const { container } = render(
      <FormField label="Email" required>
        <input />
      </FormField>,
    );
    // aria-hidden span with " *" inside the label
    const asterisk = container.querySelector('[aria-hidden="true"]');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk?.textContent).toContain('*');
  });

  it('does not render required asterisk by default', () => {
    const { container } = render(
      <FormField label="Email">
        <input />
      </FormField>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('renders hint when no error', () => {
    render(
      <FormField label="Email" hint="Usa tu correo institucional">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Usa tu correo institucional')).toBeInTheDocument();
  });

  it('renders error message with alert role', () => {
    render(
      <FormField label="Email" error="El correo es requerido">
        <input />
      </FormField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('El correo es requerido');
  });

  it('hides hint when error is present', () => {
    render(
      <FormField label="Email" hint="Usa tu correo" error="Correo inválido">
        <input />
      </FormField>,
    );
    expect(screen.queryByText('Usa tu correo')).not.toBeInTheDocument();
    expect(screen.getByText('Correo inválido')).toBeInTheDocument();
  });

  it('associates label with child input via htmlFor', () => {
    render(
      <FormField label="Nombre" htmlFor="name-input">
        <input id="name-input" />
      </FormField>,
    );
    const label = screen.getByText('Nombre').closest('label');
    expect(label).toHaveAttribute('for', 'name-input');
  });
});
