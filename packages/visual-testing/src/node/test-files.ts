import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { VisualKind } from '../protocol';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds a package's visual test files, which are the `*.visual.ts` and
 * `*.visual.tsx` files under its `src/`, and sorts them by the kind of test
 * that they declare. Canvas tests and HTML tests run in different kinds of
 * page, so each file goes to the Vitest project for its kind. Vitest gives
 * each project its files before any test code runs, so the declarations are
 * read from each file's text. Throws if a file declares both kinds, or
 * neither. Returns paths relative to the package's root, with forward
 * slashes, as Vitest's `include` takes them.
 */
export function findVisualTestFiles(root: string): Readonly<Record<VisualKind, readonly string[]>> {
    const files: Record<VisualKind, string[]> = { canvas: [], html: [] };
    for (const file of findFiles(join(root, 'src'))) {
        const text = readFileSync(file, 'utf8');
        const isCanvas = CANVAS_DECLARATION.test(text);
        const isHtml = HTML_DECLARATION.test(text);
        const path = relative(root, file).replaceAll('\\', '/');
        if (isCanvas && isHtml) {
            throw new Error(`${path} declares both canvas and HTML visual tests. The two kinds run in different pages, so split them into two files.`);
        }
        if (!isCanvas && !isHtml) {
            throw new Error(`${path} is named as a visual test file, but it declares no canvasVisualTest or htmlVisualTest.`);
        }
        files[isHtml ? 'html' : 'canvas'].push(path);
    }
    return files;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CANVAS_DECLARATION = /\bcanvasVisualTest\s*\(/;
const HTML_DECLARATION = /\bhtmlVisualTest\s*\(/;
const VISUAL_TEST_FILE = /\.visual\.tsx?$/;

/** Returns every visual test file under a folder, skipping installed packages and hidden folders. */
function findFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) found.push(...findFiles(path));
        }
        else if (VISUAL_TEST_FILE.test(entry.name)) found.push(path);
    }
    return found;
}
