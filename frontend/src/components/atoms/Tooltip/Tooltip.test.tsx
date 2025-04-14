import { render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders the children element', () => {
    render(
      <Tooltip content="Información adicional">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
  });

  it('renders the tooltip text with role="tooltip"', () => {
    render(
      <Tooltip content="Ayuda aquí">
        <span>Trigger</span>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ayuda aquí');
  });

  it('defaults to top placement', () => {
    const { container } = render(
      <Tooltip content="Top">
        <span>T</span>
      </Tooltip>,
    );
    // The tooltip element should have the --top modifier class
    expect(container.querySelector('[class*="tooltip--top"]')).toBeInTheDocument();
  });

  it('applies the specified placement class', () => {
    const { container } = render(
      <Tooltip content="Bottom" placement="bottom">
        <span>T</span>
      </Tooltip>,
    );
    expect(container.querySelector('[class*="tooltip--bottom"]')).toBeInTheDocument();
  });

  it('renders multiple children types correctly', () => {
    render(
      <Tooltip content="Icono">
        <img src="test.png" alt="icon" />
      </Tooltip>,
    );
    expect(screen.getByAltText('icon')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
