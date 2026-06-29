import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';

function runsApiPlugin(): Plugin {
  return {
    name: 'runs-api',
    configureServer(server) {
      const runsDir = path.resolve(__dirname, 'runs');
      const memDir  = path.resolve(__dirname, 'studio-memory');

      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url ?? '').split('?')[0];

        if (urlPath === '/api/runs') {
          try {
            if (!fs.existsSync(runsDir)) { res.setHeader('Content-Type', 'application/json'); res.end('[]'); return; }
            const ids = fs.readdirSync(runsDir)
              .filter(d => fs.statSync(path.join(runsDir, d)).isDirectory());
            const runs = ids.map(id => {
              try {
                const meta = JSON.parse(
                  fs.readFileSync(path.join(runsDir, id, 'meta.json'), 'utf-8')
                );
                const gddPath = path.join(runsDir, id, 'gdd.md');
                const gddText = fs.existsSync(gddPath)
                  ? fs.readFileSync(gddPath, 'utf-8') : '';
                return { ...meta, gddText };
              } catch { return null; }
            }).filter(Boolean).sort((a: Record<string, string>, b: Record<string, string>) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(runs));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        if (urlPath === '/api/studio-memory') {
          try {
            if (!fs.existsSync(memDir)) { res.setHeader('Content-Type', 'application/json'); res.end('{}'); return; }
            const templates = JSON.parse(
              fs.readFileSync(path.join(memDir, 'templates.json'), 'utf-8')
            );
            const ruleCandidates = JSON.parse(
              fs.readFileSync(path.join(memDir, 'rule-candidates.json'), 'utf-8')
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ templates, ruleCandidates }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        const staticMatch = urlPath.match(/^\/api\/runs-static\/([^/]+)\/(.+)$/);
        if (staticMatch) {
          const [, id, filePath] = staticMatch;
          const fullPath = path.join(runsDir, id, ...filePath.split('/'));
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            const mime: Record<string, string> = {
              '.html': 'text/html; charset=utf-8',
              '.json': 'application/json',
              '.png':  'image/png',
              '.md':   'text/plain; charset=utf-8',
            };
            res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
            res.end(fs.readFileSync(fullPath));
          } else {
            res.statusCode = 404;
            res.end('Not found');
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), runsApiPlugin()],
  server: {
    port: 5173,
    open: true,
    middlewareMode: false,
    proxy: {
      '/api/google': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/google/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
