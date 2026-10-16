import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { createWorkspaceModel, MAX_FILES } from './workspace-model';

const PROJECT = {
    name: 'Test',
    files: [
        { path: 'views/b-view.ts', text: 'b' },
        { path: 'main.ts', text: 'main' },
        { path: 'models/a-model.ts', text: 'a' },
    ],
};

function createRunningModel(): ReturnType<typeof createWorkspaceModel> {
    const model = createWorkspaceModel({ project: PROJECT });
    model.run();
    model.reportPrepared('<html>');
    model.reportSandboxMessage({ kind: 'first-frame' });
    return model;
}

describe('a workspace model', () => {
    it('opens a project with main.ts first and open', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        expect(model.paths).toEqual(['main.ts', 'models/a-model.ts', 'views/b-view.ts']);
        expect(model.activePath).toBe('main.ts');
        expect(model.textOf('models/a-model.ts')).toBe('a');
        expect(model.phase).toBe('idle');
    });

    it('opens an example by its id', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        const opened = model.projectsOpened;
        expect(model.openExample(EXAMPLES[0].id)).toBe(true);
        expect(model.projectName).toBe(EXAMPLES[0].name);
        expect(model.projectsOpened).toBe(opened + 1);
        expect(model.exampleId).toBe(EXAMPLES[0].id);
        expect(model.openExample('no-such-example')).toBe(false);
        // An edit makes it the visitor's own project
        model.editFile('main.ts', '// changed');
        expect(model.exampleId).toBeUndefined();
    });

    it('counts edits, and ignores an edit that changes nothing', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        const edits = model.edits;
        model.editFile('main.ts', 'main');
        expect(model.edits).toBe(edits);
        model.editFile('main.ts', 'changed');
        expect(model.edits).toBe(edits + 1);
        expect(model.files[0]).toEqual({ path: 'main.ts', text: 'changed' });
    });

    it('adds a file and opens it, but refuses a bad path or one taken', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        expect(model.addFile('data/level.ts')).toBeUndefined();
        expect(model.activePath).toBe('data/level.ts');
        expect(model.addFile('data/level.ts')).toContain('already');
        expect(model.addFile('no extension')).toBeDefined();
        expect(model.addFile('../escape.ts')).toBeDefined();
    });

    it('refuses a file past the limit', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        for (let i = model.paths.length; i < MAX_FILES; i++) expect(model.addFile(`extra/file-${i}.ts`)).toBeUndefined();
        expect(model.addFile('one-more.ts')).toContain(String(MAX_FILES));
    });

    it('removes a file, but never main.ts', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.openFile('views/b-view.ts');
        model.removeFile('views/b-view.ts');
        expect(model.paths).not.toContain('views/b-view.ts');
        expect(model.activePath).toBe('main.ts');
        model.removeFile('main.ts');
        expect(model.paths).toContain('main.ts');
    });

    it('goes from preparing to starting to running as a run goes', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.run();
        expect(model.phase).toBe('preparing');
        model.reportPrepared('<html>');
        expect(model.phase).toBe('starting');
        expect(model.sandboxDocument).toBe('<html>');
        expect(model.sandboxesStarted).toBe(1);
        model.reportSandboxMessage({ kind: 'first-frame' });
        expect(model.phase).toBe('running');
    });

    it('fails a run with problems, and lists each with its place', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.run();
        model.reportProblems([{ path: 'main.ts', line: 3, message: 'Unexpected token' }]);
        expect(model.phase).toBe('failed');
        expect(model.consoleEntries).toEqual([
            { level: 'error', text: 'Unexpected token', location: { path: 'main.ts', line: 3 } },
        ]);
        // A problem with no line names its file in its text
        model.run();
        model.reportProblems([{ path: 'main.ts', message: 'Missing' }]);
        expect(model.consoleEntries.at(-1)?.text).toBe('main.ts: Missing');
    });

    it('logs an error from a frame with the file and line it names, and fails the run', () => {
        const model = createRunningModel();
        model.reportSandboxMessage({ kind: 'error', phase: 'frame', message: 'boom', stack: 'at update (models/a-model.ts:7:3)' });
        expect(model.phase).toBe('failed');
        expect(model.consoleEntries.at(-1)).toEqual({ level: 'error', text: 'boom', location: { path: 'models/a-model.ts', line: 7, column: 3 } });
    });

    it('keeps running after an error outside a frame', () => {
        const model = createRunningModel();
        model.reportSandboxMessage({ kind: 'error', phase: 'outside', message: 'rejected', stack: '' });
        expect(model.phase).toBe('running');
    });

    it('pauses, steps only while paused, and resumes', () => {
        const model = createRunningModel();
        model.step();
        expect(model.steps).toBe(0);
        model.pause();
        model.step();
        expect(model.isPaused).toBe(true);
        expect(model.steps).toBe(1);
        model.resume();
        expect(model.isPaused).toBe(false);
    });

    it('stops a run whose sandbox goes silent, and not one that keeps talking', () => {
        const talking = createRunningModel();
        for (let ms = 0; ms < 10000; ms += 500) {
            talking.update(500);
            talking.reportSandboxMessage({ kind: 'heartbeat' });
        }
        expect(talking.phase).toBe('running');

        const silent = createRunningModel();
        for (let ms = 0; ms < 10000; ms += 500) silent.update(500);
        expect(silent.phase).toBe('stopped');
        expect(silent.sandboxDocument).toBeUndefined();
        expect(silent.consoleEntries.at(-1)?.text).toContain('stopped responding');
    });

    it('ignores the sandbox once stopped', () => {
        const model = createRunningModel();
        model.stop();
        model.reportSandboxMessage({ kind: 'console', level: 'log', text: 'late' });
        expect(model.phase).toBe('stopped');
        expect(model.consoleEntries).toEqual([]);
    });

    it('asks for a check once the files stand unchanged for half a second', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.update(500);
        const checks = model.checksRequested;
        model.editFile('main.ts', 'one');
        model.update(300);
        model.editFile('main.ts', 'two');
        model.update(300);
        expect(model.checksRequested).toBe(checks);
        model.update(200);
        expect(model.checksRequested).toBe(checks + 1);
        model.update(1000);
        expect(model.checksRequested).toBe(checks + 1);
    });

    it('asks for no check of files that Run has just prepared', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.run();
        model.update(1000);
        expect(model.checksRequested).toBe(0);
    });

    it('runs again after a change that checks clean, and lists what a check finds', () => {
        const model = createRunningModel();
        model.editFile('main.ts', 'changed');
        model.update(500);
        const started = model.sandboxesStarted;
        expect(model.isRunByVisitor).toBe(true);
        model.reportChecked({ checkNumber: model.checksRequested, problems: [], sandboxDocument: '<html 2>' });
        expect(model.sandboxesStarted).toBe(started + 1);
        expect(model.sandboxDocument).toBe('<html 2>');
        // A run on change leaves the focus in the editor
        expect(model.isRunByVisitor).toBe(false);
        expect(model.phase).toBe('starting');

        model.editFile('main.ts', 'broken');
        model.update(500);
        const problem = { path: 'main.ts', line: 1, message: 'Unexpected token' };
        model.reportChecked({ checkNumber: model.checksRequested, problems: [problem], sandboxDocument: undefined });
        expect(model.problems).toEqual([problem]);
        expect(model.sandboxesStarted).toBe(started + 1);
    });

    it('ignores a check the files have changed since', () => {
        const model = createRunningModel();
        model.editFile('main.ts', 'changed');
        model.update(500);
        const stale = model.checksRequested;
        model.editFile('main.ts', 'changed again');
        model.update(500);
        const started = model.sandboxesStarted;
        model.reportChecked({ checkNumber: stale, problems: [], sandboxDocument: '<old>' });
        expect(model.sandboxesStarted).toBe(started);
    });

    it('does not run again after a change when run on change is off, or the visitor stopped the run', () => {
        const off = createRunningModel();
        off.setRunOnChange(false);
        off.editFile('main.ts', 'changed');
        off.update(500);
        const started = off.sandboxesStarted;
        off.reportChecked({ checkNumber: off.checksRequested, problems: [], sandboxDocument: '<html>' });
        expect(off.sandboxesStarted).toBe(started);

        const stopped = createRunningModel();
        stopped.stop();
        stopped.editFile('main.ts', 'changed');
        stopped.update(500);
        stopped.reportChecked({ checkNumber: stopped.checksRequested, problems: [], sandboxDocument: '<html>' });
        expect(stopped.phase).toBe('stopped');
    });

    it('shows the run on a narrow screen as it runs, and the code as a file opens', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.run();
        expect(model.layout.narrowPanel).toBe('run');
        model.openFile('views/b-view.ts');
        expect(model.layout.narrowPanel).toBe('code');
    });

    it('opens a file at a place asked for', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.showPlace({ path: 'models/a-model.ts', line: 2 });
        expect(model.activePath).toBe('models/a-model.ts');
        expect(model.shownPlace).toEqual({ path: 'models/a-model.ts', line: 2 });
        expect(model.placesShown).toBe(1);
    });
});
