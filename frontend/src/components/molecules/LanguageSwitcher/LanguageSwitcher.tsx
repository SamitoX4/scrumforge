import { useTranslation } from 'react-i18next';

/**
 * LanguageSwitcher — botón que alterna el idioma de la interfaz entre español e inglés.
 *
 * Persiste la preferencia del usuario en `localStorage` bajo la clave
 * `scrumforge_locale` para que se restaure en la siguiente visita.
 * El valor inicial del idioma es cargado por i18next en su configuración de arranque.
 *
 * Muestra la etiqueta del idioma DESTINO (no el actual), de modo que el usuario
 * siempre ve hacia dónde va a cambiar:
 * - Idioma actual ES → muestra "EN"
 * - Idioma actual EN → muestra "ES"
 *
 * El atributo `title` proporciona contexto adicional al pasar el cursor y sirve
 * de etiqueta accesible para lectores de pantalla cuando el botón carece de texto
 * suficientemente descriptivo.
 *
 * @example
 * // Se renderiza en el AppHeader junto a otros controles globales
 * <LanguageSwitcher />
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggle = () => {
    // Calcula el siguiente idioma como el opuesto al actual
    const next = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
    // Persiste la preferencia para restaurarla en la próxima carga de la app
    localStorage.setItem('scrumforge_locale', next);
  };

  return (
    <button
      onClick={toggle}
      // El title se adapta al idioma actual para guiar al usuario
      title={i18n.language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      style={{
        background: 'none',
        border: '1px solid #E2E8F0',
        borderRadius: 6,
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: 'pointer',
        color: '#475569',
      }}
    >
      {/* Muestra la etiqueta del idioma destino, no el actual */}
      {i18n.language === 'es' ? 'EN' : 'ES'}
    </button>
  );
}
