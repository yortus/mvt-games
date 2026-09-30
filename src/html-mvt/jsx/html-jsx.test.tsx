/** @jsxImportSource #html-mvt/jsx */
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshScene } from '..';
import { MVT_GROUP_CSS } from './html-target';
import { List } from './list';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// What the HTML JSX target does beyond the conformance suite
// (`src/jsx-conformance/html.test.ts`): the DOM's own attributes, groups and
// text, written as a view would write them.
describe('html-mvt/jsx', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    describe('groups', () => {
        it('are <mvt-group> elements, styled once per document to leave layout alone', () => {
            const a = <></>;
            const b = <></>;

            expect(a.localName).toBe('mvt-group');
            expect(b.localName).toBe('mvt-group');
            const rules = [...document.querySelectorAll('style')].filter((s) => s.textContent === MVT_GROUP_CSS);
            expect(rules).toHaveLength(1);
        });
    });

    describe('visible', () => {
        it('is the hidden attribute', () => {
            let isShown = true;
            const el = <div visible={() => isShown} />;
            refreshScene(el);
            expect(el.hasAttribute('hidden')).toBe(false);

            isShown = false;
            refreshScene(el);
            expect(el.hasAttribute('hidden')).toBe(true);
        });
    });

    describe('text', () => {
        it('writes a text node the element owns, keeping the node as the text changes', () => {
            let score = 10;
            const el = <span text={() => score} />;
            refreshScene(el);
            const node = el.firstChild;
            expect(el.textContent).toBe('10');

            score = 11;
            refreshScene(el);

            expect(el.textContent).toBe('11');
            expect(el.firstChild).toBe(node);
            expect(el.childNodes).toHaveLength(1);
        });

        it('cannot be mixed with element children, in dev builds', () => {
            expect(() => <p text="score"><span /></p>).toThrow(/cannot also have element children/);
            const el = <p text={() => 'late'}><span /></p>;
            expect(() => refreshScene(el)).toThrow(/cannot also have text/);
        });
    });

    describe('value', () => {
        it('puts the model\'s value back when the user types something the model rejects', () => {
            const model = { name: 'Ada' };
            const input = <input value={() => model.name} /> as HTMLInputElement;
            refreshScene(input);

            input.value = 'Ad';
            refreshScene(input);

            expect(input.value).toBe('Ada');
        });

        it('is left alone while the field has focus, and written once it loses it', () => {
            const model = { name: 'Ada' };
            const input = <input value={() => model.name} /> as HTMLInputElement;
            document.body.append(input);
            refreshScene(input);

            input.focus();
            input.value = 'Ad';
            refreshScene(input);
            expect(input.value).toBe('Ad');

            input.blur();
            refreshScene(input);
            expect(input.value).toBe('Ada');
        });

        it('reports what the user does through events', () => {
            const model = { name: 'Ada' };
            const input = (
                <input
                    value={() => model.name}
                    onInput={(event) => {
                        model.name = (event.target as HTMLInputElement).value;
                    }}
                />
            ) as HTMLInputElement;
            refreshScene(input);

            input.value = 'Grace';
            input.dispatchEvent(new Event('input'));
            refreshScene(input);

            expect(model.name).toBe('Grace');
            expect(input.value).toBe('Grace');
        });
    });

    describe('checked', () => {
        it('is compared with the element, so a rejected click is undone', () => {
            const model = { isOn: false };
            const box = <input type="checkbox" checked={() => model.isOn} /> as HTMLInputElement;
            refreshScene(box);

            box.checked = true;
            refreshScene(box);

            expect(box.checked).toBe(false);
        });
    });

    describe('data-* and aria-* attributes', () => {
        it('are written as attributes, fixed or bound', () => {
            let state = 'idle';
            const el = <div data-kind="enemy" data-state={() => state} aria-live="polite" aria-busy={() => state !== 'idle'} />;
            refreshScene(el);
            expect(el.getAttribute('data-kind')).toBe('enemy');
            expect(el.getAttribute('data-state')).toBe('idle');
            expect(el.getAttribute('aria-live')).toBe('polite');
            expect(el.getAttribute('aria-busy')).toBe('false');

            state = 'busy';
            refreshScene(el);
            expect(el.getAttribute('data-state')).toBe('busy');
            expect(el.getAttribute('aria-busy')).toBe('true');
        });

        it('are typed from the table, except for data-* and aria-* values', () => {
            // Compiled, never run: the checks are the expected errors. TypeScript
            // never checks a hyphenated JSX attribute against an index signature,
            // so the patterns' types go unchecked; `<div data-bad={{}} />`
            // compiles, and writes "[object Object]".
            const unused = (): unknown[] => [
                <div data-count={3} aria-hidden={() => true} />,
                // @ts-expect-error: <div> has no href
                <div href="x" />,
                // @ts-expect-error: text is a string or number
                <span text={() => false} />,
            ];
            expect(unused).toBeTypeOf('function');
        });

        it('need a name after the prefix, and other unknown names still throw', () => {
            const attributes = (key: string): Record<string, unknown> => ({ [key]: 'x' });
            expect(() => <div {...attributes('data-')} />).toThrow(/no attribute 'data-'/);
            expect(() => <div {...attributes('datum-x')} />).toThrow(/no attribute 'datum-x'/);
        });
    });

    describe('<List>', () => {
        it('lists items in a group, following the model', () => {
            const model = { names: ['a', 'b'] };
            const list = (
                <ul>
                    <List items={() => model.names}>{(name) => <li text={name} />}</List>
                </ul>
            );
            refreshScene(list);
            const texts = (): string[] => [...list.querySelectorAll('li:not([hidden])')].map((li) => li.textContent ?? '');
            expect(texts()).toEqual(['a', 'b']);

            model.names = ['c'];
            refreshScene(list);
            expect(texts()).toEqual(['c']);
        });
    });
});

describe('html-mvt/jsx where new Function is blocked', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    /**
     * A fresh runtime, whose first element with a binding probes `new
     * Function` with the global `Function` replaced by one that throws, as a
     * Content Security Policy without 'unsafe-eval' makes it.
     */
    async function withBlockedFunction() {
        vi.resetModules();
        const runtime = await import('./jsx-runtime');
        const mvt = await import('..');
        let constructions = 0;
        vi.stubGlobal('Function', function Blocked() {
            constructions++;
            throw new EvalError('Refused to evaluate a string as JavaScript');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        return { runtime, refreshScene: mvt.refreshScene, warn, constructions: () => constructions };
    }

    it('falls back to closures that write the same values, and warns once in dev builds', async () => {
        const t = await withBlockedFunction();
        let text = 'a';

        const first = t.runtime.jsx('div', { title: () => text });
        const second = t.runtime.jsx('span', { title: () => text });
        vi.unstubAllGlobals();
        t.refreshScene(first);
        text = 'b';
        t.refreshScene(first);
        t.refreshScene(second);

        expect((first as HTMLElement).title).toBe('b');
        expect((second as HTMLElement).title).toBe('b');
        expect(t.runtime.refreshMethodCounts).toMatchObject({ generated: 0, fallback: 2 });
        expect(t.constructions()).toBe(1);
        expect(t.warn).toHaveBeenCalledTimes(1);
        expect(t.warn.mock.calls[0][0]).toMatch(/Content Security Policy blocks new Function/);
    });

    it('neither probes nor warns when __MVT_JSX_EVAL__ is defined as false', async () => {
        vi.stubGlobal('__MVT_JSX_EVAL__', false);
        const t = await withBlockedFunction();

        const el = t.runtime.jsx('div', { title: () => 'a' });
        vi.unstubAllGlobals();
        t.refreshScene(el);

        expect((el as HTMLElement).title).toBe('a');
        expect(t.runtime.refreshMethodCounts.fallback).toBe(1);
        expect(t.constructions()).toBe(0);
        expect(t.warn).not.toHaveBeenCalled();
    });
});
