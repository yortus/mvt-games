import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { firstPaintThemeHtml } from './first-paint-theme.ts';

/** Each theme's CSS, beside the page's: the Arcade's, the default, is in `themes.css`. */
const FILES = { arcade: 'themes.css', dark: 'theme-dark.css', light: 'theme-light.css' } as const;

describe('firstPaintThemeHtml', () => {
    const html = firstPaintThemeHtml('puzzles');

    it.each(Object.entries(FILES))('paints the %s theme\'s page background, as its CSS has it', (theme, file) => {
        const css = readFileSync(join(import.meta.dirname, '..', 'src', 'arcade', file), 'utf8');
        const background = new RegExp(`:root\\[data-theme="${theme}"\\] \\{[^}]*--theme-bg: (#[0-9a-f]+);`).exec(css)?.[1];
        expect(background).toBeDefined();
        expect(html).toContain(`html[data-theme="${theme}"] { background: ${background};`);
    });

    it('wears the site\'s own theme when the visitor has chosen none', () => {
        expect(html).toContain(': \'light\';');
        expect(firstPaintThemeHtml('demos')).toContain(': \'dark\';');
    });
});
