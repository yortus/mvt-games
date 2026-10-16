import { parse } from 'es-module-lexer';
import { isLibrary, LIBRARIES } from '../../libraries';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RewriteImportsOptions {
    /** A module's JavaScript. */
    readonly code: string;
    /** The module's own path, which relative imports start from. */
    readonly path: string;
    /** The paths of every file in the project. */
    readonly paths: ReadonlySet<string>;
    /** The name the sandbox's import map gives a project file. */
    readonly toModuleName: (path: string) => string;
}

export interface RewrittenImports {
    readonly code: string;
    readonly problems: readonly { readonly path: string; readonly message: string }[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Rewrites each import of a project file, static or dynamic, to the name
 * the sandbox's import map gives it. A relative specifier is resolved as
 * TypeScript's bundler resolution does: with or without its extension, and
 * a folder to its `index.ts`. A library's specifier is left as it is.
 * Returns a problem for a file that does not exist, and for a package the
 * playground does not provide.
 */
export function rewriteImports(options: RewriteImportsOptions): RewrittenImports {
    const { path, paths, toModuleName } = options;
    const [imports] = parse(options.code);
    const problems: { path: string; message: string }[] = [];
    let code = options.code;
    // From the end, so the positions before each edit stay valid
    for (let i = imports.length - 1; i >= 0; i--) {
        const found = imports[i];
        const specifier = found.n;
        if (specifier === undefined || isLibrary(specifier)) continue;
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
            problems.push({ path, message: `'${specifier}' cannot be imported. The playground provides ${LIBRARIES.join(', ')}.` });
            continue;
        }
        const target = resolveRelative(path, specifier, paths);
        if (target === undefined) {
            problems.push({ path, message: `Cannot find '${specifier}', imported from ${path}.` });
            continue;
        }
        // A dynamic import's range takes in its quotes, and a static one's does not
        const replacement = found.d > -1 ? JSON.stringify(toModuleName(target)) : toModuleName(target);
        code = code.slice(0, found.s) + replacement + code.slice(found.e);
    }
    return { code, problems };
}

/** The project file a relative specifier names, if there is one. */
export function resolveRelative(from: string, specifier: string, paths: ReadonlySet<string>): string | undefined {
    const parts = from.split('/').slice(0, -1);
    for (const part of specifier.split('/')) {
        if (part === '.' || part === '') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }
    const base = parts.join('/');
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
    return candidates.find((candidate) => paths.has(candidate));
}
