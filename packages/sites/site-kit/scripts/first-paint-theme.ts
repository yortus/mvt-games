/**
 * The theme, from the page's first frame. The page's script marks `<html>`
 * with the theme it wears (`data-theme`), but only once it has loaded, after
 * the stylesheets. Until then, the page would show in no theme at all, and a
 * light theme would flash dark first. So each site's page has a few lines in
 * its `<head>`, which run before anything else: a script that reads the
 * visitor's choice and marks `<html>`, and each theme's background, which
 * shows until the stylesheets arrive.
 *
 * The same script reads whether the visitor browses the showcase, and if
 * so marks `<html>` `is-showcase-starting`, which hides the card wall until
 * the showcase starts. The Arcade's view takes the mark off.
 */

import process from 'node:process';
import type { ThemeKind } from '@mvtjs/site-kit/arcade';
import { SITE_THEMES, type SiteKind } from '@mvtjs/site-kit/site-config';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The `<head>` lines that mark the page with its theme, for `site`, whose own theme the default wears. */
export function firstPaintThemeHtml(site: SiteKind): string {
    const kinds = Object.keys(FIRST_PAINT) as ThemeKind[];
    const fallback = SITE_THEMES[site];
    // Storage can be blocked, as in a private window, which means the default
    const script = `(function () { var t, s; try { t = localStorage.getItem('${THEME_KEY}'); s = localStorage.getItem('${SHOWCASE_KEY}'); } catch (e) {} `
        + `var html = document.documentElement; html.dataset.theme = ${JSON.stringify(kinds)}.indexOf(t) >= 0 ? t : '${fallback}'; `
        + `if (s === 'on') html.classList.add('is-showcase-starting'); })();`;
    const rules = kinds.map((kind) => {
        const { background, scheme } = FIRST_PAINT[kind];
        return `html[data-theme="${kind}"] { background: ${background}; color-scheme: ${scheme}; }`;
    });
    return `<script>${script}</script>\n        <style>${rules.join(' ')}</style>`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Where the page keeps the visitor's choice of theme: `THEME_KEY` in
 * `start-site-page.ts`, after the build's prefix, as the page's local store
 * adds it (`KEY_PREFIX` in `local-store.ts`).
 */
const THEME_KEY = `${process.env.VITE_STORAGE_PREFIX ?? ''}mvt-arcade:theme`;
/**
 * Where the page keeps whether the visitor browses the showcase:
 * `SHOWCASE_KEY` in `start-site-page.ts`, after the build's prefix, as with
 * `THEME_KEY`.
 */
const SHOWCASE_KEY = `${process.env.VITE_STORAGE_PREFIX ?? ''}mvt-arcade:showcase`;

/** Each theme's page background, as `themes.css` has it (`--theme-bg`), and whether it is dark or light. */
const FIRST_PAINT: Readonly<Record<ThemeKind, { readonly background: string; readonly scheme: 'dark' | 'light' }>> = {
    arcade: { background: '#0d1117', scheme: 'dark' },
    dark: { background: '#121417', scheme: 'dark' },
    light: { background: '#f4f4f5', scheme: 'light' },
};
