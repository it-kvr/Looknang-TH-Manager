import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveBase(command: 'build' | 'serve'): string {
  const raw = (process.env.VITE_BASE_PATH || '').trim();
  if (raw === '.' || raw === './') {
    return command === 'build' ? './' : '/';
  }
  if (raw) {
    const stripped = raw.replace(/^\/+|\/+$/g, '');
    return stripped ? `/${stripped}/` : '/';
  }
  if (command === 'build' && process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    if (repo && !repo.endsWith('.github.io')) {
      return `/${repo}/`;
    }
    return '/';
  }
  // Use relative base in production builds so deploys work both at domain root and on subpath hosts (e.g. GitHub Pages)
  return command === 'build' ? './' : '/';
}

export default defineConfig(({command}) => {
  const base = resolveBase(command);
  const pwaIconSrc = base === './' ? 'icon.svg' : `${base}icon.svg`;
  const pwaIcon192 = base === './' ? 'pwa-192x192.png' : `${base}pwa-192x192.png`;
  const pwaIcon512 = base === './' ? 'pwa-512x512.png' : `${base}pwa-512x512.png`;
  const pwaIconMask = base === './' ? 'pwa-maskable-512x512.png' : `${base}pwa-maskable-512x512.png`;
  const navigateFallback = base === './' ? 'index.html' : `${base}index.html`;

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: base,
          name: 'ลูกหนังไทย — เกมคุมทีมและนักเตะอาชีพ',
          short_name: 'ลูกหนังไทย',
          description:
            'เกมจำลองการคุมทีมฟุตบอลไทยและโหมดนักเตะอาชีพ ไต่ลีก บอลถ้วย และทีมชาติ เล่นแบบติดตั้งลงมือถือและออฟไลน์ได้',
          theme_color: '#0c1c14',
          background_color: '#06100b',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'landscape',
          start_url: base,
          scope: base,
          icons: [
            {
              src: pwaIcon192,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: pwaIcon512,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: pwaIconMask,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: pwaIconSrc,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}'],
          globIgnores: ['**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          navigateFallback,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
