import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Privacy promise, enforced by the browser: no connections to third parties.
// Only injected into the production build – the dev server needs inline styles for HMR.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "style-src 'self'",
  "font-src 'self'",
].join('; ');

const cspPlugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
};

// MediaPipe loads its runtime from public/mediapipe via dynamic import(). The dev server appends
// "?import" to such URLs and then refuses public files – serve them raw, like the build does.
const serveMediapipeRaw = {
  name: 'serve-mediapipe-raw',
  apply: 'serve',
  /** @param {import('vite').ViteDevServer} server */
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith('/mediapipe/')) req.url = req.url.replace(/\?import$/, '');
      next();
    });
  },
};

// Shared page parts (header, footer, …) without a framework: <!-- include:site-header -->
// is replaced by src/partials/site-header.html in every page, in dev and build.
const PARTIAL = /<!--\s*include:([\w-]+)\s*-->/g;
/** @param {string} html @returns {string} */
const includePartials = (html) =>
  html.replace(PARTIAL, (_, name) => includePartials(readFileSync(`src/partials/${name}.html`, 'utf8').trim()));

const htmlPartials = {
  name: 'html-partials',
  transformIndexHtml: { order: /** @type {const} */ ('pre'), handler: includePartials },
  /** @param {import('vite').HmrContext} ctx */
  handleHotUpdate({ file, server }) {
    if (file.includes('/src/partials/')) server.ws.send({ type: 'full-reload' });
  },
};

export default defineConfig({
  // HTTPS is required for camera access on phones in the LAN: `npm run dev:phone`
  plugins: [htmlPartials, cspPlugin, serveMediapipeRaw, ...(process.env.HTTPS ? [basicSsl()] : [])],
  // Set BASE_URL=/surfpose/ when deploying to gh-pages (freegroup.github.io/surfpose/).
  base: process.env.BASE_URL ?? '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        training: 'training.html',
        clips: 'clips.html',
        datenschutz: 'datenschutz.html',
        impressum: 'impressum.html',
        'guter-stand': 'guter-stand.html',
        developer: 'developer.html',
      },
    },
  },
});
