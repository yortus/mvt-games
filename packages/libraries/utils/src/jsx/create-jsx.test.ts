import { describe, expect, it } from 'vitest';
import { countTick, type RefreshMethod, SKIP_DESCENDANTS } from '../tick-api';
import { attributesOf, defineElements, element, event } from './attributes';
import { createJsx, Fragment } from './create-jsx';
import type { JsxTarget } from './jsx-target';

// ---------------------------------------------------------------------------
// A plain-object JSX target
// ---------------------------------------------------------------------------

// No Pixi here: the base must work on any scene graph. Every write an
// attribute makes is logged, so the tests can see what was written and when.

interface FakeNode {
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
    };
}

function write(el: FakeNode, key: string, value: unknown): void {
    el.values[key] = value;
    el.log.push(`${key}=${String(value)}`);
}

/** Parent before children; `SKIP_DESCENDANTS` skips the subtree. */
function refreshTree(node: FakeNode): void {
    if (refreshOf(node)?.() === SKIP_DESCENDANTS) return;
    for (let i = 0; i < node.children.length; i++) refreshTree(node.children[i]);
}

/**
 * A node's refresh method, read from the library's private field. This
 * file drives its fake tree with a walk of its own, and checks which
 * generated refresh method an element was given, so it reads the field the
 * library writes; nothing else outside the library should.
 */
function refreshOf(node: object): RefreshMethod | undefined {
    return (node as { _mvtRefreshMethod?: RefreshMethod })._mvtRefreshMethod;
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
};

const fakeElements = defineElements({
    box: element(() => createNode('box'), {
        x: fake.everyFrame((e, v: number) => { write(e, 'x', v); }),
        y: fake.everyFrame((e, v: number) => { write(e, 'y', v); }),
        z: fake.everyFrame((e, v: number) => { write(e, 'z', v); }),
        someAttributeName: fake.everyFrame((e, v: number) => { write(e, 'someAttributeName', v); }),
        label: fake.onChange((e, v: string) => { write(e, 'label', v); }),
        width: fake.onChangeNumber((e, v) => { write(e, 'width', v); }),
        mode: fake.fixed((e, v: string) => { write(e, 'mode', v); }),
        // Defined by a property: assigned by name in a shape's own copy of the refresh code
        isShown: fake.everyFrame('isShown'),
        onPoke: event<string>('poke'),
    }),
});

function runtime(ownCopyAt?: number) {
    return createJsx({ target: fakeTarget, elements: fakeElements, ownCopyAt }).jsx;
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

        refreshTree(el);
        x = 2;
        refreshTree(el);
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
        // A spread can carry any key
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

        refreshTree(el);
        expect(el.log).toEqual(['visible=false']);
        expect(child.log).toEqual([]);

        isShown = true;
        refreshTree(el);
        expect(el.log).toEqual(['visible=false', 'visible=true', 'x=2']);
        expect(child.log).toEqual(['x=1']);
    });

    it('rejects an element table that defines an attribute every element has', () => {
        const table = { box: element(() => createNode('box'), { visible: fake.fixed((_e, _v: boolean) => {}) }) };

        expect(() => defineElements(table)).toThrow(/defines 'visible'/);
    });

    describe('attribute patterns', () => {
        /** A table whose `<tagged>` makes a `tag-*` attribute per name, counting how many it made. */
        function taggedTable() {
            const made: string[] = [];
            const elements = defineElements({
                tagged: element(() => createNode('tagged'), { x: fakeElements.box.attributes.x }, {
                    'tag-': (name: string) => {
                        made.push(name);
                        return fake.onChange((e, v: string) => {
                            write(e, name, v);
                        });
                    },
                }),
            });
            return { jsx: createJsx({ target: fakeTarget, elements }).jsx, made };
        }

        it('make an attribute for a name with the prefix, fixed or bound, once per element kind', () => {
            const t = taggedTable();
            let colour = 'red';

            const a = t.jsx('tagged', { 'tag-size': 'big', 'tag-colour': () => colour });
            const b = t.jsx('tagged', { 'tag-colour': () => colour });
            refreshTree(a);
            refreshTree(b);
            colour = 'blue';
            refreshTree(a);

            expect(a.log).toEqual(['tag-size=big', 'tag-colour=red', 'tag-colour=blue']);
            expect(b.log).toEqual(['tag-colour=red']);
            expect(t.made).toEqual(['tag-size', 'tag-colour']);
        });

        it('match only names longer than the prefix, and leave other unknown names an error', () => {
            const t = taggedTable();

            expect(() => t.jsx('tagged', { 'tag-': 'x' })).toThrow(/no attribute 'tag-'/);
            expect(() => t.jsx('tagged', { label: 'x' })).toThrow(/no attribute 'label'/);
        });

        it('may not have a prefix that matches an attribute every element has', () => {
            const table = { box: element(() => createNode('box'), {}, { on: () => fake.fixed((_e, _v: string) => {}) }) };

            expect(() => defineElements(table)).toThrow(/pattern 'on', which matches 'onUpdate'/);
        });
    });

    describe('refresh methods', () => {
        /**
         * A scripted run over every write kind: what was written, and the reads
         * counted, per frame. With `ownCopyAt` 1, the shape has a copy of the
         * refresh code of its own from its first element; by default, its first
         * elements share one.
         */
        function script(ownCopyAt?: number): string[] {
            const jsx = runtime(ownCopyAt);
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
                const { reads } = countTick(() => refreshTree(el));
                frames.push(`${el.log.join(' ')} | reads ${reads}`);
            }
            return frames;
        }

        it('write every-frame bindings every frame and the rest on change, counting reads', () => {
            expect(script()).toEqual([
                'visible=true x=0 label=a width=1.5 step | reads 4',
                'x=1 step | reads 4',
                'x=1 label=b width=1.75 step | reads 4',
                'visible=false | reads 1',
                'visible=true x=2 step | reads 4',
                'x=2 step | reads 4',
            ]);
        });

        it('write the same in a shape\'s own copy of the refresh code as in the shared one', () => {
            expect(script(1)).toEqual(script());
        });

        it('take a copy of their own at a shape\'s sixteenth element', () => {
            const jsx = runtime();
            const elements: FakeNode[] = [];
            for (let i = 0; i < 16; i++) elements.push(jsx('box', { x: () => i }));

            expect(refreshOf(elements[14])).not.toBe(refreshOf(elements[15]));
            expect(String(refreshOf(elements[14]))).toBe(String(refreshOf(elements[15])));
            expect(refreshOf(elements[0])?.name).toBe('refresh1Copy0');
            expect(refreshOf(elements[14])?.name).toBe('refresh1Copy0');
            expect(refreshOf(elements[15])?.name).toMatch(/^refresh1Copy([1-9]|1\d)$/);
        });

        it('write the same past the six bindings the copies are written for', () => {
            const jsx = runtime(1);
            const state = { isShown: true, n: 1, label: 'a' };
            const el = jsx('box', {
                visible: () => state.isShown,
                x: () => state.n,
                y: () => state.n + 1,
                z: () => state.n + 2,
                someAttributeName: () => state.n + 3,
                label: () => state.label,
                width: () => state.n / 4,
                isShown: () => state.isShown,
            });
            const frames: string[] = [];
            const changes: (() => void)[] = [
                () => {},
                () => Object.assign(state, { n: 2 }),
                () => Object.assign(state, { label: 'b' }),
                () => Object.assign(state, { isShown: false }),
                () => Object.assign(state, { isShown: true }),
            ];
            for (const change of changes) {
                change();
                el.log.length = 0;
                const { reads } = countTick(() => refreshTree(el));
                frames.push(`${el.log.join(' ')} ${String(el.isShown)} | reads ${reads}`);
            }

            expect(frames).toEqual([
                'visible=true x=1 y=2 z=3 someAttributeName=4 label=a width=0.25 true | reads 8',
                'x=2 y=3 z=4 someAttributeName=5 width=0.5 true | reads 8',
                'x=2 y=3 z=4 someAttributeName=5 label=b true | reads 8',
                'visible=false false | reads 1',
                'visible=true x=2 y=3 z=4 someAttributeName=5 true | reads 8',
            ]);
        });

        it('assign an attribute defined by a property, in the shared copy and in a shape\'s own', () => {
            for (const ownCopyAt of [16, 1]) {
                let isShown = false;
                const el = runtime(ownCopyAt)('box', { isShown: () => isShown });
                refreshTree(el);
                expect(el.isShown).toBe(false);
                isShown = true;
                refreshTree(el);
                expect(el.isShown).toBe(true);
            }
        });

        it('name the copy in a stack trace, above the binding that threw', () => {
            const el = runtime(1)('box', {
                x: () => {
                    throw new Error('from a binding');
                },
            });

            let stack = '';
            try {
                refreshTree(el);
            }
            catch (error) {
                stack = (error as Error).stack ?? '';
            }
            expect(stack).toMatch(/at x \(.*\n\s+at (Object\.)?refresh1Copy\d+ .*refresh-copies\.ts/);
        });
    });
});
