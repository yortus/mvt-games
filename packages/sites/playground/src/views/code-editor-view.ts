import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorSelection, EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { onDestroyed, setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { SourceLocation } from '../runtime';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CodeEditorViewBindings {
    /** The file to show. */
    readonly activePath: () => string;
    readonly textOf: (path: string) => string;
    /** Rises each time a different project opens, which starts every file afresh. */
    readonly projectsOpened: () => number;
    /** The place last asked for. */
    readonly shownPlace: () => SourceLocation | undefined;
    /** Rises each time a place is asked for, to scroll to it. */
    readonly placesShown: () => number;
    /** Reported as each edit is made. */
    readonly onTextEdited?: (path: string, text: string) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A CodeMirror editor for the project's files, one at a time. Each file
 * keeps its own editor state, so its undo history and selection survive a
 * switch to another file and back.
 */
export function CodeEditorView(bindings: CodeEditorViewBindings): Element {
    const element = document.createElement('div');
    element.className = 'code-editor';
    const states = new Map<string, EditorState>();
    let shownPath = bindings.activePath();
    const editor = new EditorView({ parent: element, state: createState(shownPath) });
    const watcher = watch({
        projects: bindings.projectsOpened,
        path: bindings.activePath,
        places: bindings.placesShown,
    });
    watcher.poll();

    setRefresh(element, refresh);
    onDestroyed(element, () => editor.destroy());
    return element;

    function refresh(): void {
        const { projects, path, places } = watcher.poll();
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
        if (places.increased) revealPlace();
    }

    function createState(path: string): EditorState {
        return EditorState.create({
            doc: bindings.textOf(path),
            extensions: [
                basicSetup,
                keymap.of([indentWithTab]),
                indentUnit.of('    '),
                EditorState.tabSize.of(4),
                path.endsWith('.css') ? [] : javascript({ typescript: true, jsx: path.endsWith('.tsx') }),
                oneDark,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) bindings.onTextEdited?.(path, update.state.doc.toString());
                }),
            ],
        });
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
