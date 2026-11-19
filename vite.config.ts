import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Development only: serves the gitignored local copy of the spreadsheet at /__local/sheet.ods
// so the dashboard opens with real data while developing. Never included in the build.
function localSheet(): Plugin {
  return {
    name: 'local-sheet',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local/sheet.ods', (_req, res) => {
        const f = fileURLToPath(new URL('./local-data/ModeloRafael.ods', import.meta.url));
        if (!existsSync(f)) { res.statusCode = 404; res.end(); return; }
        res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.spreadsheet');
        res.end(readFileSync(f));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), localSheet()],
  // Browsers have a native XML parser; keep @xmldom/xmldom out of the bundle (tests still use it).
  resolve: process.env.VITEST ? {} : { alias: { '@xmldom/xmldom': fileURLToPath(new URL('./src/lib/dom-shim.ts', import.meta.url)) } },
  server: { port: 5178, host: '127.0.0.1' },
  build: { target: 'es2020', sourcemap: false },
});
