import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { PageKind } from '../protocol.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** This package's own folder. */
export const PACKAGE_DIR = resolve(import.meta.dirname, '..', '..');

/**
 * The browser's facts, which every machine's must match. The calibration
 * images check the same environment, so both belong to the harness, not to
 * the code it tests.
 */
export const ENVIRONMENT_FILE = join(PACKAGE_DIR, 'visual-environment.json');

/** The root of the repository that the tests run in. */
export const REPO_ROOT = findRepoRoot(process.cwd());

/** Where a failing actual image and its diff are written, mirroring the repository. */
export const OUT_DIR = join(REPO_ROOT, '.vitest', 'vsnap');

/** The cache of the references that passed their checks, with each one's size and time, so that a reference isn't decoded again until it changes. */
export const CHECK_CACHE_FILE = join(OUT_DIR, 'reference-checks.json');

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns the folder that holds the reference images of one kind of page's calibration set. */
export function findCalibrationDir(pageKind: PageKind): string {
    return join(PACKAGE_DIR, 'src', 'browser', 'calibration-images', pageKind);
}

/**
 * Returns where a failing image's actual image and diff go, from its
 * reference's path, without `.png`. The output folder mirrors the
 * repository. A reference outside the repository, or on another drive,
 * goes under `outside/`, by its absolute path without the drive's colon.
 */
export function toOutputBase(file: string, folders: { readonly repo: string; readonly out: string } = { repo: REPO_ROOT, out: OUT_DIR }): string {
    const inRepo = relative(folders.repo, file);
    const isOutside = isAbsolute(inRepo) || /^\.\.([\\/]|$)/.test(inRepo);
    const path = isOutside ? join('outside', resolve(file).replace(/^([A-Za-z]):/, '$1')) : inRepo;
    return join(folders.out, path).replace(/\.png$/, '');
}

/**
 * Converts a path to the form that messages show: relative to the folder
 * that Vitest runs in, with forward slashes. That way, a terminal can open
 * it, and a command that a message suggests runs where Vitest did.
 */
export function toDisplayPath(file: string): string {
    // The folder itself shows as '.', not as nothing.
    return relative(process.cwd(), file).replaceAll('\\', '/') || '.';
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

/**
 * Returns a path no longer than `room`, if it can: its middle folders give
 * way to `…`, from the start's side, so that its first folder and as much of
 * its end as fits are kept, such as `src/…/visual-tests/hud-view.test.tsx`.
 * A path that is too long even as `…/` and its file name is returned so.
 */
export function shortenPath(path: string, room: number): string {
    if (path.length <= room) return path;
    const parts = path.split('/');
    for (let kept = parts.length - 2; kept >= 1; kept--) {
        const shortened = `${parts[0]}/…/${parts.slice(-kept).join('/')}`;
        if (shortened.length <= room) return shortened;
    }
    return `…/${parts[parts.length - 1]}`;
}
