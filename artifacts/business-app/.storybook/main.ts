import type { StorybookConfig } from '@storybook/react-vite';

process.env.STORYBOOK = 'true';

const config: StorybookConfig = {
  stories: ['../src/twd/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  viteFinal: async (config) => {
    const plugins = (config.plugins ?? []) as unknown[];

    const cleanedPlugins = plugins.flat(Infinity).filter((plugin) => {
      if (!plugin || typeof plugin !== 'object') {
        return true;
      }

      const pluginName = String(
        (plugin as { name?: unknown }).name ?? ''
      ).toLowerCase();

      return (
        !pluginName.includes('pwa') &&
        !pluginName.includes('workbox') &&
        !pluginName.includes('generate-sw') &&
        !pluginName.includes('inject-manifest')
      );
    });

    config.plugins = cleanedPlugins as typeof config.plugins;

    return config;
  },
};

export default config;
