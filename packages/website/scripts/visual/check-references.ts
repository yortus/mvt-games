/**
 * Decodes every reference picture and checks that its pixels match the
 * hash it carries. A visual run compares hashes only, read from each
 * file's first bytes, so this is what catches a reference edited by hand
 * (or by a tool) without its hash. CI runs it weekly.
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
    console.error('Rewrite them from their tests with npm run test:visual:update, after deleting the files.');
    process.exit(1);
}
console.log(`${references.length} references, every one's pixels matching its hash.`);
