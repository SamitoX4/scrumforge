import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu, type DropdownMenuItem } from './DropdownMenu';

const items: DropdownMenuItem[] = [
  { label: 'Ver detalle', icon: '👁', action: vi.fn() },
  { label: 'Eliminar', icon: '🗑', variant: 'danger', action: vi.fn() },
];

describe('DropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show the menu initially', () => {
    render(<DropdownMenu trigger={<button>⋮</button>} items={items} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the menu after clicking the trigger', () => {
    render(<DropdownMenu trigger={<button>⋮</button>} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders all menu items', () => {
    render(<DropdownMenu trigger={<button>⋮</button>} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    expect(screen.getByRole('menuitem', { name: /Ver detalle/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Eliminar/ })).toBeInTheDocument();
  });

  it('calls item action and closes menu on click', () => {
    render(<DropdownMenu trigger={<button>⋮</button>} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Ver detalle/ }));
    expect(items[0].action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the menu when Escape is pressed', () => {
    render(<DropdownMenu trigger={<button>⋮</button>} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles the menu on repeated trigger clicks', () => {
    render(<DropdownMenu trigger={<button>⋮</button>} items={items} />);
    const btn = screen.getByRole('button', { name: '⋮' });
    fireEvent.click(btn);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
