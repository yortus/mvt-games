import { describe, expect, it } from 'vitest';
import type { HtmlTestAPI } from './visual-test';

describe('htmlTest', () => {
    it("types act's view as the element that the pose returns", () => {
        // Declarations for the type checker only: this function is never called.
        const declareTests = (htmlTest: HtmlTestAPI): void => {
            htmlTest('a field, focused', { act: (field) => field.focus() }, () => document.createElement('input'));
            htmlTest.each([1, 2])('case %s', { act: (field) => field.select() }, () => document.createElement('input'));
            htmlTest('a narrow, light page', { viewport: { width: 400, height: 300 }, colorScheme: 'light' }, () => document.createElement('div'));
            // @ts-expect-error: a div has no select().
            htmlTest('a div', { act: (div) => div.select() }, () => document.createElement('div'));
            // @ts-expect-error: the colour schemes are light and dark.
            htmlTest('a sepia page', { colorScheme: 'sepia' }, () => document.createElement('div'));
        };
        expect(declareTests).toBeTypeOf('function');
    });
});
