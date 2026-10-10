/**
 * Where a project keeps its visual test files and their reference images.
 * The two are set by the `include` and `referencePath` options, which are
 * checked once, when the config loads. Every path here is relative to the
 * project's root, which is the folder that holds `vitest.visual.config.ts`,
 * and uses forward slashes on every system.
 */

import { isAbsolute, join, posix, relative } from 'node:path';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a project keeps its visual test files and their reference images. */
export interface VisualLayout {
    /** The project's root, as an absolute path. */
    readonly root: string;
    /** Globs for the visual test files, relative to the root. */
    readonly include: readonly string[];
    /** The template for each reference image's path, relative to the root. */
    readonly referencePath: string;
}

/** The folder and file-name pattern that one test file's reference images match. */
export interface ReferencePattern {
    /** The folder, as an absolute path. */
    readonly dir: string;
    /** The part of each file name before the image name. */
    readonly prefix: string;
    /** The part of each file name after the image name, ending in `.png`. */
    readonly suffix: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** By default, visual test files are the `*.visual.ts` and `*.visual.tsx` files under `src/`. */
export const DEFAULT_INCLUDE: readonly string[] = ['src/**/*.visual.{ts,tsx}'];

/** By default, a test file's reference images are in `__references__/<test file name>/`, beside it. */
export const DEFAULT_REFERENCE_PATH = '{testFileDir}/__references__/{testFileName}/{imageName}.png';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Creates a layout, after checking its reference path. Throws an error
 * that says what is wrong with the template.
 */
export function createLayout(options: { readonly root: string; readonly include?: readonly string[]; readonly referencePath?: string }): VisualLayout {
    const referencePath = options.referencePath ?? DEFAULT_REFERENCE_PATH;
    const problem = checkReferencePath(referencePath);
    if (problem !== undefined) throw new Error(`The visual tests' referencePath '${referencePath}' ${problem}.`);
    return { root: options.root, include: options.include ?? DEFAULT_INCLUDE, referencePath };
}

/**
 * Returns what is wrong with a reference path template, or undefined if
 * nothing is. A template may use only the known variables. It must have
 * `{imageName}` exactly once, in its file name, which ends in `.png`. That
 * way, one listing of one folder finds every reference of a test file. It
 * must also stay inside the project's root.
 */
export function checkReferencePath(template: string): string | undefined {
    for (const match of template.matchAll(/\{([^}]*)\}/g)) {
        if (!VARIABLES.includes(match[1])) {
            return `uses the unknown variable {${match[1]}}. The variables are ${VARIABLES.map((v) => `{${v}}`).join(', ')}`;
        }
    }
    const segments = template.split('/');
    const fileName = segments[segments.length - 1];
    if (template.split('{imageName}').length !== 2 || !fileName.includes('{imageName}')) {
        return 'must have {imageName} exactly once, in its file name';
    }
    if (!fileName.endsWith('.png')) return 'must end in .png';
    if (isAbsolute(template) || /^[A-Za-z]:/.test(template) || segments.includes('..')) {
        return 'must be relative to the project\'s root, and stay inside it';
    }
    return undefined;
}

/** Returns the absolute path of a test's reference image. */
export function resolveReferencePath(layout: VisualLayout, testFile: string, imageName: string): string {
    return join(layout.root, fillTemplate(layout, testFile).replace('{imageName}', imageName));
}

/** Returns the folder and file-name pattern that a test file's reference images match. */
export function resolveReferencePattern(layout: VisualLayout, testFile: string): ReferencePattern {
    const path = fillTemplate(layout, testFile);
    const slash = path.lastIndexOf('/');
    const [prefix, suffix] = path.slice(slash + 1).split('{imageName}');
    return { dir: join(layout.root, path.slice(0, Math.max(slash, 0))), prefix, suffix };
}

/** Returns the image name in a reference's file name, or undefined if the file name doesn't match the pattern. */
export function matchReferenceName(pattern: ReferencePattern, fileName: string): string | undefined {
    const isMatch = fileName.length > pattern.prefix.length + pattern.suffix.length
        && fileName.startsWith(pattern.prefix)
        && fileName.endsWith(pattern.suffix);
    return isMatch ? fileName.slice(pattern.prefix.length, fileName.length - pattern.suffix.length) : undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VARIABLES = ['testFileDir', 'testFileName', 'testFilePath', 'imageName'];

/** Fills in every variable but `{imageName}`, giving a path relative to the root. */
function fillTemplate(layout: VisualLayout, testFile: string): string {
    const testFilePath = relative(layout.root, testFile).replaceAll('\\', '/');
    const testFileDir = posix.dirname(testFilePath);
    const testFileName = testFilePath.slice(testFilePath.lastIndexOf('/') + 1);
    return layout.referencePath
        .replaceAll('{testFilePath}', testFilePath)
        .replaceAll('{testFileDir}', testFileDir)
        .replaceAll('{testFileName}', testFileName)
        // A test file at the root has the folder '.', which leaves './' at
        // the start of the path.
        .replace(/^\.\//, '');
}
