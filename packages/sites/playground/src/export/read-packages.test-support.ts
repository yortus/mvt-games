// What the export tests share: the packages a project exports with, as
// installed in the repo.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PackageVersion } from './export-project';

/** The repo's root, whose `node_modules` an exported project's imports resolve to here. */
export const ROOT = resolve(import.meta.dirname, '../../../../..');

/** Each package's version and whether it is private, from its package.json in the repo's node_modules. */
export function readPackages(names: readonly string[]): Record<string, PackageVersion> {
    const packages: Record<string, PackageVersion> = {};
    for (const name of names) {
        const json = JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { version: string; private?: boolean };
        packages[name] = { version: json.version, isPrivate: json.private === true };
    }
    return packages;
}
