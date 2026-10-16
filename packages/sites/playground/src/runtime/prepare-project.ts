import { transform } from 'sucrase';
import { init as initModuleLexer } from 'es-module-lexer';
import type { RendererKind } from '../project-api';
import { addLoopGuards } from './loop-guards';
import { rewriteImports } from './module-imports';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One file of a project, by its path from the project's root, such as `models/ball-model.ts`. */
export interface ProjectFile {
    readonly path: string;
    readonly text: string;
}

/** Something wrong with a project that stops it running, and where it is. */
export interface Problem {
    readonly path: string;
    /** The line, counting from 1, where it is known. */
    readonly line?: number;
    readonly message: string;
}

/** A file made ready to run: JavaScript, with its imports rewritten to names in the sandbox's import map. */
export interface PreparedModule {
    readonly path: string;
    readonly code: string;
}

export interface PreparedProject {
    readonly modules: readonly PreparedModule[];
    /** Where each guarded loop is, as `path:line`, by the number its guard passes. */
    readonly loops: readonly string[];
    readonly problems: readonly Problem[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PrepareProjectOptions {
    readonly files: readonly ProjectFile[];
    /** Whether to add a guard to every loop that may never end. The default is true. */
    readonly guardLoops?: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The path of the file every project starts from. */
export const MAIN_PATH = 'main.ts';

/** The name the sandbox's import map gives a project file. */
export function toModuleName(path: string): string {
    return `project:${path}`;
}

/**
 * Makes a project's files ready to run in the sandbox. Each TypeScript file
 * is transpiled, with its loops guarded, its imports rewritten and its path
 * named for stack traces. Each CSS file becomes a module that adds its
 * styles. Returns the problems that stop the project running, such as a
 * syntax error or an import of a file that does not exist.
 */
export async function prepareProject(options: PrepareProjectOptions): Promise<PreparedProject> {
    await initModuleLexer;
    const { files } = options;
    const guardLoops = options.guardLoops ?? true;
    const renderer = findRenderer(files.find((f) => f.path === MAIN_PATH)?.text ?? '');
    const paths = new Set(files.map((f) => f.path));
    const modules: PreparedModule[] = [];
    const loops: string[] = [];
    const problems: Problem[] = [];

    if (!paths.has(MAIN_PATH)) problems.push({ path: MAIN_PATH, message: 'A project needs a main.ts, which exports its `project`.' });

    for (const file of files) {
        if (file.path.endsWith('.css')) {
            modules.push({ path: file.path, code: toStyleModule(file) });
            continue;
        }
        if (!/\.tsx?$/.test(file.path)) continue;
        let code: string;
        try {
            code = transpile(file, renderer);
        }
        catch (error) {
            problems.push(toSyntaxProblem(file.path, error));
            continue;
        }
        if (guardLoops && !NO_GUARDS_COMMENT.test(file.text.slice(0, 500))) {
            code = addLoopGuards({ code, path: file.path, loops });
        }
        const rewritten = rewriteImports({ code, path: file.path, paths, toModuleName });
        problems.push(...rewritten.problems);
        modules.push({ path: file.path, code: `${rewritten.code}\n//# sourceURL=${file.path}` });
    }
    return { modules, loops, problems };
}

/** The renderer a project's `main.ts` uses, from the `define` function it calls. Pixi, if it cannot tell. */
export function findRenderer(mainText: string): RendererKind {
    const match = /\bdefine(Pixi|Html|Three)Project\b/.exec(mainText);
    return match === null ? 'pixi' : (match[1].toLowerCase() as RendererKind);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A comment near the top of a file that turns its loop guards off: `// no-loop-guards`. */
const NO_GUARDS_COMMENT = /^\s*\/\/\s*no-loop-guards\b/m;

/**
 * Strips the types from a file, and in a `.tsx` file compiles JSX with the
 * automatic runtime. Its JSX comes from the source its pragma names, or from
 * the project's renderer. Sucrase keeps every line where it was, so a line
 * in an error is a line in the editor.
 */
function transpile(file: ProjectFile, renderer: RendererKind): string {
    const isTsx = file.path.endsWith('.tsx');
    const pragma = /@jsxImportSource\s+(\S+)/.exec(file.text.slice(0, 500));
    return transform(file.text, {
        transforms: isTsx ? ['typescript', 'jsx'] : ['typescript'],
        jsxRuntime: 'automatic',
        jsxImportSource: pragma?.[1] ?? `@mvtjs/${renderer}`,
        production: true,
        disableESTransforms: true,
        filePath: file.path,
    }).code;
}

/** A module that adds a CSS file's styles to the sandbox's page. */
function toStyleModule(file: ProjectFile): string {
    const css = JSON.stringify(file.text);
    return `const style = document.createElement('style');\nstyle.textContent = ${css};\ndocument.head.append(style);\n//# sourceURL=${file.path}`;
}

function toSyntaxProblem(path: string, error: unknown): Problem {
    const message = error instanceof Error ? error.message : String(error);
    // Sucrase ends its message with the place, as in "(12:4)"
    const place = /\((\d+):\d+\)\s*$/.exec(message);
    return {
        path,
        line: place === null ? undefined : Number(place[1]),
        // Sucrase's message names the file and the place, which the problem holds already
        message: message.replace(/\s*\(\d+:\d+\)\s*$/, '').replace(/^Error transforming [^:]*: /, ''),
    };
}
