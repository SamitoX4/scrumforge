import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook configuration for ScrumForge.
 *
 * To run Storybook:
 *   npm install --save-dev @storybook/react-vite @storybook/addon-essentials @storybook/addon-a11y
 *   npx storybook dev -p 6006
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  addons: [
    '@storybook/addon-essentials',   // Controls, Actions, Docs, Viewport, etc.
    '@storybook/addon-a11y',         // Accessibility checks
  ],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  docs: {
    autodocs: 'tag',
  },

  viteFinal: async (config) => {
    // Ensure the Vite alias @/ resolves inside Storybook
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': new URL('../src', import.meta.url).pathname,
    };
    return config;
  },
};

export default config;
