import { EDITOR_THEME_KINDS, type EditorThemeKind, type PaneSizes } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How the visitor last left the workspace, kept for their next visit. */
export interface WorkspaceSettings {
    readonly isRunOnChange?: boolean;
    readonly editorTheme?: EditorThemeKind;
    readonly layout?: Partial<PaneSizes> & { readonly isFilesFolded?: boolean };
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The settings kept from the visitor's last visit, or none. Values of the wrong type are left out. */
export function loadSettings(): WorkspaceSettings {
    try {
        const text = localStorage.getItem(SETTINGS_KEY);
        if (text === null) return {};
        const data = JSON.parse(text) as Record<string, unknown>;
        const layout = (typeof data.layout === 'object' && data.layout !== null ? data.layout : {}) as Record<string, unknown>;
        return {
            isRunOnChange: typeof data.isRunOnChange === 'boolean' ? data.isRunOnChange : undefined,
            editorTheme: (EDITOR_THEME_KINDS as readonly unknown[]).includes(data.editorTheme) ? data.editorTheme as EditorThemeKind : undefined,
            layout: {
                filesWidth: numberOrUndefined(layout.filesWidth),
                runWidth: numberOrUndefined(layout.runWidth),
                consoleHeight: numberOrUndefined(layout.consoleHeight),
                isFilesFolded: typeof layout.isFilesFolded === 'boolean' ? layout.isFilesFolded : undefined,
            },
        };
    }
    catch {
        return {};
    }
}

/** Keeps the settings for the visitor's next visit. Does nothing where the browser keeps nothing. */
export function saveSettings(settings: WorkspaceSettings): void {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    catch {
        // Storage is off or full. The settings last until the page closes.
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'mvt-playground-settings';

function numberOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
