/* eslint-disable @mvtjs/no-null -- CodeMirror's API means "none" by `null`: no completions, no hover tooltip, no completion info, no position under the pointer */
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { type Extension, StateEffect, StateField } from '@codemirror/state';
import { EditorView, hoverTooltip, keymap, showTooltip, type Tooltip, ViewPlugin } from '@codemirror/view';
import type { CompletionEntry, DefinitionTarget, FileEdit, LanguageClient } from '../language';
import { provideEditorCommands } from './editor-menu';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the editor asks the language service. */
export type EditorLanguage = Pick<
    LanguageClient,
    'completions' | 'completionDetails' | 'quickInfo' | 'signatureHelp' | 'definition' | 'rename' | 'organizeImports' | 'format'
>;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LanguageExtensionsOptions {
    /** The project file the editor shows. */
    readonly path: string;
    readonly language: EditorLanguage;
    /** Reported as go to definition finds a declaration, to open it. */
    readonly onDefinitionFound?: (target: DefinitionTarget) => void;
    /** Reported with edits to more files than this one, as a rename makes. */
    readonly onEditsWanted?: (edits: readonly FileEdit[]) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the CodeMirror extensions that make an editor use the language
 * service, for one file: completions (with each one's documentation, and an
 * import added for a name from another module), types on hover, the
 * signature of a call as it is typed, go to definition (F12, or Ctrl+click),
 * rename (F2), organise imports (Shift+Alt+O) and format (Shift+Alt+F).
 */
export function createLanguageExtensions(options: LanguageExtensionsOptions): Extension[] {
    const { path, language } = options;
    // The signature tooltip shown, if any, as a list of none or one
    const setSignature = StateEffect.define<readonly Tooltip[]>();
    const signature = StateField.define<readonly Tooltip[]>({
        create: () => [],
        update(shown, transaction) {
            let next = shown;
            for (const effect of transaction.effects) if (effect.is(setSignature)) next = effect.value;
            if (next.length > 0 && transaction.docChanged) next = next.map((t) => ({ ...t, pos: transaction.changes.mapPos(t.pos) }));
            return next;
        },
        provide: (field) => showTooltip.computeN([field], (state) => state.field(field)),
    });
    // Rises with each change to the signature asked for, so an answer that comes after a later change is dropped
    let signatureRequests = 0;

    return [
        autocompletion({ override: [complete] }),
        hoverTooltip(hover, { hoverTime: HOVER_MS }),
        signature,
        ViewPlugin.define((view) => ({
            update(update) {
                if (!update.docChanged && !update.selectionSet) return;
                const head = update.state.selection.main.head;
                const before = update.state.sliceDoc(head - 1, head);
                const isShown = update.state.field(signature).length > 0;
                // CodeMirror allows no dispatch during an update, so each comes after it
                if (before === ')') {
                    const request = ++signatureRequests;
                    void Promise.resolve().then(() => {
                        if (request === signatureRequests) view.dispatch({ effects: setSignature.of([]) });
                    });
                }
                else if (isShown || before === '(' || before === ',') void showSignature(view, head);
            },
        })),
        provideEditorCommands([
            { label: 'Go to definition', key: 'F12', run: (view) => goToDefinition(view.state.selection.main.head) },
            { label: 'Rename...', key: 'F2', run: renameAtCursor },
            { label: 'Format', key: 'Shift-Alt-f', run: (view) => editThisFile(view, language.format(path)) },
            { label: 'Organise imports', key: 'Shift-Alt-o', run: (view) => editThisFile(view, language.organizeImports(path)) },
        ]),
        keymap.of([
            {
                key: 'Escape',
                run: (view) => {
                    if (view.state.field(signature).length === 0) return false;
                    signatureRequests++;
                    view.dispatch({ effects: setSignature.of([]) });
                    return true;
                },
            },
        ]),
        EditorView.domEventHandlers({
            mousedown(event, view) {
                if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
                const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
                if (at === null) return false;
                event.preventDefault();
                return goToDefinition(at);
            },
        }),
    ];

    async function complete(context: CompletionContext): Promise<CompletionResult | null> {
        const word = context.matchBefore(/[\w$]*/);
        const from = word?.from ?? context.pos;
        const isAfterDot = context.state.sliceDoc(from - 1, from) === '.';
        if (!context.explicit && !isAfterDot && from === context.pos) return null;
        const list = await language.completions(path, context.pos);
        if (list === undefined || context.aborted) return null;
        return {
            from,
            validFor: /^[\w$]*$/,
            options: list.entries.map((entry) => toCompletion(entry, context.pos)),
        };
    }

    function toCompletion(entry: CompletionEntry, pos: number): Completion {
        return {
            label: entry.name,
            type: COMPLETION_TYPES[entry.kind] ?? 'variable',
            // An auto-import says where its name comes from
            detail: entry.source,
            // TypeScript's sort text is a rank, lowest first
            boost: -Number.parseInt(entry.sortText, 10) || 0,
            info: async () => {
                const details = await language.completionDetails(path, pos, entry);
                return details === undefined ? null : infoElement(details.displayText, details.documentation);
            },
            apply: entry.source === undefined
                ? entry.insertText
                : (view, _completion, from, to) => void applyAutoImport(view, entry, pos, from, to),
        };
    }

    /** Puts the name in, and adds its import, in one change, so one undo takes back both. */
    async function applyAutoImport(view: EditorView, entry: CompletionEntry, pos: number, from: number, to: number): Promise<void> {
        const details = await language.completionDetails(path, pos, entry);
        const imports = (details?.edits ?? []).filter((e) => e.path === path);
        view.dispatch({
            changes: [
                { from, to, insert: entry.insertText ?? entry.name },
                ...imports.map((e) => ({ from: e.start, to: e.end, insert: e.newText })),
            ],
        });
    }

    async function hover(_view: EditorView, pos: number): Promise<Tooltip | null> {
        const info = await language.quickInfo(path, pos);
        if (info === undefined || info.displayText === '') return null;
        return {
            pos: info.start,
            end: info.start + info.length,
            above: true,
            create: () => ({ dom: infoElement(info.displayText, info.documentation) }),
        };
    }

    async function showSignature(view: EditorView, pos: number): Promise<void> {
        const request = ++signatureRequests;
        const help = await language.signatureHelp(path, pos);
        if (request !== signatureRequests) return;
        const tooltips: readonly Tooltip[] = help === undefined
            ? []
            : [{
                    pos,
                    above: true,
                    create: () => ({ dom: signatureElement(help.label, help.activeStart, help.activeEnd, help.documentation) }),
                }];
        view.dispatch({ effects: setSignature.of(tooltips) });
    }

    function goToDefinition(pos: number): boolean {
        void language.definition(path, pos).then((target) => {
            if (target !== undefined) options.onDefinitionFound?.(target);
        });
        return true;
    }

    function renameAtCursor(view: EditorView): boolean {
        const head = view.state.selection.main.head;
        const word = view.state.wordAt(head);
        const oldName = word === null ? '' : view.state.sliceDoc(word.from, word.to);
        const newName = window.prompt('Rename to', oldName)?.trim();
        if (newName === undefined || newName === '' || newName === oldName) return true;
        void language.rename(path, head, newName).then((result) => {
            if (typeof result === 'string') window.alert(result);
            else options.onEditsWanted?.(result);
        });
        return true;
    }

    function editThisFile(view: EditorView, pending: Promise<readonly FileEdit[]>): boolean {
        void pending.then((edits) => {
            const own = edits.filter((e) => e.path === path);
            if (own.length > 0) view.dispatch({ changes: own.map((e) => ({ from: e.start, to: e.end, insert: e.newText })) });
        });
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the pointer rests on a name before its type shows. */
const HOVER_MS = 350;

/** CodeMirror's icon for each of TypeScript's kinds of element. Kinds not here show as variables. */
const COMPLETION_TYPES: Readonly<Record<string, string>> = {
    'method': 'method',
    'function': 'function',
    'local function': 'function',
    'property': 'property',
    'getter': 'property',
    'setter': 'property',
    'class': 'class',
    'interface': 'interface',
    'type': 'type',
    'enum': 'enum',
    'module': 'namespace',
    'keyword': 'keyword',
    'const': 'constant',
    'let': 'variable',
    'var': 'variable',
    'parameter': 'variable',
};

/** A tooltip's or a completion's information: the type, then the documentation. */
function infoElement(displayText: string, documentation: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'language-info';
    const type = document.createElement('pre');
    type.className = 'language-info-type';
    type.textContent = displayText;
    element.append(type);
    if (documentation !== '') {
        const doc = document.createElement('p');
        doc.className = 'language-info-doc';
        doc.textContent = documentation;
        element.append(doc);
    }
    return element;
}

/** A call's signature, with the parameter being typed in bold. */
function signatureElement(label: string, activeStart: number | undefined, activeEnd: number | undefined, documentation: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'language-info';
    const signature = document.createElement('pre');
    signature.className = 'language-info-type';
    if (activeStart === undefined || activeEnd === undefined) {
        signature.textContent = label;
    }
    else {
        const active = document.createElement('strong');
        active.textContent = label.slice(activeStart, activeEnd);
        signature.append(label.slice(0, activeStart), active, label.slice(activeEnd));
    }
    element.append(signature);
    if (documentation !== '') {
        const doc = document.createElement('p');
        doc.className = 'language-info-doc';
        doc.textContent = documentation;
        element.append(doc);
    }
    return element;
}
