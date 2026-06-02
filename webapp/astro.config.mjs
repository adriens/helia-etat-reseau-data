// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://adriens.github.io',
  base: '/helia-etat-reseau-data',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
