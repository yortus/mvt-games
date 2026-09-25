import { type Container, Rectangle, type Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshScene, updateScene } from '../pixi-mvt';
import { countPropReads, propReadCounter } from './prop-reads';
import { jsx } from './jsx-runtime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jsx runtime', () => {
    it('applies static props at construction', () => {
        const el = jsx('container', { x: 3, label: 'fixed', isRenderGroup: true });

        expect(el.x).toBe(3);
        expect(el.label).toBe('fixed');
        expect(el.isRenderGroup).toBe(true);
    });

    it('runs no binding at construction, only from the first refresh on', () => {
        let reads = 0;
        let x = 1;
        const el = jsx('container', {
            x: () => {
                reads++;
                return x;
            },
        });
        expect(reads).toBe(0);
        expect(el.x).toBe(0); // Pixi's default until the first refresh

        refreshScene(el);
        expect(el.x).toBe(1);

        x = 5;
        refreshScene(el);
        expect(el.x).toBe(5);
    });

    it('lets a skipping ancestor keep a not-yet-valid binding from ever running', () => {
        // The motivating case: a binding that throws until its data exists
        const model: { boss?: { hp: number } } = {};
        const child = jsx('text', { text: () => `HP ${model.boss!.hp}` });
        const parent = jsx('container', { visible: () => model.boss !== undefined, children: child });

        expect(() => refreshScene(parent)).not.toThrow();

        model.boss = { hp: 9 };
        refreshScene(parent);
        expect((child as unknown as { text: string }).text).toBe('HP 9');
    });

    it('writes a watched binding on the first refresh, then only when it changes', () => {
        let label = 'a';
        const el = jsx('container', { label: () => label });

        refreshScene(el);
        expect(el.label).toBe('a');

        // A direct write is left alone while the binding is unchanged...
        el.label = 'overwritten';
        refreshScene(el);
        expect(el.label).toBe('overwritten');

        // ...and replaced once it changes
        label = 'b';
        refreshScene(el);
        expect(el.label).toBe('b');
    });

    it('writes a tint binding only when it changes', () => {
        let tint = 0xff0000;
        const el = jsx('sprite', { tint: () => tint }) as Sprite;

        refreshScene(el);
        expect(el.tint).toBe(0xff0000);

        el.tint = 0x00ff00;
        refreshScene(el);
        expect(el.tint).toBe(0x00ff00);

        tint = 0x0000ff;
        refreshScene(el);
        expect(el.tint).toBe(0x0000ff);
    });

    it('keeps per-element state separate when elements share a binding shape', () => {
        // Same keys in the same order, so both reuse one compiled function
        let x1 = 1;
        const x2 = 2;
        const label1 = 'one';
        let label2 = 'two';
        const a = jsx('container', { x: () => x1, label: () => label1 });
        const b = jsx('container', { x: () => x2, label: () => label2 });

        x1 = 10;
        label2 = 'TWO';
        refreshScene(a);
        refreshScene(b);

        expect(a.x).toBe(10);
        expect(a.label).toBe('one');
        expect(b.x).toBe(2);
        expect(b.label).toBe('TWO');
    });

    describe('visible binding', () => {
        it('skips the element\'s other bindings while hidden', () => {
            let visible = true;
            let xReads = 0;
            const el = jsx('container', {
                // Declared after x on purpose: visible is still evaluated first
                x: () => {
                    xReads++;
                    return 3;
                },
                visible: () => visible,
            });
            xReads = 0;

            visible = false;
            refreshScene(el);
            expect(el.visible).toBe(false);
            expect(xReads).toBe(0);
        });

        it('skips the whole subtree while hidden, and resumes when shown', () => {
            let visible = true;
            let childX = 0;
            const child = jsx('container', { x: () => childX });
            const parent = jsx('container', { visible: () => visible, children: child });

            visible = false;
            childX = 7;
            refreshScene(parent);
            expect(child.x).toBe(0);

            // A hidden element still runs its own `onRefresh`, so it can show itself
            visible = true;
            refreshScene(parent);
            expect(parent.visible).toBe(true);
            expect(child.x).toBe(7);
        });
    });

    it('installs an onUpdate prop as the element\'s update method, not a binding', () => {
        const deltas: number[] = [];
        const el = jsx('container', {
            onUpdate: (deltaMs: number) => {
                deltas.push(deltaMs);
            },
        });

        refreshScene(el);
        expect(deltas).toEqual([]);

        updateScene(el, 16);
        updateScene(el, 17);
        expect(deltas).toEqual([16, 17]);
    });

    it('wires pointer event props as listeners and makes the element interactive', () => {
        const received: string[] = [];
        const el = jsx('container', {
            onPointerMove: () => received.push('move'),
            onGlobalPointerMove: () => received.push('global move'),
            onPointerUpOutside: () => received.push('up outside'),
            onPointerCancel: () => received.push('cancel'),
        });

        el.emit('pointermove', {} as never);
        el.emit('globalpointermove', {} as never);
        el.emit('pointerupoutside', {} as never);
        el.emit('pointercancel', {} as never);

        expect(el.eventMode).toBe('static');
        expect(received).toEqual(['move', 'global move', 'up outside', 'cancel']);
    });

    it('applies hitArea statically and cursor as a binding', () => {
        const hitArea = new Rectangle(0, 0, 10, 20);
        let cursor: 'pointer' | 'crosshair' = 'pointer';
        const el = jsx('container', { hitArea, cursor: () => cursor });

        expect(el.hitArea).toBe(hitArea);

        refreshScene(el);
        expect(el.cursor).toBe('pointer');

        cursor = 'crosshair';
        refreshScene(el);
        expect(el.cursor).toBe('crosshair');
    });

    describe('prop read counting', () => {
        it('counts every prop read while counting, and only the visible read while hidden', () => {
            let isShown = true;
            const el = jsx('container', { visible: () => isShown, x: () => 1, label: () => 'a' });

            expect(countPropReads(() => refreshScene(el))).toBe(3);
            isShown = false;
            expect(countPropReads(() => refreshScene(el))).toBe(1);
        });

        it('counts nothing while off', () => {
            const el = jsx('container', { x: () => 1, y: () => 2 });
            const before = propReadCounter.count;

            refreshScene(el);

            expect(propReadCounter.isCounting).toBe(false);
            expect(propReadCounter.count).toBe(before);
        });

        it('restores the previous on/off state after counting', () => {
            propReadCounter.isCounting = true;
            try {
                countPropReads(() => undefined);
                expect(propReadCounter.isCounting).toBe(true);
            }
            finally {
                propReadCounter.isCounting = false;
            }
        });
    });

    it('calls ref with the constructed element', () => {
        let received: Container | undefined;
        const el = jsx('container', {
            ref: (c: Container) => {
                received = c;
            },
        });
        expect(received).toBe(el);
    });
});
