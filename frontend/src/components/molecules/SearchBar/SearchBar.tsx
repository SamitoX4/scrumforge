import { useRef } from 'react';
import clsx from 'clsx';
import styles from './SearchBar.module.scss';

/**
 * Props del componente SearchBar.
 *
 * @property value       - Valor actual del campo de búsqueda (componente controlado).
 * @property onChange    - Callback invocado en cada pulsación de tecla con el nuevo valor.
 *                         Si se necesita debounce, debe aplicarse en el consumidor.
 * @property placeholder - Texto de placeholder. Por defecto 'Buscar...'.
 * @property className   - Clases CSS adicionales para el wrapper externo.
 * @property disabled    - Cuando es true, el campo y el botón de limpiar quedan inactivos.
 */
interface SearchBarProps {
  /** Current search value (controlled). */
  value: string;
  /** Called immediately on every keystroke. Apply useDebounce upstream if needed. */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
}

/**
 * SearchBar — campo de búsqueda estilizado con botón de limpieza integrado.
 *
 * Componente controlado: el estado del valor vive en el padre. Si la búsqueda
 * dispara llamadas a la API, el consumidor debe aplicar debounce externamente
 * (p.ej. con el hook `useDebounce`) para no saturar el backend.
 *
 * El botón de limpieza (✕) solo se muestra cuando hay texto y el campo está activo.
 * Tras limpiar, el foco regresa al input automáticamente para que el usuario
 * pueda escribir de nuevo sin hacer clic.
 *
 * El atributo `type="search"` activa el comportamiento nativo del navegador
 * (incluida la tecla Escape para limpiar en algunos navegadores) y el semántico
 * correcto para lectores de pantalla.
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebounce(query, 300);
 *
 * // Al cambiar debouncedQuery se dispara la búsqueda real
 * <SearchBar value={query} onChange={setQuery} placeholder="Buscar historias..." />
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
  disabled = false,
}: SearchBarProps) {
  // Referencia al input para devolver el foco tras limpiar la búsqueda
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClear() {
    onChange('');
    // Devuelve el foco al input para que el usuario pueda escribir inmediatamente
    inputRef.current?.focus();
  }

  return (
    <div className={clsx(styles.wrapper, disabled && styles['wrapper--disabled'], className)}>
      {/* Icono decorativo — aria-hidden para no ser anunciado por lectores de pantalla */}
      <span className={styles.searchIcon} aria-hidden="true">🔍</span>

      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        // aria-label repite el placeholder para que el campo sea accesible sin <label> visible
        aria-label={placeholder}
        disabled={disabled}
      />

      {/* El botón de limpiar solo aparece cuando hay texto y el campo está habilitado */}
      {value && !disabled && (
        <button
          className={styles.clearBtn}
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          type="button"
          // tabIndex=-1 evita que el botón interrumpa el flujo de tabulación normal
          tabIndex={-1}
        >
          ✕
        </button>
      )}
    </div>
  );
}
