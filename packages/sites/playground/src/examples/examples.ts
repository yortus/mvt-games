import type { RendererKind } from '../project-api';
import type { ProjectFile } from '../runtime';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** An example project, as the playground lists and opens it. */
export interface Example {
    /** The name of its folder in `examples/`, which links use: `#example=<id>`. */
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly files: readonly ProjectFile[];
}

/** A starting project, which New opens. Each renderer has one, and PixiJS 3D has its own. */
export interface Starter {
    /** Its folder's name in `starters/`, such as `'pixi'` or `'pixi-3d'`. */
    readonly id: string;
    /** The renderer it draws with, as its `starter.ts` names it, or else as its folder's name does. */
    readonly renderer: RendererKind;
    /** What it is offered as, such as "Pixi". */
    readonly name: string;
    readonly description: string;
    readonly files: readonly ProjectFile[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The order the examples are listed in. An example missing here comes after these, by id. */
const ORDER = [
    'bouncing-ball',
    'score-counter',
    'traffic-light',
    'keyboard-sprite',
    'countdown-timer',
    'clock',
    'bouncing-ball-jsx',
    'traffic-light-jsx',
];

/** The order the starting projects are offered in, by their ids. A starter whose id isn't listed comes after these. */
const STARTER_ORDER: readonly string[] = ['pixi', 'pixi-3d', 'html', 'three'];

/** Every example, in the order the playground lists them. */
export const EXAMPLES: readonly Example[] = readExamples();

/** The example with this id, if there is one. */
export function findExample(id: string): Example | undefined {
    return EXAMPLES.find((example) => example.id === id);
}

/** The starting projects: Pixi's, PixiJS 3D's, HTML's, then three.js's. */
export const STARTERS: readonly Starter[] = readStarters();

/** The starting project with this id, such as `'pixi'`. */
export function findStarter(id: string): Starter {
    const starter = STARTERS.find((s) => s.id === id);
    if (starter === undefined) throw new Error(`No starting project called ${id}`);
    return starter;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A project's own description, in its folder's `example.ts` or `starter.ts`, which is not part of the project. */
interface ProjectInfo {
    readonly name: string;
    readonly description: string;
    /** For a starter, the renderer it draws with, when its folder isn't named for one. PixiJS 3D's starter draws with Pixi, for example. */
    readonly renderer?: RendererKind;
}

/** A folder of a project's files, with its info file. */
interface ProjectFolder {
    /** The folder's name. */
    readonly folder: string;
    readonly info: ProjectInfo;
    /** The folder's other files, by their paths in the folder. */
    readonly files: ProjectFile[];
}

function readExamples(): Example[] {
    // Every file of every example, as text, by its path from this file
    const texts = import.meta.glob<string>('../../examples/*/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true });
    const infos = import.meta.glob<ProjectInfo>('../../examples/*/example.ts', { import: 'example', eager: true });
    const examples = readFolders(texts, infos).map(({ folder, info, files }) => ({ id: folder, ...info, files }));
    return examples.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

function readStarters(): Starter[] {
    const texts = import.meta.glob<string>('../../starters/*/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true });
    const infos = import.meta.glob<ProjectInfo>('../../starters/*/starter.ts', { import: 'starter', eager: true });
    const starters = readFolders(texts, infos).map(({ folder, info, files }) => ({
        id: folder,
        renderer: info.renderer ?? (folder as RendererKind),
        name: info.name,
        description: info.description,
        files,
    }));
    return starters.sort((a, b) => rankStarter(a.id) - rankStarter(b.id) || a.id.localeCompare(b.id));
}

function rankStarter(id: string): number {
    const index = STARTER_ORDER.indexOf(id);
    return index < 0 ? STARTER_ORDER.length : index;
}

/** Each folder that has an info file. */
function readFolders(texts: Readonly<Record<string, string>>, infos: Readonly<Record<string, ProjectInfo>>): ProjectFolder[] {
    const folders: ProjectFolder[] = [];
    for (const [infoPath, info] of Object.entries(infos)) {
        const folder = infoPath.slice(0, infoPath.lastIndexOf('/') + 1);
        const files: ProjectFile[] = [];
        for (const [path, text] of Object.entries(texts)) {
            if (!path.startsWith(folder) || path === infoPath) continue;
            files.push({ path: path.slice(folder.length), text });
        }
        files.sort((a, b) => a.path.localeCompare(b.path));
        folders.push({ folder: folder.split('/').at(-2) ?? folder, info, files });
    }
    return folders;
}

function rank(id: string): number {
    const index = ORDER.indexOf(id);
    return index === -1 ? ORDER.length : index;
}
