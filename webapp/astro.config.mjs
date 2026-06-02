// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://adriens.github.io',
  base: '/helia-etat-reseau-data',
  vite: {
    plugins: [tailwindcss()],
  },
});
