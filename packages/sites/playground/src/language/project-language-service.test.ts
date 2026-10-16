import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeTypeBundles } from '../../scripts';
import { EXAMPLES } from '../examples';
import { createProjectLanguageService, type ProjectLanguageService, type ServiceFile } from './project-language-service';

// The bundles take a few seconds to make, so they are made once for the file
let bundles: ReturnType<typeof makeTypeBundles>;
beforeAll(() => {
    bundles = makeTypeBundles();
}, 60_000);

/** A service, and the bundles it has loaded, in order. */
function createService(): { service: ProjectLanguageService; loaded: string[] } {
    const loaded: string[] = [];
    const service = createProjectLanguageService({
        ts,
        loadBundle: async (kind) => {
            loaded.push(kind);
            return bundles[kind];
        },
    });
    return { service, loaded };
}

function exampleFiles(id: string): ServiceFile[] {
    const example = EXAMPLES.find((e) => e.id === id);
    if (example === undefined) throw new Error(`No example ${id}`);
    return [...example.files];
}

/** The offset just after `marker` in a file's text. */
function offsetAfter(files: readonly ServiceFile[], path: string, marker: string): number {
    const text = files.find((f) => f.path === path)!.text;
    const at = text.indexOf(marker);
    if (at === -1) throw new Error(`No "${marker}" in ${path}`);
    return at + marker.length;
}

describe('a project language service', { timeout: 60_000 }, () => {
    it('finds no type problems in any example', async () => {
        const { service } = createService();
        for (const example of EXAMPLES) {
            await service.setFiles(example.files);
            expect(service.diagnostics(), example.id).toEqual([]);
        }
    });

    it('loads only the type bundles a project needs', async () => {
        const { service, loaded } = createService();
        await service.setFiles([{ path: 'main.ts', text: "import { defineHtmlProject } from 'playground';\n" }]);
        expect(loaded.sort()).toEqual(['mvtjs', 'playground', 'typescript']);
        await service.setFiles([{ path: 'main.ts', text: "import { Container } from 'pixi.js';\n" }]);
        expect(loaded).toContain('pixi');
        expect(loaded).not.toContain('three');
    });

    it('reports a type error at its place, with a fix to import a missing name', async () => {
        const { service } = createService();
        const files = exampleFiles('bouncing-ball').map((f) => (f.path === 'main.ts'
            ? { ...f, text: f.text.replace("import { createBallModel } from './models';\n", '') }
            : f));
        await service.setFiles(files);
        const [problem] = service.diagnostics();
        expect(problem).toMatchObject({ path: 'main.ts', severity: 'error' });
        expect(problem.message).toContain('createBallModel');
        const fix = problem.fixes.find((f) => /import/i.test(f.description));
        expect(fix?.edits[0].newText).toContain("import { createBallModel } from './models';");
    });

    it('completes a model\'s members, and imports a name from another file through its barrel', async () => {
        const { service } = createService();
        const files = exampleFiles('bouncing-ball');
        await service.setFiles(files);
        const members = service.completions('views/ball-view.ts', offsetAfter(files, 'views/ball-view.ts', 'model.'));
        expect(members?.isMemberCompletion).toBe(true);
        expect(members?.entries.map((e) => e.name)).toEqual(expect.arrayContaining(['x', 'y', 'radius', 'isHeld', 'grab']));

        const withNew = [...files, { path: 'views/other-view.ts', text: 'export const make = () => createBallMo' }];
        await service.setFiles(withNew);
        const offset = withNew.at(-1)!.text.length;
        const entry = service.completions('views/other-view.ts', offset)?.entries.find((e) => e.name === 'createBallModel');
        expect(entry?.source).toBeDefined();
        const details = service.completionDetails('views/other-view.ts', offset, entry!);
        expect(details?.edits[0].newText).toContain("from '../models'");
    });

    it('shows a name\'s type on hover, and the signature of a call being typed', async () => {
        const { service } = createService();
        const files = exampleFiles('bouncing-ball');
        await service.setFiles(files);
        const info = service.quickInfo('main.ts', offsetAfter(files, 'main.ts', 'const model = createBallMo'));
        expect(info?.displayText).toContain('createBallModel');

        const typing = [...files.filter((f) => f.path !== 'main.ts'), { path: 'main.ts', text: "import { createBallModel } from './models';\ncreateBallModel(" }];
        await service.setFiles(typing);
        const help = service.signatureHelp('main.ts', typing.at(-1)!.text.length);
        expect(help?.label).toContain('BallModelOptions');
        expect(help?.activeStart).toBeDefined();
    });

    it('finds a definition in the project, and one in a library\'s declarations', async () => {
        const { service } = createService();
        const files = exampleFiles('bouncing-ball');
        await service.setFiles(files);
        const inProject = service.definition('main.ts', offsetAfter(files, 'main.ts', 'const model = createBallMo'));
        expect(inProject).toMatchObject({ path: 'models/ball-model.ts', isLibrary: false });

        const inLibrary = service.definition('views/ball-view.ts', offsetAfter(files, 'views/ball-view.ts', 'new Graphi'));
        expect(inLibrary?.isLibrary).toBe(true);
        expect(inLibrary?.path).toMatch(/^\/node_modules\/pixi\.js\//);
        expect(service.libraryFileText(inLibrary!.path)).toContain('Graphics');
    });

    it('renames a name in every file that uses it', async () => {
        const { service } = createService();
        const files = exampleFiles('bouncing-ball');
        await service.setFiles(files);
        const edits = service.rename('models/ball-model.ts', offsetAfter(files, 'models/ball-model.ts', 'export function createBall'), 'createBouncyBall');
        expect(Array.isArray(edits)).toBe(true);
        const paths = new Set((edits as readonly { path: string }[]).map((e) => e.path));
        expect([...paths].sort()).toEqual(['main.ts', 'models/ball-model.ts', 'models/index.ts']);
    });

    it('formats a file with four-space indents', async () => {
        const { service } = createService();
        await service.setFiles([{ path: 'main.ts', text: 'export function f() {\nreturn 1;\n}\n' }]);
        const edits = service.format('main.ts');
        expect(edits.some((e) => e.newText === '    ')).toBe(true);
    });

    it('organises a file\'s imports: sorted, unused names removed, spaced as formatting spaces them', async () => {
        const { service } = createService();
        const text = 'import { b, unused, a } from \'./names\';\nexport const c = a + b;\n';
        await service.setFiles([
            { path: 'main.ts', text },
            { path: 'names.ts', text: 'export const a = 1;\nexport const b = 2;\nexport const unused = 3;\n' },
        ]);
        const edits = service.organizeImports('main.ts');
        let organised = text;
        for (const edit of [...edits].sort((x, y) => y.start - x.start)) {
            organised = organised.slice(0, edit.start) + edit.newText + organised.slice(edit.end);
        }
        expect(organised.split('\n')[0]).toBe('import { a, b } from \'./names\';');
    });
});
