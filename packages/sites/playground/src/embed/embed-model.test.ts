import { describe, expect, it } from 'vitest';
import { MAIN_PATH } from '../runtime';
import { createEmbedModel, RUN_AFTER_EDIT_MS } from './embed-model';

const EXAMPLE = {
    id: 'ball',
    name: 'Ball',
    files: [
        { path: MAIN_PATH, text: 'main' },
        { path: 'views/ball-view.ts', text: 'view' },
    ],
};

function createModel(path?: string) {
    return createEmbedModel({ example: EXAMPLE, path, theme: 'github-dark' });
}

describe('an embed model', () => {
    it('asks to run as it opens, with the editor closed, on the file asked for', () => {
        const model = createModel('views/ball-view.ts');
        expect(model.runsRequested).toBe(1);
        expect(model.isEditing).toBe(false);
        expect(model.activePath).toBe('views/ball-view.ts');
        expect(model.isEdited).toBe(false);
    });

    it('opens on main.ts when the file asked for is not in the example', () => {
        expect(createModel('views/missing.ts').activePath).toBe(MAIN_PATH);
        expect(createModel().activePath).toBe(MAIN_PATH);
    });

    it('starts a sandbox only for the latest run asked for', () => {
        const model = createModel();
        model.restart();
        model.reportPrepared({ run: 1, sandboxDocument: 'old' });
        expect(model.sandboxesStarted).toBe(0);
        model.reportPrepared({ run: 2, sandboxDocument: 'new' });
        expect(model.sandboxesStarted).toBe(1);
        expect(model.sandboxDocument).toBe('new');
    });

    it('shows the first problem, with its place, and clears it when a run starts', () => {
        const model = createModel();
        model.reportProblems({ run: 1, problems: [{ path: 'main.ts', line: 3, message: 'Expected ;' }] });
        expect(model.problem).toBe('main.ts:3: Expected ;');
        model.restart();
        model.reportPrepared({ run: 2, sandboxDocument: 'doc' });
        expect(model.problem).toBeUndefined();
    });

    it('runs again once the edits have stopped for a moment', () => {
        const model = createModel();
        model.editFile({ path: MAIN_PATH, text: 'main 2' });
        model.update(RUN_AFTER_EDIT_MS / 2);
        model.editFile({ path: MAIN_PATH, text: 'main 3' });
        model.update(RUN_AFTER_EDIT_MS / 2);
        expect(model.runsRequested).toBe(1);
        model.update(RUN_AFTER_EDIT_MS / 2);
        expect(model.runsRequested).toBe(2);
        expect(model.isEdited).toBe(true);
        expect(model.files[0].text).toBe('main 3');
    });

    it('pauses as it steps, steps only a run that has started, and carries on at a speed', () => {
        const model = createModel();
        model.step();
        expect(model.isPaused).toBe(true);
        expect(model.steps).toBe(0);
        model.reportPrepared({ run: 1, sandboxDocument: 'doc' });
        expect(model.isPaused).toBe(true);
        model.step();
        expect(model.steps).toBe(1);
        model.playAt(0.25);
        expect(model.isPaused).toBe(false);
        expect(model.speed).toBe(0.25);
        expect(model.runsRequested).toBe(1);
    });

    it('keeps a paused run paused as an edit runs it again, and unpauses it as Restart is pressed', () => {
        const model = createModel();
        model.reportPrepared({ run: 1, sandboxDocument: 'doc' });
        model.step();
        model.editFile({ path: MAIN_PATH, text: 'changed' });
        model.update(RUN_AFTER_EDIT_MS);
        model.reportPrepared({ run: 2, sandboxDocument: 'doc 2' });
        expect(model.isPaused).toBe(true);
        model.restart();
        expect(model.isPaused).toBe(false);
    });

    it('runs again as a speed is chosen after an error stopped the run', () => {
        const model = createModel();
        model.reportPrepared({ run: 1, sandboxDocument: 'doc' });
        model.reportError('boom');
        model.playAt(1);
        expect(model.runsRequested).toBe(2);
    });

    it('closes the list of files as a file is chosen', () => {
        const model = createModel();
        model.toggleFileMenu();
        expect(model.isFileMenuOpen).toBe(true);
        model.showFile(MAIN_PATH);
        expect(model.isFileMenuOpen).toBe(false);
    });

    it('opens and closes the cheat sheet, which follows what the example imports', () => {
        const model = createEmbedModel({
            example: {
                id: 'html-counter',
                name: 'Counter',
                files: [{ path: MAIN_PATH, text: "import { defineHtmlProject } from 'playground';" }],
            },
            path: undefined,
            theme: 'github-dark',
        });
        expect(model.isReferenceOpen).toBe(false);
        expect(model.reference.renderer).toBe('html');
        expect(model.reference.usedNames).toEqual([{ name: 'defineHtmlProject', from: 'playground' }]);
        model.toggleReference();
        expect(model.isReferenceOpen).toBe(true);
        model.editFile({ path: MAIN_PATH, text: "import { definePixiProject } from 'playground';" });
        expect(model.reference.renderer).toBe('pixi');
        expect(model.reference.usedNames).toEqual([{ name: 'definePixiProject', from: 'playground' }]);
        model.closeReference();
        expect(model.isReferenceOpen).toBe(false);
    });
});
