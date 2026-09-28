import { type Container, type Graphics, Rectangle, type Sprite, type Text, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { countReads, readCounter, refreshScene, SKIP_DESCENDANTS, updateScene } from '../pixi-mvt';
import { jsx } from './jsx-runtime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jsx runtime', () => {
    it('applies static attributes at construction', () => {
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

    it('applies tint to graphics, fixed or as a binding', () => {
        let tint = 0xff0000;
        const fixed = jsx('graphics', { tint: 0x00ff00 }) as Graphics;
        const bound = jsx('graphics', { tint: () => tint }) as Graphics;

        expect(fixed.tint).toBe(0x00ff00);

        refreshScene(bound);
        expect(bound.tint).toBe(0xff0000);

        tint = 0x0000ff;
        refreshScene(bound);
        expect(bound.tint).toBe(0x0000ff);
    });

    it('applies scaleX and scaleY, fixed or as bindings, separately', () => {
        let scaleY = 3;
        const el = jsx('container', { scaleX: 2, scaleY: () => scaleY });

        expect(el.scale.x).toBe(2);
        expect(el.scale.y).toBe(1); // Pixi's default until the first refresh

        refreshScene(el);
        expect(el.scale.x).toBe(2);
        expect(el.scale.y).toBe(3);

        scaleY = 0.5;
        refreshScene(el);
        expect(el.scale.y).toBe(0.5);
    });

    it('applies anchorX and anchorY separately, on sprites and text', () => {
        const sprite = jsx('sprite', { anchorX: 0.5, anchorY: 1 }) as Sprite;
        const text = jsx('text', { anchor: 0.5, anchorY: 0 }) as Text;

        expect(sprite.anchor.x).toBe(0.5);
        expect(sprite.anchor.y).toBe(1);
        expect(text.anchor.x).toBe(0.5);
        expect(text.anchor.y).toBe(0);
    });

    it('writes fractional width and height bindings only when they change, per element', () => {
        // Same keys in the same order, so both share one compiled function,
        // which keeps these last values in a typed array rather than closure
        // variables. Height starts at 0, which the first refresh must still write.
        let width = 10.25;
        let height = 0;
        const a = jsx('sprite', { texture: Texture.WHITE, width: () => width, height: () => height, label: () => 'a' }) as Sprite;
        const b = jsx('sprite', { texture: Texture.WHITE, width: () => 3.5, height: () => 7.75, label: () => 'b' }) as Sprite;

        refreshScene(a);
        refreshScene(b);
        expect(a.width).toBeCloseTo(10.25);
        expect(a.height).toBe(0);
        expect(a.label).toBe('a');
        expect(b.width).toBeCloseTo(3.5);
        expect(b.height).toBeCloseTo(7.75);

        a.width = 99;
        refreshScene(a);
        expect(a.width).toBe(99);

        width = 10.62;
        height = 4.5;
        refreshScene(a);
        expect(a.width).toBeCloseTo(10.62);
        expect(a.height).toBeCloseTo(4.5);
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

    it('installs an onUpdate attribute as the element\'s update method, not a binding', () => {
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

    describe('onRefresh attribute', () => {
        it('installs the step as the refresh method of an element with no bindings', () => {
            let calls = 0;
            const el = jsx('container', {
                onRefresh: () => {
                    calls++;
                },
            });

            refreshScene(el);
            refreshScene(el);
            expect(calls).toBe(2);
        });

        it('runs after the element\'s bindings, not as a binding itself', () => {
            const order: string[] = [];
            const el = jsx('container', {
                onRefresh: () => { order.push('step'); },
                x: () => {
                    order.push('x');
                    return 1;
                },
            });

            refreshScene(el);
            expect(order).toEqual(['x', 'step']);
            expect(el.x).toBe(1);
        });

        it('receives the element', () => {
            let received: Container | undefined;
            const el = jsx('graphics', {
                onRefresh: (g: Container) => {
                    received = g;
                },
            });

            refreshScene(el);
            expect(received).toBe(el);
        });

        it('is skipped while a visible binding hides the element', () => {
            let visible = false;
            let calls = 0;
            const el = jsx('container', {
                visible: () => visible,
                onRefresh: () => {
                    calls++;
                },
            });

            refreshScene(el);
            expect(calls).toBe(0);

            visible = true;
            refreshScene(el);
            expect(calls).toBe(1);
        });

        it('can skip the element\'s descendants', () => {
            let childX = 0;
            const child = jsx('container', { x: () => childX });
            const parent = jsx('container', {
                x: () => 1,
                onRefresh: () => SKIP_DESCENDANTS,
                children: child,
            });

            childX = 5;
            refreshScene(parent);
            expect(child.x).toBe(0);
        });
    });

    describe('onDestroyed attribute', () => {
        it('runs once, with the element, when the element is destroyed', () => {
            const received: Container[] = [];
            const el = jsx('graphics', { onDestroyed: (g: Container) => received.push(g) });

            el.destroy();
            el.destroy();
            expect(received).toEqual([el]);
        });

        it('is not a binding: a refresh neither calls nor installs it', () => {
            let calls = 0;
            const el = jsx('container', {
                onDestroyed: () => {
                    calls++;
                },
            });

            expect(el.onRefresh).toBeUndefined();
            refreshScene(el);
            expect(calls).toBe(0);
        });

        it('runs when an ancestor is destroyed with its children', () => {
            let calls = 0;
            const child = jsx('container', {
                onDestroyed: () => {
                    calls++;
                },
            });
            const parent = jsx('container', { children: jsx('container', { children: child }) });

            parent.destroy({ children: true });
            expect(calls).toBe(1);
        });

        it('does not run when an ancestor is destroyed without its children', () => {
            let calls = 0;
            const child = jsx('container', {
                onDestroyed: () => {
                    calls++;
                },
            });
            const parent = jsx('container', { children: child });

            parent.destroy();
            expect(calls).toBe(0);
            expect(child.destroyed).toBe(false);
        });
    });

    it('wires pointer event attributes as listeners and makes the element interactive', () => {
        const received: string[] = [];
        const el = jsx('container', {
            onPointerMove: () => received.push('move'),
            onGlobalPointerMove: () => received.push('global move'),
            onPointerUpOutside: () => received.push('up outside'),
            onPointerCancel: () => received.push('cancel'),
            onWheel: () => received.push('wheel'),
        });

        el.emit('pointermove', {} as never);
        el.emit('globalpointermove', {} as never);
        el.emit('pointerupoutside', {} as never);
        el.emit('pointercancel', {} as never);
        el.emit('wheel', {} as never);

        expect(el.eventMode).toBe('static');
        expect(received).toEqual(['move', 'global move', 'up outside', 'cancel', 'wheel']);
    });

    describe('eventMode attribute', () => {
        it('wins over the default an event handler attribute sets', () => {
            const el = jsx('container', { eventMode: 'dynamic', onPointerTap: () => {} });

            expect(el.eventMode).toBe('dynamic');
        });

        it('applies without any event handler attribute', () => {
            const el = jsx('container', { eventMode: 'none' });

            expect(el.eventMode).toBe('none');
        });
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

    describe('read counting', () => {
        it('counts every function attribute read while counting, and only the visible read while hidden', () => {
            let isShown = true;
            const el = jsx('container', { visible: () => isShown, x: () => 1, label: () => 'a' });

            expect(countReads(() => refreshScene(el))).toBe(3);
            isShown = false;
            expect(countReads(() => refreshScene(el))).toBe(1);
        });

        it('counts nothing while off', () => {
            const el = jsx('container', { x: () => 1, y: () => 2 });
            const before = readCounter.count;

            refreshScene(el);

            expect(readCounter.isCounting).toBe(false);
            expect(readCounter.count).toBe(before);
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
