/**
 * @fileoverview Configuración e inicialización de i18next para ScrumForge.
 *
 * Este módulo configura el sistema de internacionalización de la aplicación
 * usando `i18next` con el plugin `react-i18next`. Se importa una sola vez
 * en el punto de entrada de la aplicación (main.tsx) y expone la instancia
 * configurada para que los componentes puedan usar el hook `useTranslation()`.
 *
 * Idiomas soportados:
 *   - `es` (español) — idioma principal y fallback
 *   - `en` (inglés) — idioma alternativo
 *
 * La selección del idioma sigue esta prioridad:
 *   1. Preferencia guardada por el usuario en `localStorage`
 *   2. Idioma del navegador (si empieza por "en", usa inglés; si no, español)
 *   3. Fallback hardcodeado: español
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es';
import en from './locales/en';

i18n
  // Integra i18next con React para habilitar el hook useTranslation() y
  // el componente <Trans> en toda la aplicación
  .use(initReactI18next)
  .init({
    resources: {
      // Cada idioma se organiza bajo el namespace "translation" (por defecto),
      // evitando la necesidad de especificar namespace en useTranslation()
      es: { translation: es },
      en: { translation: en },
    },

    // Determina el idioma inicial con la siguiente estrategia:
    // 1. Si el usuario ya eligió idioma previamente, se respeta su preferencia
    // 2. Si el navegador reporta un idioma inglés, se usa inglés
    // 3. En cualquier otro caso, se usa español como idioma por defecto
    lng: localStorage.getItem('scrumforge_locale') ?? (navigator.language.startsWith('en') ? 'en' : 'es'),

    // Idioma de reserva cuando una clave no existe en el idioma activo.
    // Se usa español porque es el idioma más completo del proyecto.
    fallbackLng: 'es',

    interpolation: {
      // React ya escapa el HTML por defecto en el DOM virtual,
      // por lo que deshabilitar el escaping de i18next evita doble
      // codificación de caracteres especiales (ej. &amp; → &amp;amp;)
      escapeValue: false,
    },
  });

export default i18n;
