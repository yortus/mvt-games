import type { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { nord } from '@uiw/codemirror-theme-nord';
import { solarizedLight } from '@uiw/codemirror-theme-solarized';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { vscodeDarkInit, vscodeLightInit } from '@uiw/codemirror-theme-vscode';
import { THEME_KINDS, type ThemeKind } from '../models';
import { PALETTES, type ThemePalette } from '../palettes';

// The palettes are in ../palettes, where a page that shows no editor can
// read them without loading CodeMirror. `writePalette` is passed on from there.
export { writePalette } from '../palettes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A colour theme: the editor's, and the page's around it, which match. */
export interface Theme extends ThemePalette {
    /** The CodeMirror extension that colours the editor. */
    readonly editor: Extension;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Each theme: its palette, and the CodeMirror extension that colours its editor to match. */
export const THEMES: Readonly<Record<ThemeKind, Theme>> = {
    'vscode-dark': {
        ...PALETTES['vscode-dark'],
        // Without its own font, so the editor keeps the page's
        editor: vscodeDarkInit({ settings: { fontFamily: undefined } }),
    },
    'one-dark': {
        ...PALETTES['one-dark'],
        editor: oneDark,
    },
    'github-dark': {
        ...PALETTES['github-dark'],
        editor: githubDark,
    },
    'dracula': {
        ...PALETTES['dracula'],
        editor: dracula,
    },
    'tokyo-night': {
        ...PALETTES['tokyo-night'],
        editor: tokyoNight,
    },
    'nord': {
        ...PALETTES['nord'],
        editor: nord,
    },
    'monokai': {
        ...PALETTES['monokai'],
        editor: monokai,
    },
    'vscode-light': {
        ...PALETTES['vscode-light'],
        editor: vscodeLightInit({ settings: { fontFamily: undefined } }),
    },
    'github-light': {
        ...PALETTES['github-light'],
        editor: githubLight,
    },
    'solarized-light': {
        ...PALETTES['solarized-light'],
        editor: solarizedLight,
    },
};

/** The themes, as a menu offers them: in order, by kind, name and scheme. */
export const THEME_CHOICES: readonly { readonly kind: ThemeKind; readonly name: string; readonly scheme: 'dark' | 'light' }[] = THEME_KINDS.map((kind) => ({
    kind,
    name: THEMES[kind].name,
    scheme: THEMES[kind].scheme,
}));
