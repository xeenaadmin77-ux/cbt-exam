import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);

function apiPlugin(): Plugin {
  return {
    name: 'cbt-api-server',
    configureServer(server) {
      try {
        const { app } = require('./functions/index.js');
        if (app) {
          server.middlewares.use('/api', app);
          server.middlewares.use('/settings', (req, res, next) => {
            req.url = '/settings';
            app(req, res, next);
          });
        }
      } catch (err) {
        console.warn('[VITE API PLUGIN] Could not mount functions/index.js:', err);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
