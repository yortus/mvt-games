import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { findVisualTests, parseTestFile } from '@mvtjs/view-preview/find-visual-tests';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A test to preview, from a test file. A pose written in place is found by
 * the line it starts on, which works for a pose in a loop or written for
 * `.each` too. A pose passed by name is found by its test's name, if it's a
 * plain string. With neither, the preview opens the file and leaves you to
 * pick.
 */
export interface PreviewTarget {
    /** The test file's path. */
    readonly file: string;
    readonly line?: number;
    readonly name?: string;
}

/** A test to preview, and where its call starts in the file's code, for the lens above it. */
export interface PlacedTarget {
    readonly offset: number;
    readonly target: PreviewTarget;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns a test to preview for each `canvasTest` and `htmlTest` call in a test file's code. */
export function listPreviewTargets(options: { readonly code: string; readonly fileName: string }): readonly PlacedTarget[] {
    const { fileName } = options;
    const source = parseTestFile(options);
    return findVisualTests(source).map((test) => ({
        offset: test.call.getStart(source),
        target: test.pose !== undefined ? { file: fileName, line: test.line } : test.name !== undefined ? { file: fileName, name: test.name } : { file: fileName },
    }));
}

/** Returns the folder of the package a file belongs to. That's the nearest folder above it with a `package.json`. */
export function findPackageRoot(file: string): string | undefined {
    for (let dir = dirname(file); ; dir = dirname(dir)) {
        if (existsSync(join(dir, 'package.json'))) return dir;
        if (dirname(dir) === dir) return undefined;
    }
}

/**
 * Returns the preview server's script, as the package's `node_modules`
 * reaches it, or `undefined` if `@mvtjs/view-preview` isn't installed where
 * the package can see it.
 */
export function findServerScript(packageRoot: string): string | undefined {
    for (let dir = packageRoot; ; dir = dirname(dir)) {
        const script = join(dir, 'node_modules', '@mvtjs', 'view-preview', 'src', 'node', 'serve.ts');
        if (existsSync(script)) return script;
        if (dirname(dir) === dir) return undefined;
    }
}

/**
 * Returns the part of the preview page's address after the `#` that picks a
 * test, or `undefined` for a file outside the package's `src/` folder, which
 * the page doesn't list.
 */
export function toPageHash(options: { readonly packageRoot: string; readonly target: PreviewTarget }): string | undefined {
    const { packageRoot, target } = options;
    const path = relative(join(packageRoot, 'src'), target.file).replaceAll('\\', '/');
    if (path.startsWith('../') || path.includes(':')) return undefined;
    const test = target.line !== undefined ? `@${target.line}` : target.name !== undefined ? encodeURIComponent(target.name) : '';
    return `${encodeURIComponent(path)}::${test}`;
}
