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

/** Every example, in the order the playground lists them. */
export const EXAMPLES: readonly Example[] = readExamples();

/** The example with this id, if there is one. */
export function findExample(id: string): Example | undefined {
    return EXAMPLES.find((example) => example.id === id);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each example's own description, in its `example.ts`, which is not part of the project. */
interface ExampleInfo {
    readonly name: string;
    readonly description: string;
}

function readExamples(): Example[] {
    // Every file of every example, as text, by its path from this file
    const texts = import.meta.glob<string>('../../examples/*/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true });
    const infos = import.meta.glob<ExampleInfo>('../../examples/*/example.ts', { import: 'example', eager: true });
    const examples: Example[] = [];
    for (const [infoPath, info] of Object.entries(infos)) {
        const folder = infoPath.slice(0, -'example.ts'.length);
        const files: ProjectFile[] = [];
        for (const [path, text] of Object.entries(texts)) {
            if (!path.startsWith(folder) || path === infoPath) continue;
            files.push({ path: path.slice(folder.length), text });
        }
        files.sort((a, b) => a.path.localeCompare(b.path));
        examples.push({ id: folder.split('/').at(-2) ?? folder, ...info, files });
    }
    return examples.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

function rank(id: string): number {
    const index = ORDER.indexOf(id);
    return index === -1 ? ORDER.length : index;
}
