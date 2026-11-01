import { refreshView, updateView } from '@mvtjs/html';
import { createReaction } from '@mvtjs/utils';
import { REFERENCE_SHEETS_URL } from 'virtual:reference-sheets';
import type { ReferenceSheet } from '../cheat-sheets';
import { createEmbedModel, EmbedView, readEmbedRequest, type EmbedModel } from './embed';
import { loadExample } from './example-loader';
import type { ThemeKind } from './models';
import {
    buildSandboxDocument,
    encodeSharedProject,
    findLibraryUrls,
    MAIN_PATH,
    prepareProject,
    toExampleHash,
    toModuleName,
    toSharedHash,
} from './runtime';
import { PALETTES, writePalette } from './palettes';
import { toChapterUrl } from './reference';
import type { ForwardedKey } from './sandbox';
import './playground.css';
import './embed.css';

// The embed page: one example, running in a page of the docs, in an iframe.
// Its hash names the example, the file the editor opens on, and whether the
// docs are light or dark: `#example=bouncing-ball&file=main.ts&theme=light`.
// The example is one of the playground's own, or one written for a page of
// the book, and the page loads its files alone. The docs tell it when their
// theme changes, with a `set-theme` message.
//
// It runs the example as it opens, in the same sandbox the playground uses.
// It loads no language service, so it stays light: the editor loads only when
// the reader asks to edit, and edits plain text, and the cheat sheets only
// when the reader first opens them. The editor opens below the
// run, and the page tells the docs, with an `editing` message, how much taller
// to make the embed for it. Edits are never kept. Open in the playground takes
// the example, with any edits, to the playground in a new tab.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The playground's theme that matches the docs' light or dark one. */
const THEME_FOR_SCHEME: Readonly<Record<'light' | 'dark', ThemeKind>> = {
    light: 'github-light',
    dark: 'github-dark',
};

/** The longest step the page's loop takes, so a tab left in the background doesn't jump ahead. */
const MAX_STEP_MS = 100;

/** The editor's height, below the run. The docs make the embed this much taller as the editor opens. */
const EDITOR_HEIGHT_PX = 480;

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const root = document.getElementById('embed');
const request = readEmbedRequest(location.hash);
if (root === null) throw new Error('The embed page has no #embed element');
root.textContent = 'Loading...';
const example = request === undefined ? undefined : await loadExample(request.exampleId);

if (request === undefined || example === undefined) {
    root.textContent = 'There is no such example.';
}
else {
    const libraryUrls = findLibraryUrls();
    const model = createEmbedModel({ example, path: request.path, theme: THEME_FOR_SCHEME[request.scheme] });
    const editorPane = document.createElement('div');
    editorPane.className = 'embed-editor-pane';
    root.textContent = '';
    root.style.setProperty('--embed-editor-height', `${EDITOR_HEIGHT_PX}px`);
    root.append(EmbedView({
        model,
        editorPane,
        isNameShown: request.isNameShown,
        isPlaygroundLinkShown: request.isPlaygroundLinkShown,
        chapterUrlOf: (path) => toChapterUrl(path, import.meta.env.BASE_URL),
        onOpenInPlaygroundPressed: () => void openInPlayground(model),
        onCopyImportPressed: (line) => void navigator.clipboard?.writeText(line).catch(() => undefined),
    }));
    writePalette(document.documentElement, PALETTES[model.theme]);

    const prepareRunWhenAsked = createReaction({ watch: () => model.runsRequested, react: () => void prepareRun(model) });
    const openEditorWhenAsked = createReaction({
        watch: () => model.isEditing,
        when: true,
        react: () => {
            window.parent.postMessage({ kind: 'editing', editorHeight: EDITOR_HEIGHT_PX }, '*');
            void openEditor(model, editorPane);
        },
    });
    let isReferenceRequested = false;
    const loadReferenceSheetsWhenOpened = createReaction({
        watch: () => model.isReferenceOpen,
        when: true,
        react: () => {
            if (isReferenceRequested) return;
            isReferenceRequested = true;
            void loadReferenceSheets(model);
        },
    });
    const writePaletteWhenThemeChanges = createReaction({
        watch: () => model.theme,
        react: (theme) => writePalette(document.documentElement, PALETTES[theme]),
    });
    // A reaction never reacts to its first read, and the example runs as the embed opens
    void prepareRun(model);

    window.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (event.source !== window.parent) return;
        const scheme = readThemeMessage(event.data);
        if (scheme !== undefined) model.setTheme(THEME_FOR_SCHEME[scheme]);
        // Fired as this page's own, so the preview passes it on to the sandbox as it passes on keys pressed here
        const key = readKeyMessage(event.data);
        if (key !== undefined) {
            const { type, ...init } = key;
            window.dispatchEvent(new KeyboardEvent(type, { ...init, bubbles: true, cancelable: true }));
        }
    });

    let lastTime: number | undefined;
    const tick = (time: number): void => {
        const deltaMs = Math.min(time - (lastTime ?? time), MAX_STEP_MS);
        lastTime = time;
        model.update(deltaMs);
        prepareRunWhenAsked();
        openEditorWhenAsked();
        loadReferenceSheetsWhenOpened();
        writePaletteWhenThemeChanges();
        updateView(root, deltaMs);
        refreshView(root);
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    /** Makes the run's sandbox document, and tells the model, unless a newer run has been asked for meanwhile. */
    async function prepareRun(embed: EmbedModel): Promise<void> {
        const run = embed.runsRequested;
        const prepared = await prepareProject({ files: embed.files });
        const urls = await libraryUrls;
        if (prepared.problems.length > 0) {
            embed.reportProblems({ run, problems: prepared.problems });
            return;
        }
        embed.reportPrepared({
            run,
            sandboxDocument: buildSandboxDocument({
                background: PALETTES[embed.theme].palette.background,
                modules: prepared.modules,
                loops: prepared.loops,
                libraries: urls.libraries,
                runnerUrl: urls.runnerUrl,
                toModuleName,
                mainPath: MAIN_PATH,
            }),
        });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Fetches the cheat sheets, which the page leaves out until the reader first opens them, and passes them to the model. */
async function loadReferenceSheets(model: EmbedModel): Promise<void> {
    try {
        const response = await fetch(REFERENCE_SHEETS_URL);
        model.reference.sheets = await response.json() as readonly ReferenceSheet[];
    }
    catch (error) {
        console.error('The cheat sheets could not be loaded', error);
    }
}

/** Loads the editor, which the page leaves out until the reader asks to edit, and puts it in its pane. */
async function openEditor(model: EmbedModel, pane: Element): Promise<void> {
    const { CodeEditorView } = await import('./editor');
    pane.append(CodeEditorView({
        activePath: () => model.activePath,
        textOf: (path) => model.files.find((f) => f.path === path)?.text ?? '',
        isReadOnly: () => false,
        projectsOpened: () => 1,
        externalEdits: () => 0,
        shownPlace: () => undefined,
        placesShown: () => 0,
        typeChecks: () => 0,
        typeProblemsFor: () => [],
        theme: () => model.theme,
        onTextEdited: (path, text) => model.editFile({ path, text }),
    }));
}

/**
 * Opens the example, with any edits, in the playground, in a new tab. An
 * unedited example is named in the link, which the playground finds, as it
 * finds the book's; an edited one goes with its files, as a share link.
 */
async function openInPlayground(model: EmbedModel): Promise<void> {
    const hash = model.isEdited
        ? toSharedHash(await encodeSharedProject({ name: model.name, files: model.files }))
        : toExampleHash(model.exampleId);
    window.open(new URL(`./${hash}`, location.href).href, '_blank', 'noopener');
}

/** Reads a `set-theme` message from the docs: the scheme it names, or undefined for any other message. */
function readThemeMessage(data: unknown): 'light' | 'dark' | undefined {
    if (typeof data !== 'object' || data === null) return undefined;
    const message = data as { readonly kind?: unknown; readonly scheme?: unknown };
    if (message.kind !== 'set-theme') return undefined;
    return message.scheme === 'light' || message.scheme === 'dark' ? message.scheme : undefined;
}

/** Reads a `key` message from the docs, a key pressed in the page around while it has the focus: the key, or undefined for any other message. */
function readKeyMessage(data: unknown): ForwardedKey | undefined {
    if (typeof data !== 'object' || data === null) return undefined;
    const message = data as { readonly kind?: unknown; readonly key?: Partial<ForwardedKey> };
    const key = message.key;
    if (message.kind !== 'key' || key === undefined || (key.type !== 'keydown' && key.type !== 'keyup')) return undefined;
    return {
        type: key.type,
        key: String(key.key ?? ''),
        code: String(key.code ?? ''),
        repeat: key.repeat === true,
        shiftKey: key.shiftKey === true,
        ctrlKey: key.ctrlKey === true,
        altKey: key.altKey === true,
        metaKey: key.metaKey === true,
    };
}
