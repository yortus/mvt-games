#!/usr/bin/env node
// Runs the visual tests of the package in the current folder, as
// `scripts/run.ts` describes. `visual-tests check-references` instead checks
// that every reference's pixels match the hash it carries. The scripts are
// TypeScript, so tsx loads them.

import process from 'node:process';
import { register } from 'tsx/esm/api';

register();
if (process.argv[2] === 'check-references') await import('../scripts/check-references.ts');
else await import('../scripts/run.ts');
