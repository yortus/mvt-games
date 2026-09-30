import { describe, expect, it } from 'vitest';
import { countReads, createOrderedSlotList, createSlotList, readCounter, SKIP_DESCENDANTS } from '../..';
import type { SceneNode } from '../..';
import { createJsx, createList, createSwitch, Fragment } from '..';
import type { ElementTable, JsxFactory, JsxTarget, ListComponent, SwitchComponents } from '..';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One attribute of a JSX target, for the suite to bind: an element that has it,
 * two values to write, and how to read and overwrite what it holds.
 */
export interface AttributeProbe<N, T> {
    readonly tag: string;
    readonly key: string;
    /** Two distinct values the attribute accepts. */
    readonly values: readonly [T, T];
    /** What the element holds, as the attribute wrote it. */
    readonly read: (node: N) => T;
    /** Overwrites what the element holds, as code other than the binding would. */
    readonly write: (node: N, value: T) => void;
    /** Other attributes the element needs for this one to work, such as a sized texture. */
    readonly with?: Readonly<Record<string, unknown>>;
}

/** What the conformance suite needs to know about a JSX target, beyond its `JsxTarget`. */
export interface ConformanceFixture<N extends SceneNode> {
    readonly target: JsxTarget<N>;
    readonly elements: ElementTable<N>;
    /** An every-frame attribute. */
    readonly everyFrame: AttributeProbe<N, unknown>;
    /** An on-change attribute. */
    readonly onChange: AttributeProbe<N, unknown>;
    /** An on-change number attribute, whose values should be fractional. */
    readonly onChangeNumber: AttributeProbe<N, number>;
    /** A fixed attribute. */
    readonly fixed: AttributeProbe<N, unknown>;
    /** An event attribute on `everyFrame.tag`, and how to fire its event. */
    readonly event: { readonly key: string; readonly emit: (node: N) => void };
    readonly children: (node: N) => readonly N[];
    readonly parent: (node: N) => N | undefined;
    readonly isVisible: (node: N) => boolean;
    readonly isDestroyed: (node: N) => boolean;
    readonly updateScene: (node: N, deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Defines the conformance suite for one JSX target: the runtime's behaviour
 * (proposal 022 section 3), `<List>` and `<Switch>`, each run with generated
 * refresh code and with the closure fallback. Call it inside a test file.
 */
export function describeJsxConformance<N extends SceneNode>(fixture: ConformanceFixture<N>): void {
    for (const canGenerateCode of [true, false]) {
        describe(`${fixture.target.name}, ${canGenerateCode ? 'generated code' : 'fallback'}`, () => {
            const runtime = createJsx({ target: fixture.target, elements: fixture.elements, canGenerateCode });
            const List = createList({ target: fixture.target });
            const { Switch, Match } = createSwitch({ target: fixture.target });
            const context: SuiteContext<N> = { fixture, jsx: runtime.jsx, List, Switch, Match };
            describeRuntime(context);
            describeList(context);
            describeSwitch(context);
        });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SuiteContext<N extends SceneNode> {
    readonly fixture: ConformanceFixture<N>;
    readonly jsx: JsxFactory<N>;
    readonly List: ListComponent<N>;
    readonly Switch: SwitchComponents<N>['Switch'];
    readonly Match: SwitchComponents<N>['Match'];
}

// --- The runtime -----------------------------------------------------------

function describeRuntime<N extends SceneNode>({ fixture, jsx }: SuiteContext<N>): void {
    const { target, everyFrame, onChange, onChangeNumber } = fixture;
    const refresh = target.refreshScene;
    /** A fragment of `children`, nested as JSX children may be. */
    const group = (children?: unknown): N => jsx(Fragment, { children });

    describe('runtime', () => {
        it('applies fixed values at construction', () => {
            const el = jsx(fixture.fixed.tag, { [fixture.fixed.key]: fixture.fixed.values[0] });

            expect(fixture.fixed.read(el)).toBe(fixture.fixed.values[0]);
        });

        it('runs no binding at construction, only from the first refresh on', () => {
            let reads = 0;
            let value = everyFrame.values[0];
            const el = jsx(everyFrame.tag, {
                [everyFrame.key]: () => {
                    reads++;
                    return value;
                },
            });
            expect(reads).toBe(0);

            refresh(el);
            expect(everyFrame.read(el)).toBe(everyFrame.values[0]);

            value = everyFrame.values[1];
            refresh(el);
            expect(everyFrame.read(el)).toBe(everyFrame.values[1]);
            expect(reads).toBe(2);
        });

        it('lets a skipping ancestor keep a not-yet-valid binding from ever running', () => {
            const model: { boss?: { hp: number } } = {};
            const child = jsx(everyFrame.tag, { [everyFrame.key]: () => (model.boss!.hp > 0 ? everyFrame.values[1] : everyFrame.values[0]) });
            const parent = jsx(everyFrame.tag, { visible: () => model.boss !== undefined, children: child });

            expect(() => refresh(parent)).not.toThrow();

            model.boss = { hp: 9 };
            refresh(parent);
            expect(everyFrame.read(child)).toBe(everyFrame.values[1]);
        });

        it('writes an every-frame binding on every refresh', () => {
            const el = jsx(everyFrame.tag, { [everyFrame.key]: () => everyFrame.values[0] });
            refresh(el);

            everyFrame.write(el, everyFrame.values[1]);
            refresh(el);

            expect(everyFrame.read(el)).toBe(everyFrame.values[0]);
        });

        it('writes an on-change binding on the first refresh, then only when it changes', () => {
            let value = onChange.values[0];
            const el = jsx(onChange.tag, { [onChange.key]: () => value });
            refresh(el);
            expect(onChange.read(el)).toBe(onChange.values[0]);

            // A direct write is left alone while the binding is unchanged...
            onChange.write(el, onChange.values[1]);
            refresh(el);
            expect(onChange.read(el)).toBe(onChange.values[1]);

            // ...and replaced once it changes
            value = onChange.values[1];
            refresh(el);
            value = onChange.values[0];
            refresh(el);
            expect(onChange.read(el)).toBe(onChange.values[0]);
        });

        it('writes a fractional on-change number only when it changes, including a first 0', () => {
            let value = 0;
            const el = jsx(onChangeNumber.tag, { ...onChangeNumber.with, [onChangeNumber.key]: () => value });
            onChangeNumber.write(el, onChangeNumber.values[0]);
            refresh(el);
            expect(onChangeNumber.read(el)).toBeCloseTo(0);

            onChangeNumber.write(el, onChangeNumber.values[0]);
            refresh(el);
            expect(onChangeNumber.read(el)).toBeCloseTo(onChangeNumber.values[0]);

            value = onChangeNumber.values[1];
            refresh(el);
            expect(onChangeNumber.read(el)).toBeCloseTo(onChangeNumber.values[1]);
        });

        it('keeps per-element state separate when elements share a binding shape', () => {
            let a = onChange.values[0];
            const b = onChange.values[0];
            const elA = jsx(onChange.tag, { [onChange.key]: () => a });
            const elB = jsx(onChange.tag, { [onChange.key]: () => b });
            refresh(elA);
            refresh(elB);

            a = onChange.values[1];
            onChange.write(elB, onChange.values[1]);
            refresh(elA);
            refresh(elB);

            expect(onChange.read(elA)).toBe(onChange.values[1]);
            expect(onChange.read(elB)).toBe(onChange.values[1]); // Unchanged binding: left alone
        });

        describe('visible binding', () => {
            it('skips the element\'s other bindings and its subtree while hidden, and resumes', () => {
                let isShown = true;
                let reads = 0;
                const child = jsx(everyFrame.tag, {
                    [everyFrame.key]: () => {
                        reads++;
                        return everyFrame.values[1];
                    },
                });
                const parent = jsx(everyFrame.tag, {
                    // Declared after the other binding on purpose: `visible` is still evaluated first
                    [everyFrame.key]: () => {
                        reads++;
                        return everyFrame.values[0];
                    },
                    visible: () => isShown,
                    children: child,
                });
                refresh(parent);
                reads = 0;

                isShown = false;
                refresh(parent);
                expect(fixture.isVisible(parent)).toBe(false);
                expect(reads).toBe(0);

                isShown = true;
                refresh(parent);
                expect(fixture.isVisible(parent)).toBe(true);
                expect(reads).toBe(2);
            });

            it('applies a fixed visible value at construction', () => {
                const el = jsx(everyFrame.tag, { visible: false });

                expect(fixture.isVisible(el)).toBe(false);
            });
        });

        describe('onRefresh attribute', () => {
            it('runs after the element\'s bindings, receiving the element', () => {
                const order: string[] = [];
                let received: N | undefined;
                const el = jsx(everyFrame.tag, {
                    onRefresh: (node: N) => {
                        order.push('step');
                        received = node;
                    },
                    [everyFrame.key]: () => {
                        order.push('binding');
                        return everyFrame.values[0];
                    },
                });

                refresh(el);

                expect(order).toEqual(['binding', 'step']);
                expect(received).toBe(el);
            });

            it('is skipped while a visible binding hides the element', () => {
                let isShown = false;
                let calls = 0;
                const el = jsx(everyFrame.tag, { visible: () => isShown, onRefresh: () => void calls++ });

                refresh(el);
                expect(calls).toBe(0);

                isShown = true;
                refresh(el);
                expect(calls).toBe(1);
            });

            it('can skip the element\'s descendants', () => {
                let reads = 0;
                const child = jsx(everyFrame.tag, {
                    [everyFrame.key]: () => {
                        reads++;
                        return everyFrame.values[0];
                    },
                });
                const parent = jsx(everyFrame.tag, { onRefresh: () => SKIP_DESCENDANTS, children: child });

                refresh(parent);

                expect(reads).toBe(0);
            });
        });

        it('installs an onUpdate attribute as the element\'s update method, not a binding', () => {
            const deltas: number[] = [];
            const el = jsx(everyFrame.tag, { onUpdate: (deltaMs: number) => void deltas.push(deltaMs) });

            refresh(el);
            expect(deltas).toEqual([]);

            fixture.updateScene(el, 16);
            fixture.updateScene(el, 17);
            expect(deltas).toEqual([16, 17]);
        });

        describe('onDestroyed attribute', () => {
            it('runs once, with the element, when the element is destroyed', () => {
                const received: N[] = [];
                const el = jsx(everyFrame.tag, { onDestroyed: (node: N) => void received.push(node) });

                target.destroy(el);
                target.destroy(el);

                expect(received).toEqual([el]);
                expect(fixture.isDestroyed(el)).toBe(true);
            });

            it('runs when an ancestor is destroyed', () => {
                let calls = 0;
                const leaf = jsx(everyFrame.tag, { onDestroyed: () => void calls++ });
                const root = group(group(leaf));

                target.destroy(root);

                expect(calls).toBe(1);
            });

            it('is not a binding: a refresh neither calls nor installs it', () => {
                let calls = 0;
                const el = jsx(everyFrame.tag, { onDestroyed: () => void calls++ });

                expect(el.onRefresh).toBeUndefined();
                refresh(el);
                expect(calls).toBe(0);
            });
        });

        it('wires event attributes as listeners', () => {
            let calls = 0;
            const el = jsx(everyFrame.tag, { [fixture.event.key]: () => void calls++ });

            fixture.event.emit(el);

            expect(calls).toBe(1);
        });

        describe('read counting', () => {
            it('counts every function attribute read, and only the visible read while hidden', () => {
                let isShown = true;
                const el = jsx(everyFrame.tag, {
                    visible: () => isShown,
                    [everyFrame.key]: () => everyFrame.values[0],
                });
                const withChange = jsx(onChange.tag, { [onChange.key]: () => onChange.values[0], children: el });

                expect(countReads(() => refresh(withChange))).toBe(3);
                isShown = false;
                expect(countReads(() => refresh(withChange))).toBe(2);
            });

            it('counts nothing while off', () => {
                const el = jsx(everyFrame.tag, { [everyFrame.key]: () => everyFrame.values[0] });
                const before = readCounter.count;

                refresh(el);

                expect(readCounter.isCounting).toBe(false);
                expect(readCounter.count).toBe(before);
            });
        });

        it('calls ref with the element, last, for elements and components alike', () => {
            const received: N[] = [];
            const el = jsx(everyFrame.tag, { ref: (node: N) => void received.push(node) });
            const component = (attributes: Record<string, unknown>): N => jsx(everyFrame.tag, { children: attributes.children as N });
            const fromComponent = jsx(component, { ref: (node: N) => void received.push(node) });

            expect(received).toEqual([el, fromComponent]);
        });

        it('builds a fragment as a group of its children', () => {
            const a = jsx(everyFrame.tag, {});
            const b = jsx(everyFrame.tag, {});

            const fragment = group([a, [b]]);

            expect(fixture.children(fragment)).toEqual([a, b]);
        });

        it('throws for an unknown element or attribute, naming the target', () => {
            expect(() => jsx('no-such-element', {})).toThrow(new RegExp(target.name));
            expect(() => jsx(everyFrame.tag, { noSuchAttribute: 1 })).toThrow(/no attribute 'noSuchAttribute'/);
        });
    });
}

// --- <List> ----------------------------------------------------------------

interface Item { readonly id: number }

function itemsWithIds(...ids: number[]): Item[] {
    return ids.map((id) => ({ id }));
}

function describeList<N extends SceneNode>({ fixture, jsx, List }: SuiteContext<N>): void {
    const { target, onChange } = fixture;
    const refresh = target.refreshScene;
    const [labelA, labelB] = onChange.values;
    /** The value an item view shows: the probe's first value for even ids, its second for odd. */
    const labelFor = (id: number): unknown => (id % 2 === 0 ? labelA : labelB);

    /**
     * A list over an array that is mutated in place, the way models in this
     * repo own collections. `undefined` entries are empty slots. Each item view
     * binds the probe's on-change attribute to its item.
     */
    function setup(initial: (Item | undefined)[]) {
        const items = initial;
        const built: number[] = [];
        let bindingReads = 0;
        let atCalls = 0;
        const source = {
            get length() { return items.length; },
            at: (i: number) => {
                atCalls++;
                return items[i];
            },
        };
        const list = List<Item>({
            items: source,
            children: (item, index) => {
                built.push(index);
                return jsx(onChange.tag, {
                    [onChange.key]: () => {
                        bindingReads++;
                        return labelFor(item().id);
                    },
                });
            },
        });
        refresh(list);
        return {
            list,
            items,
            built,
            bindingReads: () => bindingReads,
            atCalls: () => atCalls,
            resetCounts: () => {
                bindingReads = 0;
                atCalls = 0;
            },
            shown: () => fixture.children(list).map((c) => onChange.read(c)),
            visible: () => fixture.children(list).map((c) => fixture.isVisible(c)),
        };
    }

    describe('<List>', () => {
        it('builds one slot per item, in order, each seeing its item at construction', () => {
            const t = setup(itemsWithIds(2, 3, 4));

            expect(t.built).toEqual([0, 1, 2]);
            expect(t.shown()).toEqual([labelA, labelB, labelA]);
        });

        it('builds only the new indices when the source grows', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            t.built.length = 0;

            t.items.push({ id: 4 }, { id: 5 });
            refresh(t.list);

            expect(t.built).toEqual([3, 4]);
            expect(fixture.children(t.list).length).toBe(5);
        });

        it('detaches surplus slots on shrink, keeping them rather than destroying them', () => {
            const t = setup(itemsWithIds(1, 2, 3, 4));
            const surplus = fixture.children(t.list)[3];

            t.items.length = 2;
            refresh(t.list);

            expect(fixture.children(t.list).length).toBe(2);
            expect(t.visible()).toEqual([true, true]);
            expect(fixture.parent(surplus)).toBeUndefined();
            expect(fixture.isDestroyed(surplus)).toBe(false);
        });

        it('destroys detached slots along with the list', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            const attached = fixture.children(t.list)[0];
            const detached = fixture.children(t.list)[2];
            t.items.length = 1;
            refresh(t.list);

            target.destroy(t.list);

            expect(fixture.isDestroyed(attached)).toBe(true);
            expect(fixture.isDestroyed(detached)).toBe(true);
        });

        it('does not run a detached slot\'s bindings', () => {
            const t = setup(itemsWithIds(1, 2, 3, 4));
            t.items.length = 1;
            t.resetCounts();

            refresh(t.list);

            expect(t.bindingReads()).toBe(1);
        });

        it('reattaches kept slots on regrowth, refreshed that frame, and never rebuilds one', () => {
            const t = setup(itemsWithIds(1, 2, 3, 4));
            const original = fixture.children(t.list)[3];

            t.items.length = 1;
            refresh(t.list);
            t.items.push(...itemsWithIds(12, 13, 14));
            refresh(t.list);

            expect(t.built).toEqual([0, 1, 2, 3]);
            expect(fixture.children(t.list)[3]).toBe(original);
            expect(t.shown()).toEqual([labelB, labelA, labelB, labelA]);
        });

        it('keeps refreshing a reattached slot on later frames, when an ancestor is refreshed', () => {
            const t = setup(itemsWithIds(1, 2));
            const root = jsx(Fragment, { children: t.list });
            refresh(root);

            t.items.length = 1;
            refresh(root);
            t.items.push({ id: 3 });
            refresh(root);
            t.items[1] = { id: 4 };
            refresh(root);

            expect(t.shown()).toEqual([labelB, labelA]);
        });

        it('does no structural work when the source is unchanged', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            const before = fixture.children(t.list).slice();
            t.built.length = 0;

            refresh(t.list);
            refresh(t.list);

            expect(t.built).toEqual([]);
            expect(fixture.children(t.list)).toEqual(before);
        });

        it('re-reads each slot\'s item every frame, so a reorder is not structural', () => {
            const t = setup(itemsWithIds(1, 2));
            const before = fixture.children(t.list).slice();

            t.items.reverse();
            refresh(t.list);

            expect(t.shown()).toEqual([labelA, labelB]);
            expect(fixture.children(t.list)).toEqual(before);
            expect(t.built).toEqual([0, 1]);
        });

        it('calls at() once per slot per frame', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            t.resetCounts();

            refresh(t.list);

            expect(t.atCalls()).toBe(3);
        });

        it('hides an empty slot and skips its bindings', () => {
            const t = setup(itemsWithIds(1, 2));

            // An emptied slot must not evaluate `item().id` on undefined
            t.items[1] = undefined;
            expect(() => refresh(t.list)).not.toThrow();
            expect(t.visible()).toEqual([true, false]);
        });

        it('builds a hole\'s view when it first fills, keeping slot i as child i, and keeps it', () => {
            const t = setup([{ id: 1 }, undefined, { id: 3 }]);
            expect(t.built).toEqual([0, 2]);
            expect(t.visible()).toEqual([true, false, true]);

            t.items[1] = { id: 2 };
            refresh(t.list);
            expect(t.built).toEqual([0, 2, 1]);
            expect(t.shown()).toEqual([labelB, labelA, labelB]);
            expect(t.visible()).toEqual([true, true, true]);

            const view = fixture.children(t.list)[1];
            t.items[1] = undefined;
            refresh(t.list);
            t.items[1] = { id: 5 };
            refresh(t.list);
            expect(t.built).toEqual([0, 2, 1]);
            expect(fixture.children(t.list)[1]).toBe(view);
            expect(t.shown()).toEqual([labelB, labelB, labelB]);
        });

        it('lets an item view read its item while it is being built, holes included', () => {
            const items: (Item | undefined)[] = [{ id: 1 }, undefined];
            const seen: number[] = [];
            const list = List<Item>({
                items,
                children: (item) => {
                    seen.push(item().id);
                    return target.createGroup();
                },
            });
            refresh(list);
            expect(seen).toEqual([1]);

            items[1] = { id: 2 };
            items.push({ id: 3 });
            refresh(list);
            expect([...seen].sort()).toEqual([1, 2, 3]);
        });

        it('builds a hole\'s view when it is reattached holding an item', () => {
            const t = setup([{ id: 1 }, undefined]);
            t.items.length = 1;
            refresh(t.list);

            t.items.push({ id: 2 });
            refresh(t.list);

            expect(t.built).toEqual([0, 1]);
            expect(t.shown()).toEqual([labelB, labelA]);
        });

        it('keeps refreshing a filled hole on later frames, when an ancestor is refreshed', () => {
            const t = setup([{ id: 1 }, undefined]);
            const root = jsx(Fragment, { children: t.list });
            refresh(root);

            t.items[1] = { id: 2 };
            refresh(root);
            expect(t.shown()).toEqual([labelB, labelA]);

            t.items[1] = { id: 5 };
            refresh(root);
            expect(t.shown()).toEqual([labelB, labelB]);
        });

        it('destroys a never-filled hole along with the list', () => {
            const t = setup([undefined, undefined, undefined]);
            const attached = fixture.children(t.list)[0];
            const detached = fixture.children(t.list)[2];
            t.items.length = 1;
            refresh(t.list);

            target.destroy(t.list);

            expect(t.built).toEqual([]);
            expect(fixture.isDestroyed(attached)).toBe(true);
            expect(fixture.isDestroyed(detached)).toBe(true);
        });

        it('accepts a plain array as the source', () => {
            const items = itemsWithIds(1, 2);
            const list = List<Item>({
                items,
                children: (item) => jsx(onChange.tag, { [onChange.key]: () => labelFor(item().id) }),
            });
            refresh(list);

            items.splice(0, 1);
            refresh(list);

            // Slot 0 now shows what was at index 1; slot 1 is past the length
            expect(fixture.children(list).map((c) => onChange.read(c))).toEqual([labelA]);
        });

        it('re-reads a getter every frame, so a replaced collection is followed', () => {
            let items = itemsWithIds(1, 2);
            const list = List<Item>({
                items: () => items,
                children: (item) => jsx(onChange.tag, { [onChange.key]: () => labelFor(item().id) }),
            });
            refresh(list);

            items = itemsWithIds(4);
            refresh(list);

            expect(fixture.children(list).map((c) => onChange.read(c))).toEqual([labelA]);
        });

        it('is inert until its first refresh: it reads nothing and builds nothing', () => {
            let built = 0;
            const list = List<Item>({
                items: () => {
                    throw new Error('items read at construction');
                },
                children: () => {
                    built++;
                    return target.createGroup();
                },
            });

            expect(fixture.children(list).length).toBe(0);
            expect(built).toBe(0);
        });

        it('calls a function length once per frame', () => {
            let count = 2;
            let lengthCalls = 0;
            const list = List<Item>({
                items: {
                    length: () => {
                        lengthCalls++;
                        return count;
                    },
                    at: (i) => ({ id: i }),
                },
                children: () => target.createGroup(),
            });

            count = 3;
            refresh(list);

            expect(lengthCalls).toBe(1);
            expect(fixture.children(list).length).toBe(3);
        });

        it('projects SlotList.slots directly, with a freed slot as a hole', () => {
            const bullets = createSlotList<{ id: number }>();
            const a = bullets.insert({ id: 2 });
            bullets.insert({ id: 3 });
            const list = List({
                items: bullets.slots,
                children: (slot) => jsx(onChange.tag, { [onChange.key]: () => labelFor(slot().value.id) }),
            });
            refresh(list);
            expect(fixture.children(list).map((c) => onChange.read(c))).toEqual([labelA, labelB]);

            bullets.remove(a);
            refresh(list);
            expect(fixture.children(list).map((c) => fixture.isVisible(c))).toEqual([false, true]);
        });

        it('projects OrderedSlotList.ordered in logical order', () => {
            const cards = createOrderedSlotList<number>();
            cards.append(2);
            cards.append(3);
            const list = List({
                items: cards.ordered,
                children: (slot) => jsx(onChange.tag, { [onChange.key]: () => labelFor(slot().value) }),
            });
            cards.move(1, 0);
            refresh(list);

            expect(fixture.children(list).map((c) => onChange.read(c))).toEqual([labelB, labelA]);
        });

        it('refreshes a hand-written slot view on the frame it is built', () => {
            const items: Item[] = [];
            let refreshes = 0;
            const list = List({
                items,
                children: () => {
                    const view = target.createGroup();
                    view.onRefresh = () => void refreshes++;
                    return view;
                },
            });

            items.push({ id: 1 });
            refresh(list);

            expect(refreshes).toBe(1);
        });

        it('never writes visibility to an occupied slot its own visible binding hides', () => {
            // Count every visibility write the list itself makes
            let writes = 0;
            const counting: JsxTarget<N> = {
                ...target,
                visible: { ...target.visible, apply: (el, v) => {
                    writes++;
                    target.visible.apply(el, v);
                } },
            };
            const CountingList = createList({ target: counting });
            const items = itemsWithIds(1, 2);
            const list = CountingList<Item>({
                items,
                children: (item) => jsx(fixture.everyFrame.tag, { visible: () => item().id !== 2 }),
            });
            refresh(list);
            writes = 0;

            refresh(list);
            refresh(list);

            expect(fixture.isVisible(fixture.children(list)[1])).toBe(false);
            expect(writes).toBe(0);
        });

        it('keeps a slot its own visible binding hides hidden when its item leaves and returns', () => {
            const items: (Item | undefined)[] = itemsWithIds(1, 2);
            const list = List<Item>({
                items,
                children: (item) => jsx(fixture.everyFrame.tag, { visible: () => item().id !== 2 }),
            });
            refresh(list);

            // The list hides the emptied slot, then shows it again behind the
            // binding's back; the binding must still win.
            const hidden = items[1];
            items[1] = undefined;
            refresh(list);
            items[1] = hidden;
            refresh(list);

            expect(fixture.isVisible(fixture.children(list)[1])).toBe(false);
        });

        it('counts one read of `items` and one presence check per slot', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            t.items[1] = undefined;

            // `items` + 3 presence checks + a binding for each of the 2 present items
            expect(countReads(() => refresh(t.list))).toBe(1 + 3 + 2);
        });

        it('builds into a container it is given', () => {
            const container = target.createGroup();
            const list = List<Item>({ items: itemsWithIds(1, 2), container, children: () => target.createGroup() });
            refresh(list);

            expect(list).toBe(container);
            expect(fixture.children(container).length).toBe(2);
        });

        it('passes its own container to ref', () => {
            let received: N | undefined;
            // Called the way compiled TSX calls it, which erases the attribute types
            const list = jsx(List as unknown as (attributes: Record<string, unknown>) => N, {
                items: [],
                children: () => target.createGroup(),
                ref: (el: N) => {
                    received = el;
                },
            });

            expect(received).toBe(list);
        });
    });
}

// --- <Switch> --------------------------------------------------------------

interface Boss { hp: number; isEnraged: boolean }

function describeSwitch<N extends SceneNode>({ fixture, jsx, Switch, Match }: SuiteContext<N>): void {
    const { target, onChange } = fixture;
    const refresh = target.refreshScene;
    const [valueA, valueB] = onChange.values;

    /** The motivating case: branches whose bindings are only valid when they apply. */
    function setup(options: { withDefault: boolean }) {
        const model: { boss?: Boss } = {};
        let whenCalls = 0;
        const enraged = jsx(onChange.tag, { [onChange.key]: () => (model.boss!.hp > 5 ? valueA : valueB) });
        const normal = jsx(onChange.tag, { [onChange.key]: () => (model.boss!.hp > 5 ? valueA : valueB) });
        const noBoss = jsx(onChange.tag, { [onChange.key]: valueA });
        const sw = Switch({
            children: [
                Match({
                    when: () => {
                        whenCalls++;
                        return model.boss?.isEnraged === true;
                    },
                    children: enraged,
                }),
                Match({
                    when: () => {
                        whenCalls++;
                        return model.boss !== undefined;
                    },
                    children: normal,
                }),
                ...(options.withDefault ? [Match({ else: true, children: noBoss })] : []),
            ],
        });
        return {
            sw,
            model,
            enraged,
            normal,
            whenCalls: () => whenCalls,
            resetWhenCalls: () => {
                whenCalls = 0;
            },
            /** Which branches are visible, in order: enraged, normal, then the default if any. */
            shown: () => fixture.children(sw).map((c) => fixture.isVisible(c)),
        };
    }

    describe('<Switch>', () => {
        it('is inert until its first refresh: no `when` is called at construction', () => {
            const t = setup({ withDefault: true });

            expect(t.whenCalls()).toBe(0);
            expect(t.shown()).toEqual([false, false, false]);
        });

        it('shows the default when no match holds, without running other branches\' bindings', () => {
            const t = setup({ withDefault: true });

            expect(() => refresh(t.sw)).not.toThrow();
            expect(t.shown()).toEqual([false, false, true]);
        });

        it('shows nothing when no match holds and there is no default', () => {
            const t = setup({ withDefault: false });

            refresh(t.sw);

            expect(t.shown()).toEqual([false, false]);
        });

        it('picks the first match that holds, and refreshes it that frame', () => {
            const t = setup({ withDefault: true });
            refresh(t.sw);

            t.model.boss = { hp: 9, isEnraged: false };
            refresh(t.sw);
            expect(t.shown()).toEqual([false, true, false]);
            expect(onChange.read(t.normal)).toBe(valueA);

            t.model.boss.isEnraged = true;
            t.model.boss.hp = 1;
            refresh(t.sw);
            expect(t.shown()).toEqual([true, false, false]);
            expect(onChange.read(t.enraged)).toBe(valueB);
        });

        it('stops calling `when` at the first that holds', () => {
            const t = setup({ withDefault: true });
            t.model.boss = { hp: 1, isEnraged: true };
            t.resetWhenCalls();

            refresh(t.sw);

            expect(t.whenCalls()).toBe(1);
        });

        it('counts each `when` it calls as a read; selecting the default reads nothing', () => {
            let isFirst = false;
            let isSecond = true;
            const sw = Switch({
                children: [
                    Match({ when: () => isFirst, children: jsx(onChange.tag, { [onChange.key]: () => valueA }) }),
                    Match({ when: () => isSecond, children: jsx(onChange.tag, { [onChange.key]: () => valueA }) }),
                    Match({ else: true, children: jsx(onChange.tag, { [onChange.key]: () => valueA }) }),
                ],
            });
            refresh(sw);

            expect(countReads(() => refresh(sw))).toBe(3);
            isSecond = false;
            expect(countReads(() => refresh(sw))).toBe(3);
            isFirst = true;
            expect(countReads(() => refresh(sw))).toBe(2);
        });

        it('never restructures: switching only changes visibility', () => {
            const t = setup({ withDefault: true });
            refresh(t.sw);
            const before = fixture.children(t.sw).slice();

            t.model.boss = { hp: 1, isEnraged: false };
            refresh(t.sw);
            t.model.boss = undefined;
            refresh(t.sw);

            expect(fixture.children(t.sw)).toEqual(before);
        });

        it('builds a function child on first selection only, and refreshes it that frame', () => {
            let isOn = false;
            let builds = 0;
            const sw = Switch({
                children: Match({
                    when: () => isOn,
                    children: () => {
                        builds++;
                        return jsx(onChange.tag, { [onChange.key]: () => valueB });
                    },
                }),
            });

            refresh(sw);
            expect(builds).toBe(0);

            isOn = true;
            refresh(sw);
            expect(builds).toBe(1);
            expect(onChange.read(fixture.children(fixture.children(sw)[0])[0])).toBe(valueB);

            isOn = false;
            refresh(sw);
            isOn = true;
            refresh(sw);
            expect(builds).toBe(1);
        });

        it('rejects a child that is not a <Match>', () => {
            expect(() => Switch({ children: target.createGroup() })).toThrow(/<Match>/);
        });

        it('rejects a <Match> outside a <Switch> on its first refresh', () => {
            const orphan = Match({ when: () => true, children: target.createGroup() });

            expect(() => refresh(orphan)).toThrow(/<Switch>/);
        });

        it('requires <Match else> to be last, and only once', () => {
            expect(() => Switch({
                children: [
                    Match({ else: true, children: target.createGroup() }),
                    Match({ when: () => true, children: target.createGroup() }),
                ],
            })).toThrow(/last/);
            expect(() => Switch({
                children: [
                    Match({ else: true, children: target.createGroup() }),
                    Match({ else: true, children: target.createGroup() }),
                ],
            })).toThrow(/last/);
        });

        it('can make an unhandled case an error, via a default child that throws', () => {
            let kind: 'asteroid' | 'comet' = 'asteroid';
            const sw = Switch({
                children: [
                    Match({ when: () => kind === 'asteroid', children: target.createGroup() }),
                    Match({
                        else: true,
                        children: () => {
                            throw new Error(`Unhandled kind: ${kind}`);
                        },
                    }),
                ],
            });

            expect(() => refresh(sw)).not.toThrow();
            kind = 'comet';
            expect(() => refresh(sw)).toThrow('Unhandled kind: comet');
        });

        it('is typed as exclusive with `when`, so neither or both does not compile', () => {
            // The assertions here are the @ts-expect-error lines: type-checking
            // fails if either of these ever compiles
            // @ts-expect-error neither `when` nor `else`
            const neither = () => Match({ children: target.createGroup() });
            // @ts-expect-error both `when` and `else`
            const both = () => Match({ when: () => true, else: true });
            expect(neither).toBeTypeOf('function');
            expect(both).toBeTypeOf('function');
        });
    });
}
