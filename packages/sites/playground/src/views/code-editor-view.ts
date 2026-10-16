import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { Compartment, EditorSelection, EditorState, Prec } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { acceptCompletion } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { type Diagnostic, setDiagnostics } from '@codemirror/lint';
import { keymap } from '@codemirror/view';
import { onDestroyed, setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { DefinitionTarget, FileEdit, TypeProblem } from '../language';
import type { ThemeKind } from '../models';
import type { SourceLocation } from '../runtime';
import { createEditorMenu } from './editor-menu';
import { THEMES } from './themes';
import { createLanguageExtensions, type EditorLanguage } from './language-extensions';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CodeEditorViewBindings {
    /** The file to show. */
    readonly activePath: () => string;
    readonly textOf: (path: string) => string;
    /** Whether a file is shown read-only, as a library's declarations are. */
    readonly isReadOnly: (path: string) => boolean;
    /** Rises each time a different project opens, which starts every file afresh. */
    readonly projectsOpened: () => number;
    /** Rises each time files change other than by typing here, as a rename changes them. */
    readonly externalEdits: () => number;
    /** The place last asked for. */
    readonly shownPlace: () => SourceLocation | undefined;
    /** Rises each time a place is asked for, to scroll to it. */
    readonly placesShown: () => number;
    /** Rises each time the type problems change. */
    readonly typeChecks: () => number;
    /** A file's type problems, which the editor underlines. */
    readonly typeProblemsFor: (path: string) => readonly TypeProblem[];
    /** The colour theme. */
    readonly theme: () => ThemeKind;
    /** The language service, for completions, hover and the rest. Without it, the editor edits plain text. */
    readonly language?: EditorLanguage;
    /** Reported as each edit is made. */
    readonly onTextEdited?: (path: string, text: string) => void;
    /** Reported as go to definition finds a declaration, to open it. */
    readonly onDefinitionFound?: (target: DefinitionTarget) => void;
    /** Reported with edits to the project's files, as a rename or a fix makes. */
    readonly onEditsWanted?: (edits: readonly FileEdit[]) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A CodeMirror editor for the project's files, one at a time. Each file
 * keeps its own editor state, so its undo history and selection survive a
 * switch to another file and back. With the language service, it completes,
 * shows types on hover, underlines type problems with their fixes, and goes
 * to definitions. A library's declarations show read-only. A right-click
 * opens a menu of what the editor can do there, with each command's keys.
 */
export function CodeEditorView(bindings: CodeEditorViewBindings): Element {
    const element = document.createElement('div');
    element.className = 'code-editor';
    const states = new Map<string, EditorState>();
    // Each file's state has the theme in this compartment, so a new theme replaces it there, keeping the rest
    const themeCompartment = new Compartment();
    let shownTheme = bindings.theme();
    let shownPath = bindings.activePath();
    const editor = new EditorView({ parent: element, state: createState(shownPath) });
    const watcher = watch({
        projects: bindings.projectsOpened,
        path: bindings.activePath,
        places: bindings.placesShown,
        externalEdits: bindings.externalEdits,
        typeChecks: bindings.typeChecks,
        theme: bindings.theme,
    });
    watcher.poll();
    showProblems();

    setRefresh(element, refresh);
    onDestroyed(element, () => editor.destroy());
    return element;

    function refresh(): void {
        const { projects, path, places, externalEdits, typeChecks, theme } = watcher.poll();
        if (theme.changed) {
            shownTheme = theme.value;
            const effects = themeCompartment.reconfigure(THEMES[shownTheme].editor);
            editor.dispatch({ effects });
            for (const [statePath, state] of states) states.set(statePath, state.update({ effects }).state);
        }
        if (projects.changed) {
            states.clear();
            shownPath = path.value;
            editor.setState(createState(shownPath));
        }
        else if (path.changed) {
            states.set(shownPath, editor.state);
            shownPath = path.value;
            editor.setState(states.get(shownPath) ?? createState(shownPath));
        }
        if (externalEdits.changed) takeExternalEdits();
        if (projects.changed || path.changed || typeChecks.changed || externalEdits.changed) showProblems();
        if (places.increased) revealPlace();
    }

    function createState(path: string): EditorState {
        const isReadOnly = bindings.isReadOnly(path);
        return EditorState.create({
            doc: bindings.textOf(path),
            extensions: [
                basicSetup,
                // Tab takes the completion chosen, as Enter does, or else indents
                Prec.high(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
                keymap.of([indentWithTab]),
                indentUnit.of('    '),
                EditorState.tabSize.of(4),
                path.endsWith('.css') ? [] : javascript({ typescript: true, jsx: path.endsWith('.tsx') }),
                themeCompartment.of(THEMES[shownTheme].editor),
                createEditorMenu(),
                isReadOnly ? EditorState.readOnly.of(true) : [],
                isReadOnly || bindings.language === undefined || path.endsWith('.css')
                    ? []
                    : createLanguageExtensions({
                            path,
                            language: bindings.language,
                            onDefinitionFound: bindings.onDefinitionFound,
                            onEditsWanted: bindings.onEditsWanted,
                        }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !isReadOnly) bindings.onTextEdited?.(path, update.state.doc.toString());
                }),
            ],
        });
    }

    /** Brings each file's editor state up to the model's text, as one change, so undo takes it back in one step. */
    function takeExternalEdits(): void {
        const shownChange = changeTo(editor.state, bindings.textOf(shownPath));
        if (shownChange !== undefined) editor.dispatch({ changes: shownChange });
        for (const [path, state] of states) {
            const change = changeTo(state, bindings.textOf(path));
            if (change !== undefined) states.set(path, state.update({ changes: change }).state);
        }
    }

    /** Underlines the shown file's type problems, each with its fixes. */
    function showProblems(): void {
        if (bindings.isReadOnly(shownPath)) return;
        const length = editor.state.doc.length;
        const diagnostics: Diagnostic[] = bindings.typeProblemsFor(shownPath).map((problem) => ({
            from: Math.min(problem.start, length),
            to: Math.min(problem.start + Math.max(problem.length, 1), length),
            severity: problem.severity,
            message: problem.message,
            actions: problem.fixes.map((fix) => ({
                name: fix.description,
                apply: () => bindings.onEditsWanted?.(fix.edits),
            })),
        }));
        editor.dispatch(setDiagnostics(editor.state, diagnostics));
    }

    function revealPlace(): void {
        const place = bindings.shownPlace();
        if (place === undefined || place.path !== shownPath) return;
        const doc = editor.state.doc;
        const line = doc.line(Math.min(Math.max(place.line, 1), doc.lines));
        const at = Math.min(line.from + Math.max((place.column ?? 1) - 1, 0), line.to);
        editor.dispatch({ selection: EditorSelection.cursor(at), scrollIntoView: true });
        editor.focus();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The one change that turns a state's text into `text`: what lies between their common start and common end. */
function changeTo(state: EditorState, text: string): { from: number; to: number; insert: string } | undefined {
    const current = state.doc.toString();
    if (current === text) return undefined;
    let start = 0;
    while (start < current.length && start < text.length && current[start] === text[start]) start++;
    let end = 0;
    while (end < current.length - start && end < text.length - start && current[current.length - 1 - end] === text[text.length - 1 - end]) end++;
    return { from: start, to: current.length - end, insert: text.slice(start, text.length - end) };
}
