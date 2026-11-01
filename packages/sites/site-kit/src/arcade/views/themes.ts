import type { ThemeKind } from '../models';
import type { CardPhotoKind } from './card-photo';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A theme, as the views see it. Its colours, type, radii and shadows are CSS
 * custom properties, in `themes.css`, which the page switches by marking
 * `<html>` with `data-theme`. This holds what the views need besides: its
 * name, and whether it is light or dark.
 */
export interface Theme {
    readonly kind: ThemeKind;
    /** Its name, as the picker lists it. */
    readonly name: string;
    /** Whether it is dark or light, which the browser's own controls, such as scroll bars, follow. */
    readonly scheme: 'dark' | 'light';
    /** Three colours that sum it up, for its swatch in the picker: its page, its panels, and its accent. */
    readonly swatch: readonly [page: string, panel: string, accent: string];
    /**
     * Whether the way into an entry, and out, is the quiet one: the wall
     * fades rather than burns, and the screen fades up rather than powering
     * on like a tube. It is the way a visitor who asks for less motion gets,
     * whatever the theme.
     */
    readonly isQuiet: boolean;
    /** How the cards show their photos: in a tilted polaroid, or in a square across each card's foot. */
    readonly cardPhoto: CardPhotoKind;
}

/** Every theme, by kind. */
export const THEMES: Readonly<Record<ThemeKind, Theme>> = {
    arcade: {
        kind: 'arcade',
        name: 'Arcade',
        scheme: 'dark',
        swatch: ['#0a0f2e', '#161b22', '#ffd83d'],
        isQuiet: false,
        cardPhoto: 'polaroid',
    },
    dark: {
        kind: 'dark',
        name: 'Dark',
        scheme: 'dark',
        swatch: ['#121417', '#1c1f24', '#8b8cff'],
        isQuiet: true,
        cardPhoto: 'full-width',
    },
    light: {
        kind: 'light',
        name: 'Light',
        scheme: 'light',
        swatch: ['#f4f4f5', '#fffdf8', '#c8322b'],
        isQuiet: true,
        cardPhoto: 'full-width',
    },
};
