import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Resuelve el alias de Vite para una extensión premium con la siguiente prioridad:
 *   1. frontend/extensions/<name>/index.ts  — paquete descargado del portal (cliente)
 *   2. ../../scrumforge-extensions/packages/frontend-ext-<name>/src/index.ts — dev monorepo
 *   3. src/extensions/_stub.ts              — stub vacío (extensión no instalada)
 *
 * El stub garantiza que Vite siempre resuelva el alias sin fallar,
 * y loadFrontendExtensions() ignora silenciosamente los módulos que devuelven null.
 */
function extAlias(name: string): Record<string, string> {
  const pkg  = `@scrumforge/frontend-ext-${name}`;
  const stub = path.resolve(__dirname, 'src/extensions/_stub.ts');

  const customerPath = path.resolve(__dirname, `extensions/${name}/index.ts`);
  if (fs.existsSync(customerPath)) return { [pkg]: customerPath };

  const devPath = path.resolve(__dirname, `../../scrumforge-extensions/packages/frontend-ext-${name}/src/index.ts`);
  if (fs.existsSync(devPath)) return { [pkg]: devPath };

  return { [pkg]: stub };
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@scrumforge/frontend-sdk': path.resolve(__dirname, '../packages/frontend-sdk/src/index.ts'),
      ...extAlias('planning-poker'),
      ...extAlias('ai'),
      ...extAlias('advanced-reports'),
      ...extAlias('retrospective-premium'),
      ...extAlias('billing-stripe'),
      ...extAlias('integrations'),
      ...extAlias('wiki'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },
});
