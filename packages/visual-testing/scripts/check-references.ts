/**
 * Decodes every reference picture and checks that its pixels match the
 * hash it carries. A visual run compares only the hashes, which it reads
 * from each file's first bytes. So this script is what catches a reference
 * whose pixels were edited, by hand or by a tool, without its hash. CI runs
 * it weekly.
 *
 *   npm run test:visual:check-references
 */

import { relative } from 'node:path';
import { checkReference, findReferences } from '../src/node';

/** The package whose references are checked. npm runs a package's scripts in its folder. */
const ROOT = process.cwd();

const references = findReferences(ROOT);
const problems: string[] = [];
for (const { file } of references) {
    const problem = checkReference(file);
    if (problem !== undefined) problems.push(`  ${relative(ROOT, file).replaceAll('\\', '/')}: ${problem}`);
}
if (problems.length > 0) {
    console.error(`${problems.length} of ${references.length} references do not match their hashes:\n${problems.join('\n')}`);
    console.error('Delete these files, then rewrite them from their tests with npm run test:visual:update.');
    process.exit(1);
}
console.log(`All ${references.length} references have pixels that match their hashes.`);
