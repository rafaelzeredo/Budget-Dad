import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Development only: serves the git-ignored plain copy of the processed data (local-data/budget.json,
// made by `npm run data`) so the dev server opens straight into the dashboard. Never part of the build.
function localData(): Plugin {
  return {
    name: 'local-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local/budget.json', (_req, res) => {
        const f = fileURLToPath(new URL('./local-data/budget.json', import.meta.url));
        if (!existsSync(f)) { res.statusCode = 404; res.end(); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(f));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), localData()],
  server: { port: 5178, host: '127.0.0.1' },
  build: { target: 'es2020', sourcemap: false },
});
