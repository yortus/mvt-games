// @vitest-environment happy-dom
import { EditorView } from 'codemirror';
import { describe, expect, it, vi } from 'vitest';
import { refreshView } from '@mvtjs/html';
import { THEME_KINDS } from '../models';
import { CodeEditorView } from './code-editor-view';

const PATH = 'main.ts';
const TEXT = 'const a = 1;';
const RENAMED_TEXT = 'const b = 1;';

describe('CodeEditorView', () => {
    it('shows a change made outside it, without reporting it back as an edit', () => {
        const { view, editor, onTextEdited, editFromOutside } = setUp();
        editFromOutside(RENAMED_TEXT);
        refreshView(view);
        expect(editor().state.doc.toString()).toBe(RENAMED_TEXT);
        expect(onTextEdited).not.toHaveBeenCalled();
    });

    it('reports an edit made in the editor, as its text', () => {
        const { editor, onTextEdited } = setUp();
        editor().dispatch({ changes: { from: 0, insert: '// ' } });
        expect(onTextEdited).toHaveBeenCalledExactlyOnceWith(PATH, `// ${TEXT}`);
    });
});

function setUp() {
    let text = TEXT;
    let externalEdits = 0;
    const onTextEdited = vi.fn();
    const view = CodeEditorView({
        activePath: () => PATH,
        textOf: () => text,
        isReadOnly: () => false,
        projectsOpened: () => 0,
        externalEdits: () => externalEdits,
        shownPlace: () => undefined,
        placesShown: () => 0,
        typeChecks: () => 0,
        typeProblemsFor: () => [],
        theme: () => THEME_KINDS[0],
        onTextEdited,
    });
    const editor = (): EditorView => EditorView.findFromDOM(view.querySelector('.cm-editor') as HTMLElement)!;
    const editFromOutside = (next: string): void => {
        text = next;
        externalEdits++;
    };
    return { view, editor, onTextEdited, editFromOutside };
}
