import { describe, expect, it } from 'vitest';
import { findProjectLocation } from './find-location';

const PATHS = new Set(['main.ts', 'models/ball-model.ts', 'views/ball-view.tsx']);

describe('findProjectLocation', () => {
    it('reads Chromium\'s stack frames', () => {
        const stack = 'Error: boom\n    at Object.update (models/ball-model.ts:30:38)\n    at f (http://localhost/libraries/entries/playground.ts:44:12)';
        expect(findProjectLocation('boom', stack, PATHS)).toEqual({ path: 'models/ball-model.ts', line: 30, column: 38 });
    });

    it('reads Firefox\'s and WebKit\'s stack frames', () => {
        const stack = 'update@views/ball-view.tsx:12:5\ntick@http://localhost/assets/x.js:1:700';
        expect(findProjectLocation('boom', stack, PATHS)).toEqual({ path: 'views/ball-view.tsx', line: 12, column: 5 });
    });

    it('passes over frames outside the project, whatever their file is called', () => {
        const stack = 'at f (http://localhost/src/main.ts:3:1)\n    at g (main.ts:9:2)';
        expect(findProjectLocation('boom', stack, PATHS)).toEqual({ path: 'main.ts', line: 9, column: 2 });
    });

    it('takes a loop guard\'s place from its message first', () => {
        const message = 'A loop at main.ts:12 ran for more than a second without a frame.';
        const stack = 'at __pgCheck (main.ts:1:60)';
        expect(findProjectLocation(message, stack, PATHS)).toEqual({ path: 'main.ts', line: 12, column: undefined });
    });

    it('reads a file named in the import map\'s way', () => {
        expect(findProjectLocation('', 'at project:main.ts:4:1', PATHS)).toEqual({ path: 'main.ts', line: 4, column: 1 });
    });

    it('finds nothing when no frame is in the project', () => {
        expect(findProjectLocation('boom', 'at f (http://x/y.js:1:1)', PATHS)).toBeUndefined();
    });
});
