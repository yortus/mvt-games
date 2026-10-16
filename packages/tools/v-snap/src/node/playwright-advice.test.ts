import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { advisePlaywright, findPlaywright } from './playwright-advice.ts';

const dir = join(process.cwd(), 'node_modules', 'playwright');

describe('advisePlaywright', () => {
    it('names the version that v-snap supports and the one that the run uses, with the fix', () => {
        const advice = advisePlaywright({ vsnapVersion: '0.3.0', range: '~1.64.1', version: '1.63.0', dir });
        expect(advice).toBe(
            'v-snap 0.3.0 supports Playwright 1.64 (~1.64.1), but this run uses Playwright 1.63.0, from node_modules/playwright. '
            + 'Install the version that v-snap supports, as with npm install --save-dev playwright@~1.64.1, and check that the project has only one copy of it (npm ls playwright).',
        );
    });

    it('looks elsewhere when the run uses a version that v-snap supports', () => {
        const advice = advisePlaywright({ vsnapVersion: '0.3.0', range: '~1.64.1', version: '1.64.2', dir });
        expect(advice).toContain('this run uses Playwright 1.64.2, from node_modules/playwright, which it supports, so the browser comes from somewhere else.');
        expect(advice).toContain('PLAYWRIGHT_BROWSERS_PATH');
    });

    it('says so when it can\'t find the Playwright that the run uses', () => {
        expect(advisePlaywright({ vsnapVersion: '0.3.0', range: '~1.64.1' })).toContain('couldn\'t find the Playwright that this run uses');
    });
});

describe('findPlaywright', () => {
    it('finds the Playwright that Vitest\'s provider imports, and the range that v-snap supports', () => {
        const facts = findPlaywright();
        expect(facts.range).toMatch(/^~\d+\.\d+\.\d+$/);
        expect(facts.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(facts.dir).toBeDefined();
    });
});
