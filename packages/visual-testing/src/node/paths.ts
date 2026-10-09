import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { VisualKind } from '../protocol';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** This package's own folder. */
export const PACKAGE_DIR = resolve(import.meta.dirname, '..', '..');

/**
 * The browser's facts, which every machine's must match. The calibration
 * pictures pin the same environment, so both belong to the harness, not to
 * the code it tests.
 */
export const ENVIRONMENT_FILE = join(PACKAGE_DIR, 'visual-environment.json');

/**
 * The root of the repository that the tests run in. Paths in messages are
 * relative to it, so that an editor can open them.
 */
export const REPO_ROOT = findRepoRoot(process.cwd());

/** Where a failing picture's actual picture and diff are written, mirroring the repository. */
export const OUT_DIR = join(REPO_ROOT, '.vitest', 'visual');

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns the folder that holds one kind of page's calibration pictures. */
export function findCalibrationDir(kind: VisualKind): string {
    return join(PACKAGE_DIR, 'src', 'browser', '__screenshots__', `calibration-${kind}`);
}

/** Converts a path to the form that messages show: relative to the repository, with forward slashes. */
export function toDisplayPath(file: string): string {
    return relative(REPO_ROOT, file).replaceAll('\\', '/');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Returns the nearest folder, from `start` upwards, that holds `.git`. In a
 * worktree, `.git` is a file rather than a folder, which works the same. If
 * there is none, it returns `start`.
 */
function findRepoRoot(start: string): string {
    for (let dir = resolve(start); ; dir = dirname(dir)) {
        if (existsSync(join(dir, '.git'))) return dir;
        if (dirname(dir) === dir) return resolve(start);
    }
}
