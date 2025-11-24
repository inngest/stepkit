import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { nitro } from 'nitro/vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    mdx(await import('./source.config')),
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      spa: {
        enabled: true,
        // Tanstack Router will automatically crawl your pages
        prerender: {
          enabled: true,
        },
        // if you have any hidden paths that's not visible on UI, you can add them explicitly.
        // pages: [
        //   {
        //     // path: '/docs/test',
        //   },
        // ],
      },
    }),
    react(),
  ],
});
