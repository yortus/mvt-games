import { describe, expect, it } from 'vitest';
import { findRenderer, MAIN_PATH, prepareProject, toModuleName } from './prepare-project';

const MAIN = `import { definePixiProject } from 'playground';
import { createThing } from './models';
export const project = definePixiProject({ width: 1, height: 1, start: () => createThing() });
`;

describe('prepareProject', () => {
    it('strips types, and keeps every line where it was', async () => {
        const text = 'interface Thing {\n    readonly n: number;\n}\nexport const n: number = 1;\nthrow new Error("line 5");\n';
        const { modules } = await prepareProject({ files: [{ path: MAIN_PATH, text }] });
        const code = modules[0].code;
        expect(code).not.toContain('interface');
        expect(code.split('\n').findIndex((line) => line.includes('line 5')) + 1).toBe(5);
    });

    it('names each file for stack traces', async () => {
        const { modules } = await prepareProject({ files: [{ path: MAIN_PATH, text: 'export {};' }] });
        expect(modules[0].code).toMatch(new RegExp(`//# sourceURL=${MAIN_PATH}$`));
    });

    it('rewrites a relative import to the project file it names, through a barrel', async () => {
        const files = [
            { path: MAIN_PATH, text: MAIN },
            { path: 'models/index.ts', text: "export { createThing } from './thing-model';" },
            { path: 'models/thing-model.ts', text: 'export function createThing() { return { update() {} }; }' },
        ];
        const { modules, problems } = await prepareProject({ files });
        expect(problems).toEqual([]);
        const main = modules.find((m) => m.path === MAIN_PATH)!.code;
        expect(main).toContain(`from '${toModuleName('models/index.ts')}'`);
        expect(main).toContain("from 'playground'");
        const barrel = modules.find((m) => m.path === 'models/index.ts')!.code;
        expect(barrel).toContain(`from '${toModuleName('models/thing-model.ts')}'`);
    });

    it('compiles JSX for the renderer that main.ts uses, unless a file names its own', async () => {
        const html = MAIN.replace('definePixiProject', 'defineHtmlProject');
        const files = [
            { path: MAIN_PATH, text: html },
            { path: 'models/index.ts', text: 'export function createThing() {}' },
            { path: 'views/plain.tsx', text: 'export const a = <div />;' },
            { path: 'views/pixi.tsx', text: '/** @jsxImportSource @mvtjs/pixi */\nexport const b = <container />;' },
        ];
        const { modules } = await prepareProject({ files });
        expect(modules.find((m) => m.path === 'views/plain.tsx')!.code).toContain('@mvtjs/html/jsx-runtime');
        expect(modules.find((m) => m.path === 'views/pixi.tsx')!.code).toContain('@mvtjs/pixi/jsx-runtime');
    });

    it('reports a syntax error with its file and line', async () => {
        const { problems } = await prepareProject({ files: [{ path: MAIN_PATH, text: 'export {};\nconst = 3;\n' }] });
        expect(problems).toEqual([expect.objectContaining({ path: MAIN_PATH, line: 2 })]);
    });

    it('reports a missing file, and a package the playground does not provide', async () => {
        const text = "import { a } from './nowhere';\nimport b from 'lodash';\nconsole.log(a, b);\n";
        const { problems } = await prepareProject({ files: [{ path: MAIN_PATH, text }] });
        expect(problems.map((p) => p.message)).toEqual([
            expect.stringContaining("'lodash' cannot be imported"),
            expect.stringContaining("Cannot find './nowhere'"),
        ]);
    });

    it('reports a project with no main.ts', async () => {
        const { problems } = await prepareProject({ files: [{ path: 'other.ts', text: '' }] });
        expect(problems).toEqual([expect.objectContaining({ path: MAIN_PATH })]);
    });

    it('turns a CSS file into a module that adds its styles', async () => {
        const files = [
            { path: MAIN_PATH, text: "import './look.css';" },
            { path: 'look.css', text: 'body { color: red; }' },
        ];
        const { modules, problems } = await prepareProject({ files });
        expect(problems).toEqual([]);
        expect(modules.find((m) => m.path === 'look.css')!.code).toContain('body { color: red; }');
    });

    it('guards a loop, unless the file turns guards off', async () => {
        const loop = 'export function spin() { while (Math.random() < 2) {} }';
        const guarded = await prepareProject({ files: [{ path: MAIN_PATH, text: loop }] });
        expect(guarded.loops).toEqual([`${MAIN_PATH}:1`]);
        const unguarded = await prepareProject({ files: [{ path: MAIN_PATH, text: `// no-loop-guards\n${loop}` }] });
        expect(unguarded.loops).toEqual([]);
    });
});

describe('findRenderer', () => {
    it('reads the define function that main.ts calls, and falls back to Pixi', () => {
        expect(findRenderer('defineThreeProject({})')).toBe('three');
        expect(findRenderer('defineHtmlProject({})')).toBe('html');
        expect(findRenderer('definePixiProject({})')).toBe('pixi');
        expect(findRenderer('')).toBe('pixi');
    });
});
