import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PACKAGE_DIR, toDisplayPath } from './paths.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The Playwright that v-snap supports, and the one that this run uses. */
export interface PlaywrightFacts {
    readonly vsnapVersion: string;
    /** v-snap's peer range for Playwright, such as `~1.64.1`. */
    readonly range: string;
    /** The version of the Playwright that this run uses, if it could be found. */
    readonly version?: string;
    /** The folder of the Playwright that this run uses, if it could be found. */
    readonly dir?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the Playwright that v-snap supports, from its `package.json`, and
 * the one that this run uses, which is the one that Vitest's Playwright
 * provider imports.
 */
export function findPlaywright(): PlaywrightFacts {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as { version: string; peerDependencies?: Record<string, string> };
    const facts = { vsnapVersion: manifest.version, range: manifest.peerDependencies?.playwright ?? 'unknown' };
    try {
        const fromProvider = createRequire(createRequire(join(PACKAGE_DIR, 'package.json')).resolve('@vitest/browser-playwright'));
        const file = fromProvider.resolve('playwright/package.json');
        const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version: string };
        return { ...facts, version, dir: dirname(file) };
    }
    catch {
        return facts;
    }
}

/**
 * Returns what to do about a browser that isn't the reference environment's:
 * which Playwright v-snap supports, which one this run uses and where it is,
 * and how to fix it. Each Playwright minor version draws with its own build
 * of Chromium, so a version of the wrong minor is the usual cause.
 */
export function advisePlaywright(facts: PlaywrightFacts): string {
    const { vsnapVersion, range, version, dir } = facts;
    const minor = /(\d+\.\d+)/.exec(range)?.[1];
    const supported = minor === undefined ? `Playwright ${range}` : `Playwright ${minor} (${range})`;
    if (version === undefined || dir === undefined) {
        return `v-snap ${vsnapVersion} supports ${supported}, and couldn't find the Playwright that this run uses. Install the version that v-snap supports, as with npm install --save-dev playwright@${range}.`;
    }
    const uses = `this run uses Playwright ${version}, from ${toDisplayPath(dir)}`;
    if (minor === undefined || !version.startsWith(`${minor}.`)) {
        return `v-snap ${vsnapVersion} supports ${supported}, but ${uses}. Install the version that v-snap supports, as with npm install --save-dev playwright@${range}, and check that the project has only one copy of it (npm ls playwright).`;
    }
    return `v-snap ${vsnapVersion} supports ${supported}, and ${uses}, which it supports, so the browser comes from somewhere else. `
        + 'Check that the project has only one copy of Playwright (npm ls playwright), and that PLAYWRIGHT_BROWSERS_PATH, if it is set, holds this Playwright\'s browsers. '
        + 'If both are right, this Playwright release may draw with a newer browser than v-snap knows, so report it to v-snap.';
}
