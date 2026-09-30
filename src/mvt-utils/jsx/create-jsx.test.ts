import { describe, expect, it } from 'vitest';
import { countReads, type SceneNode, type RefreshMethod, SKIP_DESCENDANTS, type UpdateMethod } from '..';
import { attributesOf, defineElements, element, event } from './attributes';
import { createJsx, Fragment } from './create-jsx';
import type { JsxTarget } from './jsx-target';
import { canGenerateCode } from './refresh-builder';

// ---------------------------------------------------------------------------
// A plain-object JSX target
// ---------------------------------------------------------------------------

// No Pixi here: the base must work on any scene graph. Every write an
// attribute makes is logged, so the tests can see what was written and when.

interface FakeNode extends SceneNode {
    readonly kind: string;
    readonly children: FakeNode[];
    parent: FakeNode | undefined;
    isShown: boolean;
    readonly values: Record<string, unknown>;
    readonly log: string[];
    readonly listeners: Record<string, (event: never) => void>;
}

function createNode(kind: string): FakeNode {
    return {
        kind,
        children: [],
        parent: undefined,
        isShown: true,
        values: {},
        log: [],
        listeners: {},
        onUpdate: undefined as UpdateMethod | undefined,
        onRefresh: undefined as RefreshMethod | undefined,
    };
}

function write(el: FakeNode, key: string, value: unknown): void {
    el.values[key] = value;
    el.log.push(`${key}=${String(value)}`);
}

/** Parent before children; `SKIP_DESCENDANTS` skips the subtree. */
function refreshScene(node: FakeNode): void {
    if (node.onRefresh?.() === SKIP_DESCENDANTS) return;
    for (let i = 0; i < node.children.length; i++) refreshScene(node.children[i]);
}

const fake = attributesOf<FakeNode>();

const fakeTarget: JsxTarget<FakeNode> = {
    name: 'fake-jsx',
    createGroup: () => createNode('group'),
    append: (parent, child) => {
        parent.children.push(child);
        child.parent = parent;
    },
    replace: (parent, current, next) => {
        parent.children[parent.children.indexOf(current)] = next;
        next.parent = parent;
        current.parent = undefined;
    },
    detachTail: (parent, count) => {
        for (const child of parent.children.splice(parent.children.length - count, count)) child.parent = undefined;
    },
    // Written on change, as a JSX target whose writes are expensive would
    visible: fake.onChange((e, v: boolean) => {
        e.isShown = v;
        e.log.push(`visible=${v}`);
    }),
    destroy: () => {},
    onDestroyed: () => {},
    listen: (node, eventName, handler) => {
        node.listeners[eventName] = handler;
        node.log.push(`listen ${eventName}`);
    },
    refreshScene,
};

const fakeElements = defineElements({
    box: element(() => createNode('box'), {
        x: fake.everyFrame((e, v: number) => { write(e, 'x', v); }),
        someAttributeName: fake.everyFrame((e, v: number) => { write(e, 'someAttributeName', v); }),
        label: fake.onChange((e, v: string) => { write(e, 'label', v); }),
        width: fake.onChangeNumber((e, v) => { write(e, 'width', v); }),
        mode: fake.fixed((e, v: string) => { write(e, 'mode', v); }),
        // Defined by a property: assigned inline by generated code
        isShown: fake.everyFrame('isShown'),
        onPoke: event<string>('poke'),
    }),
});

function runtime(canGenerateCode?: boolean) {
    return createJsx({ target: fakeTarget, elements: fakeElements, canGenerateCode }).jsx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createJsx', () => {
    it('builds elements for any target, applying fixed values at once and nothing else', () => {
        const jsx = runtime();
        let x = 1;
        const el = jsx('box', { mode: 'a', x: () => x });

        expect(el.log).toEqual(['mode=a']);

        refreshScene(el);
        x = 2;
        refreshScene(el);
        expect(el.log).toEqual(['mode=a', 'x=1', 'x=2']);
    });

    it('appends children with the target, and builds fragments as groups', () => {
        const jsx = runtime();
        const child = jsx('box', {});
        const parent = jsx('box', { children: [child, [undefined, jsx('box', {})]] });
        const fragment = jsx(Fragment, { children: parent });

        expect(parent.children).toHaveLength(2);
        expect(child.parent).toBe(parent);
        expect(fragment.kind).toBe('group');
        expect(fragment.children).toEqual([parent]);
    });

    it('wires event attributes before applying any other attribute', () => {
        const jsx = runtime();
        const el = jsx('box', { mode: 'a', onPoke: () => {}, label: 'b' });

        expect(el.log).toEqual(['listen poke', 'mode=a', 'label=b']);
    });

    it('skips an event attribute given no handler', () => {
        const jsx = runtime();
        const el = jsx('box', { onPoke: undefined });

        expect(el.log).toEqual([]);
    });

    it('throws for an attribute the table does not define, naming the target', () => {
        const jsx = runtime();

        expect(() => jsx('box', { bogus: 1 })).toThrow(/<box> has no attribute 'bogus' in fake-jsx/);
        // A spread can carry any key; none reaches generated code
        expect(() => jsx('box', { 'x;throw 1//': () => 1 })).toThrow(/has no attribute/);
    });

    it('throws for a function given to an attribute that takes only a fixed value', () => {
        const jsx = runtime();

        expect(() => jsx('box', { mode: () => 'a' })).toThrow(/'mode' takes a fixed value/);
    });

    it('throws for an unknown element, naming the target', () => {
        const jsx = runtime();

        expect(() => jsx('toString', {})).toThrow(/Unknown fake-jsx element: <toString>/);
    });

    it('writes the target\'s visible first, and skips the rest while it is false', () => {
        const jsx = runtime();
        let isShown = false;
        const child = jsx('box', { x: () => 1 });
        const el = jsx('box', { x: () => 2, visible: () => isShown, children: child });

        refreshScene(el);
        expect(el.log).toEqual(['visible=false']);
        expect(child.log).toEqual([]);

        isShown = true;
        refreshScene(el);
        expect(el.log).toEqual(['visible=false', 'visible=true', 'x=2']);
        expect(child.log).toEqual(['x=1']);
    });

    it('rejects an element table that defines an attribute every element has', () => {
        const table = { box: element(() => createNode('box'), { visible: fake.fixed((_e, _v: boolean) => {}) }) };

        expect(() => defineElements(table)).toThrow(/defines 'visible'/);
    });

    describe('generated code and the fallback', () => {
        /** A scripted run over every write kind: what was written, and the reads counted, per frame. */
        function script(canGenerateCode: boolean): string[] {
            const jsx = runtime(canGenerateCode);
            const state = { isShown: true, x: 0, label: 'a', width: 1.5 };
            const el = jsx('box', {
                label: () => state.label,
                width: () => state.width,
                visible: () => state.isShown,
                x: () => state.x,
                onRefresh: () => { el.log.push('step'); },
            });
            const frames: string[] = [];
            const changes: (() => void)[] = [
                () => {},
                () => Object.assign(state, { x: 1 }),
                () => Object.assign(state, { label: 'b', width: 1.75 }),
                () => Object.assign(state, { isShown: false, x: 2 }),
                () => Object.assign(state, { isShown: true }),
                () => Object.assign(state, { width: 1.75 }),
            ];
            for (const change of changes) {
                change();
                el.log.length = 0;
                const reads = countReads(() => refreshScene(el));
                frames.push(`${el.log.join(' ')} | reads ${reads}`);
            }
            return frames;
        }

        it('write the same values, in the same order, with the same read counts', () => {
            const generated = script(true);

            expect(script(false)).toEqual(generated);
            expect(generated).toEqual([
                'visible=true x=0 label=a width=1.5 step | reads 4',
                'x=1 step | reads 4',
                'x=1 label=b width=1.75 step | reads 4',
                'visible=false | reads 1',
                'visible=true x=2 step | reads 4',
                'x=2 step | reads 4',
            ]);
        });

        it('call an attribute\'s apply function, putting no attribute name in generated source', () => {
            const el = runtime(true)('box', { someAttributeName: () => 1 });

            const source = String(el.onRefresh);
            expect(source).toContain('a0(e,g0())');
            expect(source).not.toContain('someAttributeName');
        });

        it('assign an attribute defined by a property inline, in both paths', () => {
            for (const canGenerateCode of [true, false]) {
                let isShown = false;
                const el = runtime(canGenerateCode)('box', { isShown: () => isShown });
                refreshScene(el);
                expect(el.isShown).toBe(false);
                isShown = true;
                refreshScene(el);
                expect(el.isShown).toBe(true);
                if (canGenerateCode) expect(String(el.onRefresh)).toContain('e.isShown=g0()');
            }
        });

        it('reject a property name that is not an identifier, where the table is defined', () => {
            expect(() => fake.everyFrame('x;alert(1)' as keyof FakeNode & string)).toThrow(/not a property name/);
        });

        it('are chosen by probing the page, which Node allows', () => {
            expect(canGenerateCode()).toBe(true);
        });
    });
});
