import { describe, expect, it } from 'vitest';
import { pointAtDeclaration } from './declaration';

const OWN = 'http://localhost:63315/node_modules/v-snap/lib/';

/** The stack of a `canvasTest` call in a test file, as the browser writes it. */
const DECLARATION = [
    'Error',
    `    at create (${OWN}browser/visual-test.js:150:29)`,
    '    at http://localhost:63315/src/visual-tests/hud.test.ts?v=1:12:9',
    '    at collect (http://localhost:63315/node_modules/.vite/vitest/abc/deps/plugins.js?v=2:5191:52)',
].join('\n');

function createError(message: string, frames: readonly string[]): Error {
    const error = new Error(message);
    error.stack = [`Error: ${message}`, ...frames].join('\n');
    return error;
}

describe('pointAtDeclaration', () => {
    it("gives an error that v-snap threw the declaration's frames, without v-snap's or the runner's", () => {
        const error = createError("Image 'Hud' differs", [`    at finishTest (${OWN}browser/visual-test.js:346:11)`]);
        const pointed = pointAtDeclaration(error, { declaration: DECLARATION, ownBase: OWN });
        expect(pointed).toBe(error);
        expect(error.stack).toBe("Error: Image 'Hud' differs\n    at http://localhost:63315/src/visual-tests/hud.test.ts?v=1:12:9");
    });

    it("points an error from one of v-snap's browser commands, which Vitest passes to the page, at the declaration", () => {
        const frames = [
            '    at CommandsManager.triggerCommand (http://localhost:63315/__vitest_browser__/tester-C2LTsndn.js:1900:68)',
            '    at Object.judgeVisualMismatch (http://localhost:63315/@id/__x00__vitest/browser:15:78)',
            `    at ${OWN}browser/visual-test.js:265:28`,
        ];
        const error = createError('The reference image is a Git LFS pointer', frames);
        pointAtDeclaration(error, { declaration: DECLARATION, ownBase: OWN });
        expect(error.stack).toBe('Error: The reference image is a Git LFS pointer\n    at http://localhost:63315/src/visual-tests/hud.test.ts?v=1:12:9');
    });

    it('leaves an error that the pose threw as it is, since it points at the pose', () => {
        const frames = ['    at pose (http://localhost:63315/src/visual-tests/hud.test.ts?v=1:14:11)', `    at run (${OWN}browser/visual-test.js:260:5)`];
        const error = createError('The score is wrong', frames);
        const stack = error.stack;
        pointAtDeclaration(error, { declaration: DECLARATION, ownBase: OWN });
        expect(error.stack).toBe(stack);
    });

    it('leaves anything that is not an error, and an error with no declaration to point at', () => {
        expect(pointAtDeclaration('a string', { declaration: DECLARATION, ownBase: OWN })).toBe('a string');
        const error = createError('Blank', [`    at check (${OWN}browser/visual-test.js:1:1)`]);
        const stack = error.stack;
        pointAtDeclaration(error, { declaration: undefined, ownBase: OWN });
        expect(error.stack).toBe(stack);
    });
});
