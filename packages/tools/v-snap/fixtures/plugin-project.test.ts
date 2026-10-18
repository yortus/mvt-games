// The vsnap() plugin, end to end: each test runs Vitest on the fixture in
// plugin-project/, as a project would, and reads what it printed. The
// fixture's settings would break v-snap's projects if they reached them, so
// a visual test that passes shows that they didn't.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_INCLUDE } from 'v-snap/vitest';

const FIXTURE = join(import.meta.dirname, 'plugin-project');
const VITEST = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');

/** Runs Vitest on the fixture, and returns its exit code and what it printed. */
function runFixture(args: readonly string[]): { status: number | undefined; output: string } {
    // This run's own settings, which Vitest passes to its workers, stay out of the fixture's run.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST') && key !== 'TEST' && key !== 'NODE_ENV'));
    const run = spawnSync(process.execPath, [VITEST, 'run', '--root', FIXTURE, '--reporter=verbose', ...args], {
        encoding: 'utf8',
        env: { ...env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    return { status: run.status ?? undefined, output: `${run.stdout}${run.stderr}` };
}

const UNIT_TEST = 'src/sum.test.ts > runs in Node, after the unit setup';
const VISUAL_TEST = '|visual-canvas| src/visual-tests/dot.test.ts > a dot';

describe('the vsnap() plugin', { timeout: 120_000 }, () => {
    it("runs a flat config's unit tests in Node, as a project named unit, and the visual tests in v-snap's project", () => {
        const { status, output } = runFixture([]);
        expect(output).toContain(`✓ |unit| ${UNIT_TEST}`);
        expect(output).toContain(`✓ ${VISUAL_TEST}`);
        expect(output).not.toContain('|unit| src/visual-tests/');
        expect(output).not.toContain('(chromium)');
        expect(output).toContain('Test Files  2 passed (2)');
        expect(status).toBe(0);
    });

    it('runs the unit tests and the visual tests of a config that lists its projects, and leaves the visual tests out of its own', () => {
        const { status, output } = runFixture(['--config', 'vitest.projects.config.ts']);
        expect(output).toContain(`✓ |node| ${UNIT_TEST}`);
        expect(output).toContain(`✓ ${VISUAL_TEST}`);
        expect(output).toContain('Test Files  2 passed (2)');
        expect(status).toBe(0);
    });

    it('runs the unit tests alone with -p unit, and the visual tests alone with a filter on their paths', () => {
        const unit = runFixture(['-p', 'unit']);
        expect(unit.output).toContain(`✓ |unit| ${UNIT_TEST}`);
        expect(unit.output).not.toContain('visual-canvas');
        expect(unit.status).toBe(0);
        const visual = runFixture(['visual-tests/']);
        expect(visual.output).toContain(`✓ ${VISUAL_TEST}`);
        expect(visual.output).not.toContain('|unit|');
        expect(visual.status).toBe(0);
    });

    it('says to filter on the paths when a --project filter leaves out the project that adds the visual projects', () => {
        const { status, output } = runFixture(['-p', 'visual-*']);
        expect(output).toContain('v-snap: --project visual-* leaves out the visual tests.');
        expect(output).toContain(`v-snap finds visual test files with ${DEFAULT_INCLUDE.join(', ')}.`);
        expect(status).not.toBe(0);
    });
});
