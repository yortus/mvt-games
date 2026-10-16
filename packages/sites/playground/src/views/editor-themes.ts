import type { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubDark } from '@uiw/codemirror-theme-github';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { nord } from '@uiw/codemirror-theme-nord';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { vscodeDarkInit } from '@uiw/codemirror-theme-vscode';
import type { EditorThemeKind } from '../models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Each of the editor's themes: its name, and the CodeMirror extension that colours the editor with it. */
export const EDITOR_THEMES: Readonly<Record<EditorThemeKind, { readonly name: string; readonly extension: Extension }>> = {
    'one-dark': { name: 'One Dark', extension: oneDark },
    // Without its own font, so the editor keeps the page's
    'vscode-dark': { name: 'VS Code Dark', extension: vscodeDarkInit({ settings: { fontFamily: undefined } }) },
    'github-dark': { name: 'GitHub Dark', extension: githubDark },
    'dracula': { name: 'Dracula', extension: dracula },
    'tokyo-night': { name: 'Tokyo Night', extension: tokyoNight },
    'nord': { name: 'Nord', extension: nord },
    'monokai': { name: 'Monokai', extension: monokai },
};
