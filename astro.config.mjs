import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://opentgl.github.io',
  base: '/',
  outDir: 'dist',
  publicDir: 'public',
  build: {
    format: 'directory',
  },
  server: {
    port: 3000,
  },
});
