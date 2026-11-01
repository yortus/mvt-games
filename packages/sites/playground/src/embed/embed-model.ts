import type { ThemeKind } from '../models';
import { createReferenceModel, findImportedNames, type ReferenceModel, USED_ID } from '../reference';
import { findRenderer, MAIN_PATH, type Problem, type ProjectFile } from '../runtime';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An example running in a page of the docs: its files, which the reader may
 * edit, the file shown, whether the editor, the list of files and the cheat
 * sheet are open, and the run's state. An edit runs the example again once
 * the reader has stopped typing for a moment. Nothing is kept: closing the
 * page discards the edits.
 */
export interface EmbedModel {
    readonly exampleId: string;
    readonly name: string;
    readonly files: readonly ProjectFile[];
    /** The file the editor shows. */
    readonly activePath: string;
    /** Whether the editor is open. The embed opens with only the run showing. */
    readonly isEditing: boolean;
    /** Whether the list of files shows, to choose the one the editor shows. */
    readonly isFileMenuOpen: boolean;
    /** Whether the cheat sheet shows, over the run and the editor. */
    readonly isReferenceOpen: boolean;
    /** The cheat sheets, which open on the APIs that the example imports. */
    readonly reference: ReferenceModel;
    /** Whether any file differs from the example's own. */
    readonly isEdited: boolean;
    readonly isPaused: boolean;
    /** How fast time runs in the example: 1 is real time. */
    readonly speed: number;
    /** Rises each time a paused run should advance one frame. */
    readonly steps: number;
    /** Rises each time the example should run again, from its files as they are now. */
    readonly runsRequested: number;
    /** Rises each time a sandbox document is ready, which starts a new sandbox. */
    readonly sandboxesStarted: number;
    /** The document the sandbox runs, or undefined while there's none. */
    readonly sandboxDocument: string | undefined;
    /** What stopped the run, to show the reader, or undefined. */
    readonly problem: string | undefined;
    readonly theme: ThemeKind;
    /** Runs the example again from the start, unpaused. */
    restart: () => void;
    /**
     * Pauses the run and advances it one frame. After an error stopped it,
     * it runs the example again, paused on its first frame.
     */
    step: () => void;
    /**
     * Runs at a speed, where 1 is real time: a paused run carries on, and
     * after an error stopped it, it runs the example again.
     */
    playAt: (speed: number) => void;
    startEditing: () => void;
    /** Opens the list of files, or closes it. */
    toggleFileMenu: () => void;
    closeFileMenu: () => void;
    /** Opens the cheat sheet, or closes it. */
    toggleReference: () => void;
    closeReference: () => void;
    /** Shows a file in the editor, and closes the list of files. */
    showFile: (path: string) => void;
    /** Records a file's new text. The example runs again once the edits stop for a moment. */
    editFile: (options: { readonly path: string; readonly text: string }) => void;
    /** Starts the run that `run` asked for, unless a newer run has been asked for since. */
    reportPrepared: (options: { readonly run: number; readonly sandboxDocument: string }) => void;
    /** Reports the problems that stop the run that `run` asked for, unless a newer one has been asked for since. */
    reportProblems: (options: { readonly run: number; readonly problems: readonly Problem[] }) => void;
    /** Reports an error the running example threw. */
    reportError: (message: string) => void;
    setTheme: (theme: ThemeKind) => void;
    update: (deltaMs: number) => void;
}

/** How long after the last edit the example runs again, as the playground's own check waits. */
export const RUN_AFTER_EDIT_MS = 500;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EmbedModelOptions {
    readonly example: {
        readonly id: string;
        readonly name: string;
        readonly files: readonly ProjectFile[];
    };
    /** The file the editor opens on. Undefined, or a path the example doesn't have, opens `main.ts`. */
    readonly path: string | undefined;
    readonly theme: ThemeKind;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an embed's model. The example runs as soon as the embed opens: `runsRequested` starts at 1. */
export function createEmbedModel(options: EmbedModelOptions): EmbedModel {
    const { example } = options;
    let files: readonly ProjectFile[] = example.files;
    let activePath = options.path !== undefined && example.files.some((f) => f.path === options.path) ? options.path : MAIN_PATH;
    let isEditing = false;
    let isFileMenuOpen = false;
    let isReferenceOpen = false;
    const reference = createReferenceModel({
        renderer: findRenderer(textOf(example.files, MAIN_PATH)),
        usedNames: findImportedNames(example.files.map((f) => f.text)),
        chosenId: USED_ID,
    });
    let isPaused = false;
    let speed = 1;
    let steps = 0;
    let runsRequested = 1;
    let sandboxesStarted = 0;
    let sandboxDocument: string | undefined;
    let problem: string | undefined;
    let theme = options.theme;
    /** The time since the last edit, while an edit is waiting to run, or undefined. */
    let quietMs: number | undefined;

    return {
        exampleId: example.id,
        name: example.name,
        get files() { return files; },
        get activePath() { return activePath; },
        get isEditing() { return isEditing; },
        get isFileMenuOpen() { return isFileMenuOpen; },
        get isReferenceOpen() { return isReferenceOpen; },
        reference,
        get isEdited() { return files !== example.files; },
        get isPaused() { return isPaused; },
        get speed() { return speed; },
        get steps() { return steps; },
        get runsRequested() { return runsRequested; },
        get sandboxesStarted() { return sandboxesStarted; },
        get sandboxDocument() { return sandboxDocument; },
        get problem() { return problem; },
        get theme() { return theme; },
        restart() {
            isPaused = false;
            requestRun();
        },
        step() {
            isPaused = true;
            if (problem !== undefined) requestRun();
            else if (sandboxDocument !== undefined) steps++;
        },
        playAt(value) {
            if (value > 0) speed = value;
            isPaused = false;
            if (problem !== undefined) requestRun();
        },
        startEditing() {
            isEditing = true;
        },
        toggleFileMenu() {
            isFileMenuOpen = !isFileMenuOpen;
        },
        closeFileMenu() {
            isFileMenuOpen = false;
        },
        toggleReference() {
            isReferenceOpen = !isReferenceOpen;
        },
        closeReference() {
            isReferenceOpen = false;
        },
        showFile(path) {
            isFileMenuOpen = false;
            if (files.some((f) => f.path === path)) activePath = path;
        },
        editFile({ path, text }) {
            const index = files.findIndex((f) => f.path === path);
            if (index < 0 || files[index].text === text) return;
            files = files.map((f, i) => (i === index ? { path, text } : f));
            quietMs = 0;
            reference.renderer = findRenderer(textOf(files, MAIN_PATH));
            reference.usedNames = findImportedNames(files.map((f) => f.text));
        },
        reportPrepared({ run, sandboxDocument: document }) {
            if (run !== runsRequested) return;
            sandboxDocument = document;
            sandboxesStarted++;
            // A run after an edit keeps the pause, so the reader can edit and step
            problem = undefined;
        },
        reportProblems({ run, problems }) {
            if (run !== runsRequested || problems.length === 0) return;
            const first = problems[0];
            problem = `${first.path}${first.line === undefined ? '' : `:${first.line}`}: ${first.message}`;
        },
        reportError(message) {
            problem = message;
        },
        setTheme(kind) {
            theme = kind;
        },
        update(deltaMs) {
            if (quietMs === undefined) return;
            quietMs += deltaMs;
            if (quietMs >= RUN_AFTER_EDIT_MS) {
                quietMs = undefined;
                runsRequested++;
            }
        },
    };

    function requestRun(): void {
        quietMs = undefined;
        runsRequested++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function textOf(files: readonly ProjectFile[], path: string): string {
    return files.find((f) => f.path === path)?.text ?? '';
}
