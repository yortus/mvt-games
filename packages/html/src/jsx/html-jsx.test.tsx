/** @jsxImportSource @mvtjs/html */
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView } from '@mvtjs/utils';
import '../element-mixin';
import { MVT_GROUP_CSS } from './html-target';
import { List } from './list';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// What the HTML JSX target does beyond the conformance suite
// (`src/jsx-conformance/html.test.ts`): the DOM's own attributes, groups and
// text, written as a view would write them.
describe('@mvtjs/html JSX', () => {
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
            refreshView(el);
            expect(el.hasAttribute('hidden')).toBe(false);

            isShown = false;
            refreshView(el);
            expect(el.hasAttribute('hidden')).toBe(true);
        });
    });

    describe('text', () => {
        it('writes a text node the element owns, keeping the node as the text changes', () => {
            let score = 10;
            const el = <span text={() => score} />;
            refreshView(el);
            const node = el.firstChild;
            expect(el.textContent).toBe('10');

            score = 11;
            refreshView(el);

            expect(el.textContent).toBe('11');
            expect(el.firstChild).toBe(node);
            expect(el.childNodes).toHaveLength(1);
        });

        it('cannot be mixed with element children, in dev builds', () => {
            expect(() => <p text="score"><span /></p>).toThrow(/cannot also have element children/);
            const el = <p text={() => 'late'}><span /></p>;
            expect(() => refreshView(el)).toThrow(/cannot also have text/);
        });
    });

    describe('value', () => {
        it('puts the model\'s value back when the user types something the model rejects', () => {
            const model = { name: 'Ada' };
            const input = <input value={() => model.name} /> as HTMLInputElement;
            refreshView(input);

            input.value = 'Ad';
            refreshView(input);

            expect(input.value).toBe('Ada');
        });

        it('is left alone while the field has focus, and written once it loses it', () => {
            const model = { name: 'Ada' };
            const input = <input value={() => model.name} /> as HTMLInputElement;
            document.body.append(input);
            refreshView(input);

            input.focus();
            input.value = 'Ad';
            refreshView(input);
            expect(input.value).toBe('Ad');

            input.blur();
            refreshView(input);
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
            refreshView(input);

            input.value = 'Grace';
            input.dispatchEvent(new Event('input'));
            refreshView(input);

            expect(model.name).toBe('Grace');
            expect(input.value).toBe('Grace');
        });
    });

    describe('checked', () => {
        it('is compared with the element, so a rejected click is undone', () => {
            const model = { isOn: false };
            const box = <input type="checkbox" checked={() => model.isOn} /> as HTMLInputElement;
            refreshView(box);

            box.checked = true;
            refreshView(box);

            expect(box.checked).toBe(false);
        });
    });

    describe('data-* and aria-* attributes', () => {
        it('are written as attributes, fixed or bound', () => {
            let state = 'idle';
            const el = <div data-kind="enemy" data-state={() => state} aria-live="polite" aria-busy={() => state !== 'idle'} />;
            refreshView(el);
            expect(el.getAttribute('data-kind')).toBe('enemy');
            expect(el.getAttribute('data-state')).toBe('idle');
            expect(el.getAttribute('aria-live')).toBe('polite');
            expect(el.getAttribute('aria-busy')).toBe('false');

            state = 'busy';
            refreshView(el);
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

    describe('table cells', () => {
        it('span columns and rows', () => {
            const row = (
                <tr>
                    <td colSpan={3} text="wide" />
                    <th rowSpan={2} text="tall" />
                </tr>
            );
            const [td, th] = [...row.children] as HTMLTableCellElement[];

            expect(td.colSpan).toBe(3);
            expect(td.textContent).toBe('wide');
            expect(th.rowSpan).toBe(2);
        });

        it('take a span only as a fixed value', () => {
            // The types reject a getter; untyped, the runtime does too
            const attributes: Record<string, unknown> = { colSpan: () => 2 };
            expect(() => <td {...attributes} />).toThrow(/'colSpan' takes a fixed value in @mvtjs\/html, /);
        });
    });

    describe('<output>', () => {
        it('is an element of its own, whose text can follow the model', () => {
            let total = 1;
            const el = <output text={() => total} />;
            refreshView(el);
            expect(el.localName).toBe('output');
            expect(el.textContent).toBe('1');

            total = 2;
            refreshView(el);
            expect(el.textContent).toBe('2');
        });
    });

    describe('typing hints', () => {
        it('set autocomplete on fields, and spellcheck on any element', () => {
            const input = <input autocomplete="off" spellcheck={false} /> as HTMLInputElement;
            const area = <textarea autocomplete="off" /> as HTMLTextAreaElement;
            const div = <div spellcheck={true} /> as HTMLElement;

            expect(input.autocomplete).toBe('off');
            expect(input.spellcheck).toBe(false);
            expect(area.autocomplete).toBe('off');
            expect(div.spellcheck).toBe(true);
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
            refreshView(list);
            const texts = (): string[] => [...list.querySelectorAll('li:not([hidden])')].map((li) => li.textContent ?? '');
            expect(texts()).toEqual(['a', 'b']);

            model.names = ['c'];
            refreshView(list);
            expect(texts()).toEqual(['c']);
        });
    });
});

describe('@mvtjs/html JSX where new Function is blocked', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    /**
     * A fresh runtime, with the global `Function` replaced by one that throws,
     * as a Content Security Policy without 'unsafe-eval' makes it.
     */
    async function withBlockedFunction() {
        vi.resetModules();
        const runtime = await import('./jsx-runtime');
        let constructions = 0;
        vi.stubGlobal('Function', function Blocked() {
            constructions++;
            throw new EvalError('Refused to evaluate a string as JavaScript');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        return { runtime, warn, constructions: () => constructions };
    }

    it('builds and refreshes elements without ever calling it, and warns nothing', async () => {
        const t = await withBlockedFunction();
        let text = 'a';

        // Enough elements that the shape takes a copy of the refresh code of its own
        const elements: HTMLElement[] = [];
        for (let i = 0; i < 20; i++) elements.push(t.runtime.jsx('div', { title: () => text }) as HTMLElement);
        for (const el of elements) refreshView(el);
        text = 'b';
        for (const el of elements) refreshView(el);

        expect(elements[0].title).toBe('b');
        expect(elements[19].title).toBe('b');
        expect(t.constructions()).toBe(0);
        expect(t.warn).not.toHaveBeenCalled();
    });
});
