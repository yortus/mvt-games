#!/usr/bin/env node
// The `visual-tests` command. It runs the visual tests of the package in the
// current folder, as `src/node/cli/visual-tests.ts` describes.
// `visual-tests check-references` instead checks that every reference's
// pixels match the hash it carries. The command is TypeScript, so tsx loads
// it.

import process from 'node:process';
import { register } from 'tsx/esm/api';

register();
if (process.argv[2] === 'check-references') await import('../src/node/cli/check-references.ts');
else await import('../src/node/cli/visual-tests.ts');
