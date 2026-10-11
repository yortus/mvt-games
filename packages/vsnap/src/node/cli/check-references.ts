/**
 * Decodes every reference image and checks that its pixels match the
 * hash it carries. A visual run compares only the hashes, which it reads
 * from each file's first bytes. So this script is what catches a reference
 * whose pixels were edited, by hand or by a tool, without its hash. CI runs
 * it weekly.
 *
 *   vsnap check-references
 *
 * It checks every PNG under the project that carries a hash. It also checks
 * every PNG where a current test's reference could be, by the project's
 * `referencePath`. That way, it finds a reference that lost its hash. It
 * reads the layout from the project's `vsnap.config.ts`.
 */

import { join, relative } from 'node:path';
import { loadConfig } from '../config-file';
import { createLayout } from '../layout';
import { checkReference, findReferenceCandidates, findReferences, toFileKey } from '../references';
import { findVisualTestFiles } from '../test-files';

/** The project whose references are checked. npm runs a package's scripts in its folder. */
const ROOT = process.cwd();

const config = await loadConfig(ROOT);
const layout = createLayout({ root: ROOT, include: config.include, referencePath: config.referencePath });
const files = new Map<string, string>();
for (const { file } of findReferences(ROOT)) files.set(toFileKey(file), file);
const testFiles = findVisualTestFiles(layout);
for (const testFile of [...testFiles.canvas, ...testFiles.html]) {
    for (const file of findReferenceCandidates(layout, join(ROOT, testFile))) files.set(toFileKey(file), file);
}

const problems: string[] = [];
for (const file of files.values()) {
    const problem = checkReference(file);
    if (problem !== undefined) problems.push(`  ${relative(ROOT, file).replaceAll('\\', '/')}: ${problem}`);
}
if (problems.length > 0) {
    console.error(`${problems.length} of ${files.size} references do not match their hashes:\n${problems.join('\n')}`);
    console.error('Delete these files, then rewrite them from their tests with npx vsnap --update.');
    process.exit(1);
}
console.log(`All ${files.size} references have pixels that match their hashes.`);
