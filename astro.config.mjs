import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://clubhelloworld.com',
  output: 'server',
  adapter: vercel(),
  build: {
    inlineStylesheets: 'always'
  }
});
