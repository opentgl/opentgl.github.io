import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://anomalyco.github.io',
  base: '/opentgl/',
  outDir: 'dist',
  publicDir: 'public',
  build: {
    format: 'directory',
  },
  server: {
    port: 3000,
  },
});
