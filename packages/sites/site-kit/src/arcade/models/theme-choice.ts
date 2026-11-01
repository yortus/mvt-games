// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A look the page can wear: the colours, the type and the motion of every site's page. */
export type ThemeKind = 'arcade' | 'dark' | 'light';

/**
 * The visitor's choice of theme: one of them, which every site then wears,
 * or `'default'`, where each site wears its own.
 */
export type ThemeChoice = 'default' | ThemeKind;

/** Every theme, in the order the picker lists them. */
export const THEME_KINDS: readonly ThemeKind[] = ['arcade', 'dark', 'light'];

/** Every choice, in the order the picker lists them: the default first. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['default', ...THEME_KINDS];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Reads a choice the page kept, as text. Anything else, such as nothing kept, or a theme since removed, is the default. */
export function parseThemeChoice(text: string | undefined): ThemeChoice {
    return THEME_CHOICES.find((choice) => choice === text) ?? 'default';
}
