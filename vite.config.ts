import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

function requestPath(req: IncomingMessage): string {
  return decodeURIComponent((req.url ?? '').split('?')[0]);
}

/** Accept first-party cookieless beacons in dev and `vite preview`. Do not log the body. */
function previewHelpersPlugin(): Plugin {
  const handleCollect = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (requestPath(req) !== '/collect' || req.method !== 'POST') {
      next();
      return;
    }
    req.resume();
    res.statusCode = 204;
    res.end();
  };

  return {
    name: 'preview-helpers',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handleCollect);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handleCollect);
    },
  };
}

export default defineConfig({
  plugins: [react(), previewHelpersPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
