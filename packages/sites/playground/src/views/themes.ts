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

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A colour theme: the editor's, and the page's around it, which match. */
export interface Theme {
    readonly name: string;
    /** Whether it is dark or light, which the browser's own controls, such as scroll bars, follow. */
    readonly scheme: 'dark' | 'light';
    /** The CodeMirror extension that colours the editor. */
    readonly editor: Extension;
    readonly palette: PagePalette;
}

/** The page's colours. Each is a CSS colour, which the page's CSS reads as a variable, such as `--pg-panel`. */
export interface PagePalette {
    /** The editor's own background, and the preview's around a project. */
    readonly background: string;
    /** The header, the file list, the run's controls, the console and Problems. */
    readonly panel: string;
    /** Buttons, menus, dialogs, and the banner over a library's file. */
    readonly raised: string;
    /** Dividers, and the edges of all of the above. */
    readonly border: string;
    readonly text: string;
    /** Labels, places, and other text that matters less. */
    readonly muted: string;
    /** The active file and tab, links to places, and focus. */
    readonly accent: string;
    /** The active file's row, and the item chosen in a menu. */
    readonly selected: string;
    readonly error: string;
    readonly warning: string;
    /** "Saved", and Run. */
    readonly success: string;
    /** Under menus and dialogs, and behind a dialog. */
    readonly shadow: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Each theme. A palette takes its colours from its theme's own, for the
 * editor's background exactly, and for the panels from the theme's
 * application where it has one, such as VS Code's sidebar. A colour that
 * did not read well enough against the panels was made a little lighter or
 * darker.
 */
export const THEMES: Readonly<Record<ThemeKind, Theme>> = {
    'vscode-dark': {
        name: 'VS Code Dark',
        scheme: 'dark',
        // Without its own font, so the editor keeps the page's
        editor: vscodeDarkInit({ settings: { fontFamily: undefined } }),
        palette: {
            background: '#1e1e1e', panel: '#252526', raised: '#333333', border: '#3c3c3c',
            text: '#cccccc', muted: '#9d9d9d', accent: '#3794ff', selected: '#37373d',
            error: '#f48771', warning: '#cca700', success: '#89d185', shadow: 'rgb(0 0 0 / 0.5)',
        },
    },
    'one-dark': {
        name: 'One Dark',
        scheme: 'dark',
        editor: oneDark,
        palette: {
            background: '#282c34', panel: '#21252b', raised: '#2c313a', border: '#3a3f4b',
            text: '#abb2bf', muted: '#8b919c', accent: '#61afef', selected: '#323842',
            error: '#e06c75', warning: '#e5c07b', success: '#98c379', shadow: 'rgb(0 0 0 / 0.5)',
        },
    },
    'github-dark': {
        name: 'GitHub Dark',
        scheme: 'dark',
        editor: githubDark,
        palette: {
            background: '#0d1117', panel: '#161b22', raised: '#21262d', border: '#30363d',
            text: '#c9d1d9', muted: '#8b949e', accent: '#58a6ff', selected: '#1f2b3a',
            error: '#f85149', warning: '#d29922', success: '#3fb950', shadow: 'rgb(0 0 0 / 0.5)',
        },
    },
    'dracula': {
        name: 'Dracula',
        scheme: 'dark',
        editor: dracula,
        palette: {
            background: '#282a36', panel: '#21222c', raised: '#343746', border: '#44475a',
            text: '#f8f8f2', muted: '#8f9acb', accent: '#bd93f9', selected: '#44475a',
            error: '#ff6e6e', warning: '#ffb86c', success: '#50fa7b', shadow: 'rgb(0 0 0 / 0.5)',
        },
    },
    'tokyo-night': {
        name: 'Tokyo Night',
        scheme: 'dark',
        editor: tokyoNight,
        palette: {
            background: '#1a1b26', panel: '#16161e', raised: '#1f2335', border: '#292e42',
            text: '#a9b1d6', muted: '#7d84ab', accent: '#7aa2f7', selected: '#283457',
            error: '#f7768e', warning: '#e0af68', success: '#9ece6a', shadow: 'rgb(0 0 0 / 0.5)',
        },
    },
    'nord': {
        name: 'Nord',
        scheme: 'dark',
        editor: nord,
        palette: {
            background: '#2e3440', panel: '#3b4252', raised: '#434c5e', border: '#4c566a',
            text: '#eceff4', muted: '#b4bccb', accent: '#88c0d0', selected: '#4c566a',
            error: '#e8909a', warning: '#ebcb8b', success: '#a3be8c', shadow: 'rgb(0 0 0 / 0.4)',
        },
    },
    'monokai': {
        name: 'Monokai',
        scheme: 'dark',
        editor: monokai,
        palette: {
            background: '#272822', panel: '#1e1f1c', raised: '#3e3d32', border: '#414339',
            text: '#f8f8f2', muted: '#a09f98', accent: '#66d9ef', selected: '#49483e',
            error: '#ff6188', warning: '#fd971f', success: '#a6e22e', shadow: 'rgb(0 0 0 / 0.5)',
        },
    },
    'vscode-light': {
        name: 'VS Code Light',
        scheme: 'light',
        editor: vscodeLightInit({ settings: { fontFamily: undefined } }),
        palette: {
            background: '#ffffff', panel: '#f3f3f3', raised: '#ffffff', border: '#d4d4d4',
            text: '#333333', muted: '#616161', accent: '#005fb8', selected: '#e4e6f1',
            error: '#c72e0f', warning: '#8a6400', success: '#2f7d32', shadow: 'rgb(0 0 0 / 0.16)',
        },
    },
    'github-light': {
        name: 'GitHub Light',
        scheme: 'light',
        editor: githubLight,
        palette: {
            background: '#ffffff', panel: '#f6f8fa', raised: '#ffffff', border: '#d0d7de',
            text: '#1f2328', muted: '#656d76', accent: '#0969da', selected: '#ddf4ff',
            error: '#d1242f', warning: '#9a6700', success: '#1a7f37', shadow: 'rgb(0 0 0 / 0.16)',
        },
    },
    'solarized-light': {
        name: 'Solarized Light',
        scheme: 'light',
        editor: solarizedLight,
        palette: {
            background: '#fdf6e3', panel: '#eee8d5', raised: '#fdf6e3', border: '#d3cbb7',
            text: '#4a5d63', muted: '#5f7177', accent: '#1f6fa8', selected: '#e2dbc6',
            error: '#c22a27', warning: '#7d6200', success: '#5f6d00', shadow: 'rgb(0 0 0 / 0.16)',
        },
    },
};

/** The themes, as a menu offers them: in order, by kind, name and scheme. */
export const THEME_CHOICES: readonly { readonly kind: ThemeKind; readonly name: string; readonly scheme: 'dark' | 'light' }[] = THEME_KINDS.map((kind) => ({
    kind,
    name: THEMES[kind].name,
    scheme: THEMES[kind].scheme,
}));

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Writes a theme's palette to an element, as the CSS variables that the page's CSS reads, and its scheme. */
export function writePalette(element: HTMLElement, theme: Theme): void {
    for (const key of PALETTE_KEYS) element.style.setProperty(`--pg-${key}`, theme.palette[key]);
    element.style.colorScheme = theme.scheme;
    // For CSS that picks colours by the scheme. The build lowers `light-dark()` for older
    // browsers in a way that only works where `color-scheme` is set in CSS, not here
    element.dataset.scheme = theme.scheme;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PALETTE_KEYS: readonly (keyof PagePalette)[] = [
    'background', 'panel', 'raised', 'border', 'text', 'muted', 'accent', 'selected', 'error', 'warning', 'success', 'shadow',
];
