import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Devuelve un alias de Vite solo si el archivo de destino existe en disco.
 * Esto permite que el repo público funcione sin la carpeta scrumforge-extensions/.
 */
function extAlias(pkg: string, folder: string): Record<string, string> {
  const target = path.resolve(__dirname, `../../scrumforge-extensions/packages/${folder}/src/index.ts`);
  return fs.existsSync(target) ? { [pkg]: target } : {};
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@scrumforge/frontend-sdk': path.resolve(__dirname, '../packages/frontend-sdk/src/index.ts'),
      // Dev aliases — solo activos si scrumforge-extensions/ está clonado junto a este repo
      ...extAlias('@scrumforge/frontend-ext-planning-poker',        'frontend-ext-planning-poker'),
      ...extAlias('@scrumforge/frontend-ext-ai',                   'frontend-ext-ai'),
      ...extAlias('@scrumforge/frontend-ext-advanced-reports',     'frontend-ext-advanced-reports'),
      ...extAlias('@scrumforge/frontend-ext-retrospective-premium','frontend-ext-retrospective-premium'),
      ...extAlias('@scrumforge/frontend-ext-billing-stripe',       'frontend-ext-billing-stripe'),
      ...extAlias('@scrumforge/frontend-ext-integrations',         'frontend-ext-integrations'),
      ...extAlias('@scrumforge/frontend-ext-wiki',                 'frontend-ext-wiki'),
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
