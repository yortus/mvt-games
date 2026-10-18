// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView } from '@mvtjs/utils';
import '../element-mixin';
import { jsx } from './jsx-runtime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// In a file of its own, so that the runtime this file loads is a fresh one,
// which has never built an element, with nothing else sharing it. Vitest runs
// each file apart from the others, so the stubbed `Function` can't leak.
describe('@mvtjs/html JSX where new Function is blocked', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('builds and refreshes elements without ever calling it, and warns nothing', () => {
        // As a Content Security Policy without 'unsafe-eval' makes it
        let constructions = 0;
        vi.stubGlobal('Function', function Blocked() {
            constructions++;
            throw new EvalError('Refused to evaluate a string as JavaScript');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let text = 'a';

        // Enough elements that the shape takes a copy of the refresh code of its own
        const elements: HTMLElement[] = [];
        for (let i = 0; i < 20; i++) elements.push(jsx('div', { title: () => text }) as HTMLElement);
        for (const el of elements) refreshView(el);
        text = 'b';
        for (const el of elements) refreshView(el);

        expect(elements[0].title).toBe('b');
        expect(elements[19].title).toBe('b');
        expect(constructions).toBe(0);
        expect(warn).not.toHaveBeenCalled();
    });
});
