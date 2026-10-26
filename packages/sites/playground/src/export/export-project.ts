import { strToU8, zipSync } from 'fflate';
import { EXPORT_DEPENDENCIES, EXPORT_DEV_DEPENDENCIES } from '../../libraries';
import type { RendererKind } from '../project-api';
import type { ProjectFile } from '../runtime';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A package's version, as the playground runs it, and whether it is on npm yet. */
export interface PackageVersion {
    readonly version: string;
    /** Whether the package is not on npm yet, so an exported project cannot install it. */
    readonly isPrivate: boolean;
}

/** An exported project: the folder it unzips to, and its files, by their paths in that folder. */
export interface ExportedProject {
    readonly folder: string;
    readonly files: readonly ProjectFile[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ExportProjectOptions {
    readonly name: string;
    /** What the project is, for the README. The default is none. */
    readonly description?: string;
    readonly files: readonly ProjectFile[];
    /** Each package an exported project may depend on, by its name on npm. */
    readonly packages: Readonly<Record<string, PackageVersion>>;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes a project into a Vite project of its own: its files under `src/`,
 * the `playground` module beside them as `src/playground.ts`, and a runner
 * that does what the playground's sandbox does, in `src/runner/`, started
 * by `src/index.ts`. The runner's files are the sandbox's own. The project's
 * imports of `playground` become relative paths. `npm install`, then
 * `npm run dev`, runs it.
 */
export function exportProject(options: ExportProjectOptions): ExportedProject {
    const { name, packages } = options;
    const renderer = rendererOf(options.files);
    const files: ProjectFile[] = [
        { path: 'package.json', text: packageJson(name, packages) },
        { path: 'tsconfig.json', text: tsconfigJson(renderer) },
        { path: 'index.html', text: indexHtml(name) },
        { path: 'README.md', text: readme(name, options.description ?? '', packages, options.files) },
        { path: 'src/index.ts', text: indexTs(renderer) },
        { path: 'src/playground.ts', text: source('../project-api/define-project.ts') },
    ];
    for (const runnerFile of ['renderer-host', 'run-project', 'fit-to-window', HOST_FILES[renderer]]) {
        files.push({ path: `src/runner/${runnerFile}.ts`, text: source(`../sandbox/${runnerFile}.ts`).replaceAll(`'../project-api'`, `'../playground'`) });
    }
    for (const file of options.files) {
        files.push({ path: `src/${file.path}`, text: withPlaygroundImports(file.text, file.path) });
    }
    return { folder: toFolderName(name), files };
}

/** An exported project as a zip, its files in its folder. */
export function zipExportedProject(project: ExportedProject): Uint8Array {
    const entries: Record<string, Uint8Array> = {};
    for (const file of project.files) entries[`${project.folder}/${file.path}`] = strToU8(file.text);
    return zipSync(entries);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The sources an exported project is made from, as text, by their paths from this file. */
const SOURCES = import.meta.glob<string>(
    ['../project-api/define-project.ts', '../sandbox/{renderer-host,run-project,fit-to-window,pixi-host,html-host,three-host}.ts'],
    { query: '?raw', import: 'default', eager: true },
);

const HOST_FILES: Readonly<Record<RendererKind, string>> = { pixi: 'pixi-host', html: 'html-host', three: 'three-host' };
const HOST_FACTORIES: Readonly<Record<RendererKind, string>> = { pixi: 'createPixiHost', html: 'createHtmlHost', three: 'createThreeHost' };

function source(path: string): string {
    const text = SOURCES[path];
    if (text === undefined) throw new Error(`An export needs ${path}, which is not among its sources`);
    return text;
}

/** The renderer the project's `main.ts` defines its project with. */
function rendererOf(files: readonly ProjectFile[]): RendererKind {
    const main = files.find((f) => f.path === 'main.ts')?.text ?? '';
    const match = /\bdefine(Pixi|Html|Three)Project\b/.exec(main);
    return match === null ? 'pixi' : match[1].toLowerCase() as RendererKind;
}

function isPublished(packages: Readonly<Record<string, PackageVersion>>, name: string): boolean {
    const found = packages[name];
    return found !== undefined && !found.isPrivate;
}

/** A project file's text, with each import of `playground` made a path to `src/playground.ts`. */
function withPlaygroundImports(text: string, path: string): string {
    const depth = path.split('/').length - 1;
    const specifier = depth === 0 ? './playground' : `${'../'.repeat(depth)}playground`;
    return text.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])playground\2/g, `$1$2${specifier}$2`);
}

/** A folder name made from the project's name: `Bouncing Ball` is `bouncing-ball`. */
function toFolderName(name: string): string {
    const folder = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return folder === '' ? 'mvt-project' : folder;
}

function packageJson(name: string, packages: Readonly<Record<string, PackageVersion>>): string {
    const versionsOf = (names: readonly string[]): Record<string, string> => {
        const versions: Record<string, string> = {};
        for (const packageName of names) {
            if (isPublished(packages, packageName)) versions[packageName] = `^${packages[packageName].version}`;
        }
        return versions;
    };
    return `${JSON.stringify({
        name: toFolderName(name),
        private: true,
        type: 'module',
        scripts: { 'dev': 'vite', 'build': 'tsc && vite build', 'preview': 'vite preview' },
        dependencies: versionsOf(EXPORT_DEPENDENCIES),
        devDependencies: versionsOf(EXPORT_DEV_DEPENDENCIES),
    }, undefined, 4)}\n`;
}

/** The language service's settings, so the project type-checks as it did in the playground. */
function tsconfigJson(renderer: RendererKind): string {
    return `${JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            strict: true,
            jsx: 'react-jsx',
            jsxImportSource: `@mvtjs/${renderer}`,
            skipLibCheck: true,
            noEmit: true,
            isolatedModules: true,
            // Vite's own, such as `import.meta.env`, as Vite's template has them
            types: ['vite/client'],
        },
        include: ['src'],
    }, undefined, 4)}\n`;
}

function indexHtml(name: string): string {
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(name)}</title>
        <style>
            html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #111111; }
            canvas { display: block; }
        </style>
    </head>
    <body>
        <script type="module" src="/src/index.ts"></script>
    </body>
</html>
`;
}

function indexTs(renderer: RendererKind): string {
    const host = HOST_FACTORIES[renderer];
    return [
        '// Runs the project: makes its renderer, calls its `start`, and ticks it each frame.',
        `import { createAudio80 } from 'audio90';`,
        `import { project } from './main';`,
        `import { ${host} } from './runner/${HOST_FILES[renderer]}';`,
        `import { runProject } from './runner/run-project';`,
        '',
        `void runProject({ project, createHost: ${host}, createSound: () => createAudio80({ context: new AudioContext() }) });`,
        '',
    ].join('\n');
}

function readme(name: string, description: string, packages: Readonly<Record<string, PackageVersion>>, files: readonly ProjectFile[]): string {
    const unpublished = EXPORT_DEPENDENCIES.filter((p) => packages[p]?.isPrivate === true);
    const importsUnpublished = unpublished.filter((p) => files.some((f) => f.text.includes(`'${p}`) || f.text.includes(`"${p}`)));
    const notes = unpublished.length === 0
        ? []
        : [
                '',
                '## Not on npm yet',
                '',
                `${unpublished.map((p) => `\`${p}\``).join(', ')} ${unpublished.length === 1 ? 'is' : 'are'} not on npm yet, so this project does not depend on ${unpublished.length === 1 ? 'it' : 'them'}.`,
                ...(importsUnpublished.length === 0 ? [] : [`The project imports ${importsUnpublished.map((p) => `\`${p}\``).join(', ')}, so it will not build until then.`]),
            ];
    return [
        `# ${name}`,
        '',
        ...(description === '' ? [] : [description, '']),
        'A project made in the MVT playground: a model, and views of it, ticked each frame.',
        '',
        '## Running it',
        '',
        '```sh',
        'npm install',
        'npm run dev',
        '```',
        '',
        '`npm run build` type-checks it and builds it into `dist/`.',
        '',
        '## Its files',
        '',
        '- `src/main.ts` and the files beside it are the project, as it was in the playground.',
        '- `src/playground.ts` is the playground\'s `define` functions.',
        '- `src/runner/` runs the project, as the playground\'s preview did, and `src/index.ts` starts it.',
        ...notes,
        '',
    ].join('\n');
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
