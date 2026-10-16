import { describe, expect, it } from 'vitest';
import { toUpdateCommand } from './update-command';

const testFile = 'src/hud/visual-tests/hud-view.test.tsx';

describe('toUpdateCommand', () => {
    it('picks the test by its full name, anchored, so that only its image is accepted', () => {
        expect(toUpdateCommand({ testFile, testName: 'after a game over > with a new best' }))
            .toBe('`npx vitest run src/hud/visual-tests/hud-view.test.tsx -t "^after a game over > with a new best$" -u`');
    });

    it("escapes the name's regular expression characters", () => {
        expect(toUpdateCommand({ testFile, testName: 'the score (x2) at 1.5s?' }))
            .toBe('`npx vitest run src/hud/visual-tests/hud-view.test.tsx -t "^the score \\(x2\\) at 1\\.5s\\?$" -u`');
    });

    it('gives the file alone for a name that a shell would change in double quotes', () => {
        for (const testName of ['costs $5', 'say "hi"', 'wow!', '100% full', 'a\\b', 'two\nlines']) {
            expect(toUpdateCommand({ testFile, testName })).toBe('`npx vitest run src/hud/visual-tests/hud-view.test.tsx -u`');
        }
    });

    it('names Vitest alone without a test file', () => {
        expect(toUpdateCommand({ testFile: undefined, testName: 'at the start' })).toBe('Vitest with -u');
    });
});
