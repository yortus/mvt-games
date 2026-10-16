// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The panels a narrow screen shows one at a time. */
export type PanelKind = 'files' | 'code' | 'run';

/** What the bottom of the run pane shows. */
export type RunPaneTabKind = 'console' | 'problems';

/** The sizes of the panes the visitor can drag, in CSS pixels. */
export interface PaneSizes {
    readonly filesWidth: number;
    readonly runWidth: number;
    readonly consoleHeight: number;
}

/** The panes' sizes, before the visitor drags them. */
export const DEFAULT_SIZES: PaneSizes = { filesWidth: 230, runWidth: 480, consoleHeight: 200 };

/**
 * How the workspace is laid out: the panes' sizes, whether the file list is
 * folded away, which panel a narrow screen shows, which tab the run pane
 * shows, and the dialog that opens a file by name.
 */
export interface LayoutModel extends PaneSizes {
    readonly isFilesFolded: boolean;
    readonly narrowPanel: PanelKind;
    readonly runPaneTab: RunPaneTabKind;
    readonly isQuickOpenOpen: boolean;
    /** What the visitor has typed in the dialog that opens a file by name. */
    readonly quickOpenQuery: string;
    /** The paths that match the query, best first. */
    readonly quickOpenMatches: readonly string[];

    /** Resizes the file list by a distance, kept within its limits. */
    readonly resizeFiles: (deltaPx: number) => void;
    /** Resizes the run pane by a distance, kept within its limits. It grows as the divider moves left. */
    readonly resizeRun: (deltaPx: number) => void;
    /** Resizes the console by a distance, kept within its limits. It grows as the divider moves up. */
    readonly resizeConsole: (deltaPx: number) => void;
    readonly toggleFiles: () => void;
    readonly showPanel: (panel: PanelKind) => void;
    readonly showRunPaneTab: (tab: RunPaneTabKind) => void;
    /** Opens the dialog that opens a file by name, matching against these paths. */
    readonly openQuickOpen: (paths: readonly string[]) => void;
    readonly closeQuickOpen: () => void;
    readonly setQuickOpenQuery: (query: string) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LayoutModelOptions {
    /** The sizes and fold kept from a visit before, if any. Sizes outside their limits are brought inside. */
    readonly saved?: Partial<PaneSizes> & { readonly isFilesFolded?: boolean };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a layout with the panes at their saved sizes, or their defaults, showing the code. */
export function createLayoutModel(options: LayoutModelOptions = {}): LayoutModel {
    const saved = options.saved ?? {};
    let filesWidth = clamp(saved.filesWidth ?? DEFAULT_SIZES.filesWidth, LIMITS.filesWidth);
    let runWidth = clamp(saved.runWidth ?? DEFAULT_SIZES.runWidth, LIMITS.runWidth);
    let consoleHeight = clamp(saved.consoleHeight ?? DEFAULT_SIZES.consoleHeight, LIMITS.consoleHeight);
    let isFilesFolded = saved.isFilesFolded ?? false;
    let narrowPanel: PanelKind = 'code';
    let runPaneTab: RunPaneTabKind = 'console';
    let isQuickOpenOpen = false;
    let quickOpenQuery = '';
    let quickOpenPaths: readonly string[] = [];
    let quickOpenMatches: readonly string[] = [];

    const model: LayoutModel = {
        get filesWidth() { return filesWidth; },
        get runWidth() { return runWidth; },
        get consoleHeight() { return consoleHeight; },
        get isFilesFolded() { return isFilesFolded; },
        get narrowPanel() { return narrowPanel; },
        get runPaneTab() { return runPaneTab; },
        get isQuickOpenOpen() { return isQuickOpenOpen; },
        get quickOpenQuery() { return quickOpenQuery; },
        get quickOpenMatches() { return quickOpenMatches; },

        resizeFiles(deltaPx) {
            filesWidth = clamp(filesWidth + deltaPx, LIMITS.filesWidth);
        },

        resizeRun(deltaPx) {
            runWidth = clamp(runWidth - deltaPx, LIMITS.runWidth);
        },

        resizeConsole(deltaPx) {
            consoleHeight = clamp(consoleHeight - deltaPx, LIMITS.consoleHeight);
        },

        toggleFiles() {
            isFilesFolded = !isFilesFolded;
        },

        showPanel(panel) {
            narrowPanel = panel;
        },

        showRunPaneTab(tab) {
            runPaneTab = tab;
        },

        openQuickOpen(paths) {
            isQuickOpenOpen = true;
            quickOpenPaths = paths;
            quickOpenQuery = '';
            quickOpenMatches = paths;
        },

        closeQuickOpen() {
            isQuickOpenOpen = false;
        },

        setQuickOpenQuery(query) {
            quickOpenQuery = query;
            quickOpenMatches = matchPaths(quickOpenPaths, query);
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The smallest and largest each pane may be. */
const LIMITS: Readonly<Record<keyof PaneSizes, { readonly min: number; readonly max: number }>> = {
    filesWidth: { min: 140, max: 480 },
    runWidth: { min: 280, max: 1200 },
    consoleHeight: { min: 80, max: 700 },
};

function clamp(value: number, { min, max }: { min: number; max: number }): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * The paths that hold the query's letters in order, as an editor's "open a
 * file" does: `bm` matches `models/ball-model.ts`. Paths whose file name
 * holds the query as it is come first, then the rest, each in path order.
 */
function matchPaths(paths: readonly string[], query: string): readonly string[] {
    const wanted = query.trim().toLowerCase();
    if (wanted === '') return paths;
    const exact: string[] = [];
    const scattered: string[] = [];
    for (const path of paths) {
        const lower = path.toLowerCase();
        const name = lower.slice(lower.lastIndexOf('/') + 1);
        if (name.includes(wanted)) exact.push(path);
        else if (holdsInOrder(lower, wanted)) scattered.push(path);
    }
    return [...exact, ...scattered];
}

function holdsInOrder(text: string, letters: string): boolean {
    let at = 0;
    for (let i = 0; i < letters.length; i++) {
        at = text.indexOf(letters[i], at);
        if (at === -1) return false;
        at++;
    }
    return true;
}
