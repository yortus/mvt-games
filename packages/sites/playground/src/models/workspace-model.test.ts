import { describe, expect, it } from 'vitest';
import { EXAMPLES, findStarter } from '../examples';
import { createWorkspaceModel, MAX_DESCRIPTION_LENGTH, MAX_FILES, THEME_KINDS } from './workspace-model';

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

    it('keeps the performance the sandbox measures, and starts afresh with each run', () => {
        const model = createRunningModel();
        expect(model.performance).toBeUndefined();
        const sample = { fps: 60, cpuMs: 2.5, gpuMs: undefined, reads: 300, methodCalls: 40, methodListRebuilds: 0, rebuildNodeVisits: 0 };
        model.reportSandboxMessage({ kind: 'metrics', sample });
        model.reportSandboxMessage({ kind: 'metrics', sample: { ...sample, fps: 58 } });
        expect(model.performance?.sampleCount).toBe(2);
        expect(model.performance?.fps).toBe(58);

        model.run();
        model.reportPrepared('<html>');
        expect(model.performance).toBeUndefined();
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

    it('makes edits across files, from the end of each file back, and counts them as external', () => {
        const model = createWorkspaceModel({ project: { name: 'Edits', files: [{ path: 'main.ts', text: 'abc abc' }, { path: 'b.ts', text: 'abc' }] } });
        const external = model.externalEdits;
        model.applyEdits([
            { path: 'main.ts', start: 0, end: 3, newText: 'xyz' },
            { path: 'main.ts', start: 4, end: 7, newText: 'xyz!' },
            { path: 'b.ts', start: 0, end: 3, newText: 'xyz' },
            { path: 'not-in-project.ts', start: 0, end: 0, newText: 'ignored' },
        ]);
        expect(model.textOf('main.ts')).toBe('xyz xyz!');
        expect(model.textOf('b.ts')).toBe('xyz');
        expect(model.paths).not.toContain('not-in-project.ts');
        expect(model.externalEdits).toBe(external + 1);
    });

    it('lists the problems that stop a run, then type problems on other lines, and counts errors by file', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.update(500);
        model.reportChecked({ checkNumber: model.checksRequested, problems: [{ path: 'main.ts', line: 2, message: 'Unexpected token' }], sandboxDocument: undefined });
        const typeProblem = (line: number, severity: 'error' | 'warning') => ({
            path: 'main.ts', line, column: 1, start: 0, length: 1, message: `on line ${line}`, severity, fixes: [],
        });
        model.reportTypeProblems({ checkNumber: model.checksRequested, problems: [typeProblem(2, 'error'), typeProblem(5, 'error'), typeProblem(6, 'warning')] });
        expect(model.problemList.map((p) => [p.line, p.isBlocking])).toEqual([[2, true], [5, false], [6, false]]);
        expect(model.problemCountOf('main.ts')).toBe(2);
        expect(model.problemCountOf('views/b-view.ts')).toBe(0);
    });

    it('ignores type problems the files have changed since', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        const stale = model.checksRequested;
        model.editFile('main.ts', 'changed');
        model.update(500);
        model.reportTypeProblems({ checkNumber: stale, problems: [{ path: 'main.ts', line: 1, column: 1, start: 0, length: 1, message: 'old', severity: 'error', fixes: [] }] });
        expect(model.typeProblems).toEqual([]);
    });

    it('opens a library\'s declarations read-only, at a place', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.openLibraryFile({ path: '/node_modules/pixi.js/lib/index.d.ts', text: 'declare const x: 1;', line: 1, column: 15 });
        expect(model.activePath).toBe('/node_modules/pixi.js/lib/index.d.ts');
        expect(model.textOf(model.activePath)).toBe('declare const x: 1;');
        expect(model.paths).not.toContain(model.activePath);
        expect(model.placesShown).toBe(1);
    });

    it('opens a file at a place asked for', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.showPlace({ path: 'models/a-model.ts', line: 2 });
        expect(model.activePath).toBe('models/a-model.ts');
        expect(model.shownPlace).toEqual({ path: 'models/a-model.ts', line: 2 });
        expect(model.placesShown).toBe(1);
    });

    it('counts each request to save, without changing the project', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        const edits = model.edits;
        model.save();
        model.save();
        expect(model.savesRequested).toBe(2);
        expect(model.edits).toBe(edits);
    });

    it('starts with the theme kept from before, or the first, and changes it', () => {
        expect(createWorkspaceModel({ project: PROJECT }).theme).toBe(THEME_KINDS[0]);
        const model = createWorkspaceModel({ project: PROJECT, theme: THEME_KINDS[1] });
        expect(model.theme).toBe(THEME_KINDS[1]);
        model.setTheme(THEME_KINDS[2]);
        expect(model.theme).toBe(THEME_KINDS[2]);
    });

    it('shares through a dialog: open while sharing, the link copied again on request, and closed', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.copyShareLink();
        expect(model.copiesRequested).toBe(0);
        model.share();
        expect(model.shareStatus).toBe('sharing');
        expect(model.sharesRequested).toBe(1);
        model.reportShareLink('https://example.com/#p1=x');
        model.reportShared('copied');
        expect(model.shareLink).toBe('https://example.com/#p1=x');
        expect(model.shareStatus).toBe('copied');
        model.copyShareLink();
        expect(model.copiesRequested).toBe(1);
        model.closeShare();
        expect(model.shareStatus).toBe('idle');
        // A report that comes after the dialog closed leaves it closed
        model.reportShared('failed');
        expect(model.shareStatus).toBe('idle');
    });

    describe('kept projects', () => {
        /** Ids in order, as the page would make them. */
        function createIds(): () => string {
            let count = 0;
            return () => `id-${++count}`;
        }

        it('keeps an example as a project of its own once it is changed, and not before', () => {
            const model = createWorkspaceModel({ project: PROJECT, createId: createIds() });
            model.openExample(EXAMPLES[0].id);
            expect(model.projectId).toBeUndefined();
            const changes = model.projectChanges;
            model.editFile('main.ts', '// changed');
            expect(model.projectId).toBe('id-1');
            expect(model.projectChanges).toBe(changes + 1);
            expect(model.exampleId).toBeUndefined();
            // Further changes keep the same project
            model.editFile('main.ts', '// changed again');
            expect(model.projectId).toBe('id-1');
            expect(model.projectChanges).toBe(changes + 2);
        });

        it('opens a kept project by its id, without asking for it to be saved', () => {
            const model = createWorkspaceModel({ project: { id: 'kept', ...PROJECT } });
            expect(model.projectId).toBe('kept');
            const changes = model.projectChanges;
            model.openProject({ id: 'other', ...PROJECT });
            expect(model.projectId).toBe('other');
            expect(model.projectChanges).toBe(changes);
        });

        it('makes a new project from a renderer\'s starting project, kept at once', () => {
            const model = createWorkspaceModel({ project: PROJECT, createId: createIds() });
            const changes = model.projectChanges;
            model.newProject('three');
            expect(model.files).toEqual(findStarter('three').files);
            expect(model.projectName).toBe(`New ${findStarter('three').name} project`);
            expect(model.projectId).toBe('id-1');
            expect(model.projectChanges).toBe(changes + 1);
        });

        it('renames the project open, which keeps it, and ignores a blank name', () => {
            const model = createWorkspaceModel({ project: PROJECT, createId: createIds() });
            model.renameProject('   ');
            expect(model.projectName).toBe(PROJECT.name);
            expect(model.projectId).toBeUndefined();
            model.renameProject('  Ball game ');
            expect(model.projectName).toBe('Ball game');
            expect(model.projectId).toBe('id-1');
        });

        it('queues requests for the page, but not to delete the project open', () => {
            const model = createWorkspaceModel({ project: { id: 'open', ...PROJECT } });
            model.requestProject({ kind: 'duplicate', id: 'a' });
            model.requestProject({ kind: 'delete', id: 'open' });
            model.requestProject({ kind: 'delete', id: 'b' });
            expect(model.projectRequests).toEqual([{ kind: 'duplicate', id: 'a' }, { kind: 'delete', id: 'b' }]);
            expect(model.takeProjectRequests()).toHaveLength(2);
            expect(model.projectRequests).toEqual([]);
        });

        it('lists the kept projects as the page reports them', () => {
            const model = createWorkspaceModel({ project: PROJECT });
            const kept = [{ id: 'a', name: 'A', description: '', savedAt: 1, fileCount: 2 }];
            model.reportKeptProjects(kept, false);
            expect(model.keptProjects).toEqual(kept);
            expect(model.isKeepingProjects).toBe(false);
        });

        it('gives each new project a name no other has, even before the page lists them', () => {
            const model = createWorkspaceModel({ project: PROJECT, createId: createIds() });
            model.newProject('pixi');
            model.newProject('pixi');
            expect(model.projectName).toBe(`New ${findStarter('pixi').name} project 2`);
            // Once listed, the names still count
            model.reportKeptProjects([
                { id: 'id-1', name: `New ${findStarter('pixi').name} project`, description: '', savedAt: 1, fileCount: 1 },
                { id: 'id-2', name: `New ${findStarter('pixi').name} project 2`, description: '', savedAt: 2, fileCount: 1 },
            ], true);
            model.newProject('pixi');
            expect(model.projectName).toBe(`New ${findStarter('pixi').name} project 3`);
        });

        it('numbers an example kept under a name a project has already', () => {
            const model = createWorkspaceModel({ project: PROJECT, createId: createIds() });
            model.reportKeptProjects([{ id: 'kept', name: EXAMPLES[0].name, description: '', savedAt: 1, fileCount: 1 }], true);
            model.openExample(EXAMPLES[0].id);
            model.editFile('main.ts', '// changed');
            expect(model.projectName).toBe(`${EXAMPLES[0].name} 2`);
        });

        it('refuses a rename to a name another project has, whatever its case, but not a change of case', () => {
            const model = createWorkspaceModel({ project: { id: 'mine', ...PROJECT } });
            model.reportKeptProjects([{ id: 'other', name: 'Clock', description: '', savedAt: 1, fileCount: 1 }, { id: 'mine', name: PROJECT.name, description: '', savedAt: 2, fileCount: 3 }], true);
            expect(model.renameProject('clock')).toBeDefined();
            expect(model.projectName).toBe(PROJECT.name);
            expect(model.renameProject(PROJECT.name.toUpperCase())).toBeUndefined();
            expect(model.projectName).toBe(PROJECT.name.toUpperCase());
        });

        it('keeps a description, an example\'s own at first, cut to the most a project has, and keeps the project as it changes', () => {
            const model = createWorkspaceModel({ project: PROJECT, createId: createIds() });
            model.openExample(EXAMPLES[0].id);
            expect(model.projectDescription).toBe(EXAMPLES[0].description);
            model.setProjectDescription('x'.repeat(MAX_DESCRIPTION_LENGTH + 10));
            expect(model.projectDescription).toHaveLength(MAX_DESCRIPTION_LENGTH);
            expect(model.projectId).toBe('id-1');
            model.newProject('html');
            expect(model.projectDescription).toBe('');
        });

        it('counts each request to export', () => {
            const model = createWorkspaceModel({ project: PROJECT });
            model.exportProject();
            expect(model.exportsRequested).toBe(1);
        });
    });

    describe('barrels kept for the visitor', () => {
        const FILES = [
            { path: 'main.ts', text: 'main' },
            { path: 'models/a-model.ts', text: 'a' },
            { path: 'models/index.ts', text: 'old' },
            { path: 'gone/index.ts', text: 'stale' },
        ];

        it('writes the barrels the page reports, removes those of folders with no other code, and checks again at once', () => {
            const model = createWorkspaceModel({ project: { name: 'P', files: FILES } });
            const checks = model.checksRequested;
            expect(model.reportKeptBarrels([{ path: 'models/index.ts', text: 'new' }])).toBe(true);
            expect(model.textOf('models/index.ts')).toBe('new');
            expect(model.paths).not.toContain('gone/index.ts');
            expect(model.checksRequested).toBe(checks + 1);
            // The same barrels again change nothing
            expect(model.reportKeptBarrels([{ path: 'models/index.ts', text: 'new' }])).toBe(false);
            expect(model.isKeptBarrel('models/index.ts')).toBe(true);
            expect(model.isKeptBarrel('models/a-model.ts')).toBe(false);
        });

        it('leaves barrels to the visitor once keeping them is off, and keeps the project', () => {
            const model = createWorkspaceModel({ project: { name: 'P', files: FILES }, createId: () => 'id' });
            model.setBarrelKept(false);
            expect(model.isBarrelKept).toBe(false);
            expect(model.projectId).toBe('id');
            expect(model.isKeptBarrel('models/index.ts')).toBe(false);
            expect(model.reportKeptBarrels([])).toBe(false);
            expect(model.paths).toContain('gone/index.ts');
        });

        it('opens a project with its own setting, keeping barrels unless it says not', () => {
            expect(createWorkspaceModel({ project: PROJECT }).isBarrelKept).toBe(true);
            expect(createWorkspaceModel({ project: { ...PROJECT, isBarrelKept: false } }).isBarrelKept).toBe(false);
        });
    });

    describe('moving files', () => {
        it('moves a file, after the edits that fix its imports, keeping it open', () => {
            const model = createWorkspaceModel({ project: PROJECT });
            model.openFile('models/a-model.ts');
            const problem = model.movePath('models/a-model.ts', 'models/b/a-model.ts', [{ path: 'main.ts', start: 0, end: 4, newText: 'MAIN' }]);
            expect(problem).toBeUndefined();
            expect(model.textOf('models/b/a-model.ts')).toBe('a');
            expect(model.paths).not.toContain('models/a-model.ts');
            expect(model.textOf('main.ts')).toBe('MAIN');
            expect(model.activePath).toBe('models/b/a-model.ts');
        });

        it('moves a folder, with every file in it', () => {
            const model = createWorkspaceModel({ project: PROJECT });
            expect(model.movePath('views', 'screens', [])).toBeUndefined();
            expect(model.paths).toContain('screens/b-view.ts');
            expect(model.paths).not.toContain('views/b-view.ts');
        });

        it('refuses to move main.ts, onto a file there already, or to a path that is not one', () => {
            const model = createWorkspaceModel({ project: PROJECT });
            expect(model.movePath('main.ts', 'start.ts', [])).toBeDefined();
            expect(model.movePath('views/b-view.ts', 'models/a-model.ts', [])).toBeDefined();
            expect(model.movePath('views/b-view.ts', 'views/b view.ts', [])).toBeDefined();
            expect(model.paths).toContain('views/b-view.ts');
        });
    });

    it('counts a folder\'s errors, as its path and a slash, as well as each file\'s', () => {
        const model = createWorkspaceModel({ project: PROJECT });
        model.reportTypeProblems({
            checkNumber: model.checksRequested,
            problems: [{ path: 'models/a-model.ts', line: 1, column: 1, start: 0, length: 1, message: 'x', severity: 'error', fixes: [] }],
        });
        expect(model.problemCountOf('models/a-model.ts')).toBe(1);
        expect(model.problemCountOf('models/')).toBe(1);
        expect(model.problemCountOf('views/')).toBe(0);
    });
});
