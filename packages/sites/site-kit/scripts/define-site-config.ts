/**
 * The Vite config each site's `vite.config.ts` exports: the arcade's, the
 * demos' and the puzzles'. They differ only in the site, so they share this.
 *
 * Each site is built into its own folder of the repo's `dist/`, which is its
 * Vite base under the sites' root: `<root>demos/`. Its page, `index.html`,
 * sits in its package, beside `src/`, which it loads as `/src/...`. The build
 * also writes a page for each entry (see `vite-plugin-entry-pages.ts`), with
 * the nav written in (see `site-nav.ts`).
 */

import { resolve } from 'node:path';
import process from 'node:process';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defaultClientConditions, defaultServerConditions, defineConfig, type Plugin, type UserConfigFnObject } from 'vite';
import type { SiteKind } from '@mvtjs/site-kit/arcade';
import { firstPaintThemeHtml } from './first-paint-theme.ts';
import { siteNavHtml } from './site-nav.ts';
import { entryFactsPlugin } from './vite-plugin-entry-facts.ts';
import { entryPagesPlugin } from './vite-plugin-entry-pages.ts';
import { spritesheetPlugin } from './vite-plugin-spritesheet.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SiteConfigOptions {
    /** The site: its folder in the sites' root. */
    readonly site: SiteKind;
    /** The site's package: the folder its `vite.config.ts` is in. */
    readonly root: string;
    /** Entries that once lived in this site and moved to another, by id, with the site each moved to. Their old addresses send visitors on. */
    readonly movedEntries?: Readonly<Record<string, SiteKind>>;
    /** Whether the site is the root's: its build writes the root's `index.html` and `404.html`, which send visitors on to it. */
    readonly isSiteRoot?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function defineSiteConfig(options: SiteConfigOptions): UserConfigFnObject {
    const { site, root, movedEntries, isSiteRoot } = options;
    const siteRoot = process.env.BASE_URL ?? '/';
    return defineConfig(({ mode }) => ({
        appType: 'mpa',
        root,
        base: `${siteRoot}${site}/`,
        publicDir: false,
        plugins: [
            spritesheetPlugin(),
            entryFactsPlugin(),
            entryPagesPlugin({ site, siteRoot, movedEntries, isSiteRoot }),
            sitePagePlugin(site, siteRoot),
            // `npm run dev:https` serves the site over HTTPS with a self-signed
            // certificate, so a phone on the network can play sound. Sound needs a
            // secure page, because only a secure page has `AudioWorklet`. Over
            // plain HTTP, only `localhost` is secure.
            mode === HTTPS_MODE ? basicSsl() : undefined,
        ],
        resolve: {
            conditions: [SOURCE_CONDITION, ...defaultClientConditions],
        },
        // Vitest lists the visual tests in Node, as `vitest list` and editors'
        // test explorers do, which resolves as a server does.
        ssr: {
            resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] },
        },
        // Run alone, with `npm run dev -w @mvtjs/<site>`. `npm run dev`, from the
        // repo's root, serves every site together on one server instead
        server: {
            port: DEV_PORTS[site],
            open: `${siteRoot}${site}/`,
        },
        build: {
            outDir: resolve(root, '../../../dist', site),
            emptyOutDir: true,
            rollupOptions: {
                // The snapshot page, for the thumbnails, is left out
                input: { main: resolve(root, 'index.html') },
            },
        },
    }));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The `exports` condition under which each @mvtjs package resolves to its source, so the site needs no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

/** The mode (`--mode https`) in which the dev server serves over HTTPS. */
const HTTPS_MODE = 'https';

/** Each site's port, when its dev server runs alone. */
const DEV_PORTS: Readonly<Record<SiteKind, number>> = { arcade: 5173, demos: 5180, puzzles: 5185 };

/**
 * Writes into the site's page what every site's page has: the theme, from
 * the first frame, where the page marks it with `<!-- site-theme -->`, and
 * the nav, with the site's own link active, at `<!-- site-nav -->`.
 */
function sitePagePlugin(site: SiteKind, siteRoot: string): Plugin {
    return {
        name: 'site-page',
        transformIndexHtml(html) {
            return html
                .replace(THEME_MARK, () => firstPaintThemeHtml(site))
                .replace(NAV_MARK, () => siteNavHtml(site, siteRoot));
        },
    };
}

const THEME_MARK = '<!-- site-theme -->';
const NAV_MARK = '<!-- site-nav -->';
