/**
 * @file main.tsx
 * @description Punto de entrada principal de la aplicación ScrumForge.
 *
 * La función `bootstrap` se encarga de:
 *   1. Cargar extensiones premium (plugins de terceros o del plan) antes de
 *      montar React, para que sus rutas y componentes queden registrados antes
 *      de la primera renderización.
 *   2. Localizar el nodo DOM `#root` definido en `index.html`.
 *   3. Montar el árbol de componentes React dentro de `StrictMode`.
 *
 * StrictMode activa comprobaciones adicionales en desarrollo (doble render,
 * detección de efectos no puros, etc.) sin impacto en producción.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadFrontendExtensions } from './extensions/load-extensions';
import App from './App';

/**
 * Inicializa y monta la aplicación React.
 *
 * Es async porque `loadFrontendExtensions` puede necesitar importar módulos
 * de forma dinámica (lazy) antes de renderizar. Si fallara alguna extensión,
 * el error quedaría capturado por `.catch(console.error)` en la llamada final.
 */
async function bootstrap() {
  // Cargar extensiones premium antes de montar React.
  // Si VITE_ENABLED_EXTENSIONS="" el array estará vacío y no se carga nada.
  // Si la variable no está definida (dev), se intenta cargar todas las locales.
  await loadFrontendExtensions();

  // Verificar que el nodo raíz existe en el HTML; si no, el build está roto.
  const root = document.getElementById('root');
  if (!root) throw new Error('#root element not found');

  // createRoot es la API de React 18+ para renderizado concurrente.
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Arrancar la aplicación; cualquier error no capturado internamente
// se imprime en consola para facilitar el diagnóstico.
bootstrap().catch(console.error);
