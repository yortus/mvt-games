/**
 * Decodes every reference picture and checks that its pixels match the
 * hash it carries. A visual run compares only the hashes, which it reads
 * from each file's first bytes. So this script is what catches a reference
 * whose pixels were edited, by hand or by a tool, without its hash. CI runs
 * it weekly.
 *
 *   npm run test:visual:check-references
 */

import { relative, resolve } from 'node:path';
import { checkReference, findReferences } from './references';

const WEBSITE = resolve(import.meta.dirname, '..', '..');

const references = findReferences(resolve(WEBSITE, 'src'));
const problems: string[] = [];
for (const { file } of references) {
    const problem = checkReference(file);
    if (problem !== undefined) problems.push(`  ${relative(WEBSITE, file).replaceAll('\\', '/')}: ${problem}`);
}
if (problems.length > 0) {
    console.error(`${problems.length} of ${references.length} references do not match their hashes:\n${problems.join('\n')}`);
    console.error('Delete these files, then rewrite them from their tests with npm run test:visual:update.');
    process.exit(1);
}
console.log(`All ${references.length} references have pixels that match their hashes.`);
