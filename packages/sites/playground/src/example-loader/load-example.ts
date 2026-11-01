import type { ProjectFile } from '../runtime';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** An example, loaded on its own: one of the playground's, or one of the book's. */
export interface LoadedExample {
    /** The name of its folder, in `examples/` or `book/`. */
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly files: readonly ProjectFile[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Loads one example's files, and only its: the playground's examples, in
 * `examples/`, and the book's, in `book/`, are each fetched as asked for. So
 * a page that runs one example loads no other's text. Returns undefined if
 * neither folder has it.
 */
export async function loadExample(id: string): Promise<LoadedExample | undefined> {
    for (const folder of FOLDERS) {
        const infoPath = `${folder}/${id}/example.ts`;
        const loadInfo = INFOS[infoPath] as (() => Promise<ProjectInfo>) | undefined;
        if (loadInfo === undefined) continue;
        const prefix = `${folder}/${id}/`;
        const paths = Object.keys(TEXTS).filter((path) => path.startsWith(prefix) && path !== infoPath);
        const [info, texts] = await Promise.all([loadInfo(), Promise.all(paths.map((path) => TEXTS[path]()))]);
        const files = paths.map((path, i) => ({ path: path.slice(prefix.length), text: texts[i] }));
        files.sort((a, b) => a.path.localeCompare(b.path));
        return { id, name: info.name, description: info.description, files };
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A project's own description, in its folder's `example.ts`, which is not part of the project. */
interface ProjectInfo {
    readonly name: string;
    readonly description: string;
}

const FOLDERS = ['../../examples', '../../book'] as const;

/** Every file of every example, as text, each fetched when it's asked for, by its path from this file. */
const TEXTS = import.meta.glob<string>(['../../examples/*/**/*.{ts,tsx,css}', '../../book/*/**/*.{ts,tsx,css}'], {
    query: '?raw',
    import: 'default',
});

/** Each example's info, fetched when it's asked for. */
const INFOS = import.meta.glob<ProjectInfo>(['../../examples/*/example.ts', '../../book/*/example.ts'], { import: 'example' });
