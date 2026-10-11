#!/usr/bin/env node
// The `vsnap` command. It runs the visual tests of the project in the current
// folder, as `src/node/cli/vsnap.ts` describes. `vsnap check-references`
// instead checks that every reference image's pixels match the hash it
// carries. The command is TypeScript, so tsx loads it.

import process from 'node:process';
import { register } from 'tsx/esm/api';

register();
if (process.argv[2] === 'check-references') await import('../src/node/cli/check-references.ts');
else await import('../src/node/cli/vsnap.ts');
