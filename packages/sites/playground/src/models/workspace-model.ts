import { findExample } from '../examples';
import type { FileEdit, TypeProblem } from '../language';
import { findProjectLocation, MAIN_PATH, type Problem, type ProjectFile, type SourceLocation } from '../runtime';
import type { ConsoleLevel, SandboxMessage } from '../sandbox';
import { createLayoutModel, type LayoutModel, type LayoutModelOptions } from './layout-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Where a run is. `preparing`: Run was pressed, and the page is making the
 * project's modules. `starting`: the sandbox is loading them. `running`: the
 * project has drawn a frame. `failed`: an error stopped it, and the sandbox
 * still shows its last frame. `stopped`: there is no sandbox.
 */
export type RunPhase = 'idle' | 'preparing' | 'starting' | 'running' | 'failed' | 'stopped';

/** The most files a project can have. More would not fit in a share link. */
export const MAX_FILES = 40;

/** Where sharing the project is. A project over the size limit cannot be shared by link. */
export type ShareStatus = 'idle' | 'sharing' | 'copied' | 'too-large' | 'failed';

/** The page's colour themes, the editor's included: the dark ones, then the light ones. */
export const THEME_KINDS = [
    'vscode-dark', 'one-dark', 'github-dark', 'dracula', 'tokyo-night', 'nord', 'monokai',
    'vscode-light', 'github-light', 'solarized-light',
] as const;
export type ThemeKind = (typeof THEME_KINDS)[number];

/** A line in the console: what the project logged, or an error, with where it happened if that is known. */
export interface ConsoleEntry {
    readonly level: ConsoleLevel;
    readonly text: string;
    readonly location?: SourceLocation;
}

/**
 * A problem as the Problems list shows it: one that stops the project
 * running, such as a syntax error or a missing file, or a type error or
 * warning, which never does.
 */
export interface ListedProblem {
    readonly path: string;
    /** Lines and columns count from 1. */
    readonly line?: number;
    readonly column?: number;
    readonly message: string;
    readonly severity: 'error' | 'warning';
    /** Whether it stops the project running. */
    readonly isBlocking: boolean;
}

/** A library's declaration file, open read-only, as go to definition opens it. */
export interface LibraryFile {
    /** Its path among the language service's files, such as `/node_modules/pixi.js/lib/index.d.ts`. */
    readonly path: string;
    readonly text: string;
}

/** The playground's workspace: the project and its files, the file open, the run, and the console. */
export interface WorkspaceModel {
    readonly projectName: string;
    /** The example open, as it was written. An edit makes the project the visitor's own, and this undefined. */
    readonly exampleId: string | undefined;
    /** The project's file paths, `main.ts` first, then in order. */
    readonly paths: readonly string[];
    /** The project's files, in the order of `paths`. */
    readonly files: readonly ProjectFile[];
    readonly textOf: (path: string) => string;
    /** The file open in the editor. */
    readonly activePath: string;
    /** Rises each time a different project opens, so the editor starts afresh. */
    readonly projectsOpened: number;
    /** Rises each time a file is changed, added or removed. */
    readonly edits: number;

    readonly phase: RunPhase;
    readonly isPaused: boolean;
    /** How fast time runs in the project: 1 is real time. */
    readonly speed: number;
    /** Rises each time Run is pressed, for the page to prepare the project. */
    readonly runsRequested: number;
    /** The document the sandbox runs, once the page has prepared it. */
    readonly sandboxDocument: string | undefined;
    /** Rises each time a new sandbox document is ready, for the preview to start it. */
    readonly sandboxesStarted: number;
    /**
     * Whether the visitor started the run in the sandbox, with Run, rather
     * than a change. Such a run takes the keyboard's focus, so a game gets
     * its keys. A run on change leaves the focus in the editor.
     */
    readonly isRunByVisitor: boolean;
    /** Rises each time Step is pressed. */
    readonly steps: number;

    readonly consoleEntries: readonly ConsoleEntry[];
    /** The place in a file last asked for, as from a console entry. */
    readonly shownPlace: SourceLocation | undefined;
    /** Rises each time a place is asked for, for the editor to scroll to it. */
    readonly placesShown: number;

    /** What stops the project running, as the last check or run found it. */
    readonly problems: readonly Problem[];
    /** Rises once the files have stood unchanged for half a second, for the page to check the project. */
    readonly checksRequested: number;
    /**
     * Whether a check that finds no problems runs the project again. It
     * restarts a run that is going, or that an error stopped, but not one the
     * visitor stopped.
     */
    readonly isRunOnChange: boolean;
    /** Type errors and warnings, as the language service last found them. They never stop a run. */
    readonly typeProblems: readonly TypeProblem[];
    /** Rises each time the type problems change, for the editor to mark them. */
    readonly typeChecks: number;
    /** Every problem, as the Problems list shows them: those that stop the run first, then the type problems. */
    readonly problemList: readonly ListedProblem[];
    /** How many errors a file has, of either kind. */
    readonly problemCountOf: (path: string) => number;
    /** Rises each time files change other than by typing in the editor, as a rename or a fix changes them. */
    readonly externalEdits: number;
    /** The library declaration file open, if one has been opened. */
    readonly libraryFile: LibraryFile | undefined;

    readonly shareStatus: ShareStatus;
    /** Rises each time Share is pressed, for the page to write the link. */
    readonly sharesRequested: number;
    /** Rises each time the visitor asks to save, as with Ctrl+S, for the page to save the project then. */
    readonly savesRequested: number;
    /** The colour theme of the page and its editor. */
    readonly theme: ThemeKind;

    /** How the workspace is laid out. */
    readonly layout: LayoutModel;

    /** Opens a project in place of the one open. */
    readonly openProject: (project: { readonly name: string; readonly files: readonly ProjectFile[] }) => void;
    /** Opens an example, by its id. Returns whether there is one. */
    readonly openExample: (id: string) => boolean;
    readonly openFile: (path: string) => void;
    readonly editFile: (path: string, text: string) => void;
    /** Adds an empty file, and opens it. Returns why it cannot, if it cannot. */
    readonly addFile: (path: string) => string | undefined;
    /** Removes a file. `main.ts` cannot be removed. */
    readonly removeFile: (path: string) => void;
    /** Makes edits to any of the project's files, as a rename or a fix does. Edits to files the project does not have are left out. */
    readonly applyEdits: (edits: readonly FileEdit[]) => void;
    /** Opens a library's declaration file, read-only, at a place. */
    readonly openLibraryFile: (file: LibraryFile & { readonly line: number; readonly column: number }) => void;

    readonly run: () => void;
    readonly stop: () => void;
    readonly pause: () => void;
    readonly resume: () => void;
    /** Advances a paused run by one frame. */
    readonly step: () => void;
    readonly setSpeed: (speed: number) => void;
    readonly setRunOnChange: (isOn: boolean) => void;
    readonly clearConsole: () => void;
    /** Opens a file at a place, as a console entry's link does. */
    readonly showPlace: (location: SourceLocation) => void;
    readonly share: () => void;
    /** Asks for the project to be saved now. It is saved as it changes, too. */
    readonly save: () => void;
    readonly setTheme: (theme: ThemeKind) => void;

    /** From the page: the project is ready to run in this sandbox document. */
    readonly reportPrepared: (sandboxDocument: string) => void;
    /** From the page: the project cannot run, for these reasons. */
    readonly reportProblems: (problems: readonly Problem[]) => void;
    /**
     * From the page: what a check found. Its document is the sandbox's, made
     * from the files as they were checked, where they have no problems. A
     * check the files have changed since is ignored.
     */
    readonly reportChecked: (check: CheckResult) => void;
    /** From the page: the type problems the language service found. A report the files have changed since is ignored. */
    readonly reportTypeProblems: (report: { readonly checkNumber: number; readonly problems: readonly TypeProblem[] }) => void;
    /** From the preview: a message from the sandbox. */
    readonly reportSandboxMessage: (message: SandboxMessage) => void;
    /** From the page: how sharing went. */
    readonly reportShared: (status: ShareStatus) => void;

    readonly update: (deltaMs: number) => void;
}

/** What the page found as it checked the project. */
export interface CheckResult {
    /** The check's number: the value of `checksRequested` that asked for it. */
    readonly checkNumber: number;
    readonly problems: readonly Problem[];
    /** The sandbox's document, where the project has no problems. */
    readonly sandboxDocument: string | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WorkspaceModelOptions {
    /** The project open at first. */
    readonly project: { readonly name: string; readonly files: readonly ProjectFile[] };
    /** The pane sizes and fold kept from a visit before, if any. */
    readonly savedLayout?: LayoutModelOptions['saved'];
    /** Whether a change runs the project again, as kept from a visit before. The default is true. */
    readonly isRunOnChange?: boolean;
    /** The colour theme, as kept from a visit before. The default is the first. */
    readonly theme?: ThemeKind;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a workspace with a project open, and nothing run yet. */
export function createWorkspaceModel(options: WorkspaceModelOptions): WorkspaceModel {
    const texts = new Map<string, string>();
    let projectName = '';
    let exampleId: string | undefined;
    let paths: string[] = [];
    let files: ProjectFile[] = [];
    let activePath = MAIN_PATH;
    let projectsOpened = 0;
    let edits = 0;

    let phase: RunPhase = 'idle';
    let isPaused = false;
    let speed = 1;
    let runsRequested = 0;
    let sandboxDocument: string | undefined;
    let sandboxesStarted = 0;
    let isRunByVisitor = false;
    let steps = 0;
    /** How long since the sandbox last said anything, while it runs. */
    let silentMs = 0;

    let consoleEntries: ConsoleEntry[] = [];
    let shownPlace: SourceLocation | undefined;
    let placesShown = 0;
    let shareStatus: ShareStatus = 'idle';
    let sharesRequested = 0;
    let savesRequested = 0;
    let theme: ThemeKind = options.theme ?? THEME_KINDS[0];

    let problems: readonly Problem[] = [];
    let checksRequested = 0;
    let isRunOnChange = options.isRunOnChange ?? true;
    /** Whether the files have changed since the last check was asked for. */
    let isCheckDue = false;
    let msSinceEdit = 0;
    let typeProblems: readonly TypeProblem[] = [];
    let typeChecks = 0;
    let problemList: readonly ListedProblem[] = [];
    let problemCounts = new Map<string, number>();
    let externalEdits = 0;
    let libraryFile: LibraryFile | undefined;
    const layout = createLayoutModel({ saved: options.savedLayout });

    openProject(options.project);

    const model: WorkspaceModel = {
        get projectName() { return projectName; },
        get exampleId() { return exampleId; },
        get paths() { return paths; },
        get files() { return files; },
        textOf: (path) => texts.get(path) ?? (path === libraryFile?.path ? libraryFile.text : ''),
        get activePath() { return activePath; },
        get projectsOpened() { return projectsOpened; },
        get edits() { return edits; },
        get phase() { return phase; },
        get isPaused() { return isPaused; },
        get speed() { return speed; },
        get runsRequested() { return runsRequested; },
        get sandboxDocument() { return sandboxDocument; },
        get sandboxesStarted() { return sandboxesStarted; },
        get isRunByVisitor() { return isRunByVisitor; },
        get steps() { return steps; },
        get consoleEntries() { return consoleEntries; },
        get shownPlace() { return shownPlace; },
        get placesShown() { return placesShown; },
        get shareStatus() { return shareStatus; },
        get sharesRequested() { return sharesRequested; },
        get savesRequested() { return savesRequested; },
        get theme() { return theme; },
        get problems() { return problems; },
        get checksRequested() { return checksRequested; },
        get isRunOnChange() { return isRunOnChange; },
        get typeProblems() { return typeProblems; },
        get typeChecks() { return typeChecks; },
        get problemList() { return problemList; },
        problemCountOf: (path) => problemCounts.get(path) ?? 0,
        get externalEdits() { return externalEdits; },
        get libraryFile() { return libraryFile; },
        layout,

        openProject,

        openExample(id) {
            const example = findExample(id);
            if (example === undefined) return false;
            openProject({ name: example.name, files: example.files });
            exampleId = id;
            return true;
        },

        openFile(path) {
            if (!texts.has(path)) return;
            activePath = path;
            layout.showPanel('code');
        },

        editFile(path, text) {
            if (!texts.has(path) || texts.get(path) === text) return;
            texts.set(path, text);
            onFilesChanged();
        },

        addFile(path) {
            const problem = checkNewPath(path);
            if (problem !== undefined) return problem;
            texts.set(path, '');
            onFilesChanged();
            activePath = path;
            return undefined;
        },

        removeFile(path) {
            if (path === MAIN_PATH || !texts.delete(path)) return;
            onFilesChanged();
            if (activePath === path) activePath = MAIN_PATH;
        },

        applyEdits(fileEdits) {
            let isChanged = false;
            for (const path of new Set(fileEdits.map((e) => e.path))) {
                const text = texts.get(path);
                if (text === undefined) continue;
                // From the end, so each edit's offsets still hold as the ones after it are made
                const ordered = fileEdits.filter((e) => e.path === path).sort((a, b) => b.start - a.start);
                let edited = text;
                for (const edit of ordered) edited = edited.slice(0, edit.start) + edit.newText + edited.slice(edit.end);
                if (edited === text) continue;
                texts.set(path, edited);
                isChanged = true;
            }
            if (!isChanged) return;
            onFilesChanged();
            externalEdits++;
        },

        openLibraryFile(file) {
            libraryFile = { path: file.path, text: file.text };
            activePath = file.path;
            shownPlace = { path: file.path, line: file.line, column: file.column };
            placesShown++;
            layout.showPanel('code');
        },

        run() {
            runsRequested++;
            phase = 'preparing';
            isPaused = false;
            sandboxDocument = undefined;
            consoleEntries = [];
            layout.showPanel('run');
            // The run checks the files as it prepares them, so a check due for them is not needed
            isCheckDue = false;
        },

        stop() {
            if (phase === 'idle' || phase === 'stopped') return;
            phase = 'stopped';
            sandboxDocument = undefined;
        },

        pause() {
            if (isRunLive()) isPaused = true;
        },

        resume() {
            isPaused = false;
        },

        step() {
            if (isRunLive() && isPaused) steps++;
        },

        setSpeed(value) {
            if (value > 0) speed = value;
        },

        setRunOnChange(isOn) {
            isRunOnChange = isOn;
        },

        clearConsole() {
            consoleEntries = [];
        },

        showPlace(location) {
            if (!texts.has(location.path)) return;
            activePath = location.path;
            shownPlace = location;
            placesShown++;
            layout.showPanel('code');
        },

        save() {
            savesRequested++;
        },

        setTheme(kind) {
            theme = kind;
        },

        share() {
            sharesRequested++;
            shareStatus = 'sharing';
        },

        reportPrepared(document) {
            if (phase !== 'preparing') return;
            problems = [];
            listProblems();
            startSandbox(document, true);
        },

        reportProblems(found) {
            if (phase !== 'preparing') return;
            problems = found;
            listProblems();
            for (const problem of found) {
                // A problem with a place shows it as a link, so its text need not name it
                const location = problem.line === undefined ? undefined : { path: problem.path, line: problem.line };
                log({ level: 'error', text: location === undefined ? `${problem.path}: ${problem.message}` : problem.message, location });
            }
            phase = 'failed';
        },

        reportChecked(check) {
            if (check.checkNumber !== checksRequested) return;
            problems = check.problems;
            listProblems();
            const isRestartable = phase === 'starting' || phase === 'running' || phase === 'failed';
            if (isRunOnChange && isRestartable && problems.length === 0 && check.sandboxDocument !== undefined) {
                consoleEntries = [];
                startSandbox(check.sandboxDocument, false);
            }
        },

        reportTypeProblems(report) {
            if (report.checkNumber !== checksRequested) return;
            typeProblems = report.problems;
            typeChecks++;
            listProblems();
        },

        reportSandboxMessage(message) {
            if (!isRunLive()) return;
            silentMs = 0;
            switch (message.kind) {
                case 'started':
                case 'heartbeat':
                    break;
                case 'first-frame':
                    phase = 'running';
                    break;
                case 'console':
                    log({ level: message.level, text: message.text });
                    break;
                case 'error': {
                    const location = findProjectLocation(message.message, message.stack, new Set(paths));
                    log({ level: 'error', text: `${ERROR_PREFIXES[message.phase]}${message.message}`, location });
                    // An error outside a frame, such as a rejected promise, leaves the loop running
                    if (message.phase !== 'outside') phase = 'failed';
                    break;
                }
            }
        },

        reportShared(status) {
            shareStatus = status;
        },

        update(deltaMs) {
            if (isCheckDue) {
                msSinceEdit += deltaMs;
                if (msSinceEdit >= CHECK_DELAY_MS) {
                    isCheckDue = false;
                    checksRequested++;
                }
            }
            if (!isRunLive()) return;
            silentMs += deltaMs;
            if (silentMs > SILENCE_LIMIT_MS) {
                log({ level: 'error', text: 'The project stopped responding, so it was stopped. A loop that never ends can do this.' });
                phase = 'stopped';
                sandboxDocument = undefined;
            }
        },
    };

    return model;

    function openProject(project: { readonly name: string; readonly files: readonly ProjectFile[] }): void {
        projectName = project.name;
        texts.clear();
        for (const file of project.files) texts.set(file.path, file.text);
        onFilesChanged();
        exampleId = undefined;
        activePath = texts.has(MAIN_PATH) ? MAIN_PATH : (paths[0] ?? MAIN_PATH);
        projectsOpened++;
        shownPlace = undefined;
        libraryFile = undefined;
        problems = [];
        typeProblems = [];
        typeChecks++;
        listProblems();
    }

    /**
     * Lists every problem: those that stop the run, then the type problems,
     * leaving out a type problem on a line that one of the first kind names
     * already, such as the same syntax error found twice. Counts each file's
     * errors.
     */
    function listProblems(): void {
        const listed: ListedProblem[] = [];
        const blockedLines = new Set<string>();
        for (const p of problems) {
            listed.push({ path: p.path, line: p.line, message: p.message, severity: 'error', isBlocking: true });
            blockedLines.add(`${p.path}:${p.line}`);
        }
        for (const p of typeProblems) {
            if (blockedLines.has(`${p.path}:${p.line}`)) continue;
            listed.push({ path: p.path, line: p.line, column: p.column, message: p.message, severity: p.severity, isBlocking: false });
        }
        problemList = listed;
        problemCounts = new Map();
        for (const p of listed) {
            if (p.severity === 'error') problemCounts.set(p.path, (problemCounts.get(p.path) ?? 0) + 1);
        }
    }

    function onFilesChanged(): void {
        paths = [...texts.keys()].sort(comparePaths);
        files = paths.map((path) => ({ path, text: texts.get(path) ?? '' }));
        edits++;
        exampleId = undefined;
        isCheckDue = true;
        msSinceEdit = 0;
    }

    function startSandbox(document: string, isByVisitor: boolean): void {
        sandboxDocument = document;
        isRunByVisitor = isByVisitor;
        sandboxesStarted++;
        phase = 'starting';
        isPaused = false;
        silentMs = 0;
    }

    function isRunLive(): boolean {
        return phase === 'starting' || phase === 'running';
    }

    function log(entry: ConsoleEntry): void {
        consoleEntries = consoleEntries.length < MAX_CONSOLE_ENTRIES
            ? [...consoleEntries, entry]
            : [...consoleEntries.slice(1), entry];
    }

    function checkNewPath(path: string): string | undefined {
        if (!FILE_PATH.test(path)) return 'A file\'s path is made of names joined by /, and ends in .ts, .tsx or .css, such as models/ship-model.ts.';
        if (texts.has(path)) return `There is already a file at ${path}.`;
        if (texts.size >= MAX_FILES) return `A project can have at most ${MAX_FILES} files.`;
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the files must stand unchanged before they are checked. */
const CHECK_DELAY_MS = 500;

/** How long the sandbox may say nothing, while a run is live, before it is taken to have frozen. Its heartbeat comes twice a second. */
const SILENCE_LIMIT_MS = 4000;

/** The most lines the console keeps. The oldest go first. */
const MAX_CONSOLE_ENTRIES = 500;

/**
 * A file's path: names of letters, digits, dots and dashes, joined by
 * slashes, ending in .ts, .tsx or .css. No name starts with a dot, so none is
 * `.` or `..`.
 */
const FILE_PATH = /^[\w-][\w.-]*(\/[\w-][\w.-]*)*\.(ts|tsx|css)$/;

const ERROR_PREFIXES: Readonly<Record<'load' | 'start' | 'frame' | 'outside', string>> = {
    load: 'Loading the project failed: ',
    start: 'Starting the project failed: ',
    frame: '',
    outside: '',
};

/** `main.ts` first, then the others in order. */
function comparePaths(a: string, b: string): number {
    if (a === MAIN_PATH) return -1;
    if (b === MAIN_PATH) return 1;
    return a.localeCompare(b);
}
