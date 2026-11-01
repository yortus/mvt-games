// What the sites use from the kit's scripts: the Vite config each site's
// vite.config.ts exports, and the plugins in it. The other files here are
// scripts that run on their own.
export { defineSiteConfig, type SiteConfigOptions } from './define-site-config.ts';
export { entryFactsPlugin } from './vite-plugin-entry-facts.ts';
export { entryPagesPlugin } from './vite-plugin-entry-pages.ts';
export { spritesheetPlugin } from './vite-plugin-spritesheet.ts';
