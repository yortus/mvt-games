import { type Graphics, Rectangle, type Sprite, type Text, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/utils';
import { jsx } from './jsx-runtime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jsx runtime', () => {
    it('writes a tint binding only when it changes', () => {
        let tint = 0xff0000;
        const el = jsx('sprite', { tint: () => tint }) as Sprite;

        refreshView(el);
        expect(el.tint).toBe(0xff0000);

        el.tint = 0x00ff00;
        refreshView(el);
        expect(el.tint).toBe(0x00ff00);

        tint = 0x0000ff;
        refreshView(el);
        expect(el.tint).toBe(0x0000ff);
    });

    it('applies tint to graphics, fixed or as a binding', () => {
        let tint = 0xff0000;
        const fixed = jsx('graphics', { tint: 0x00ff00 }) as Graphics;
        const bound = jsx('graphics', { tint: () => tint }) as Graphics;

        expect(fixed.tint).toBe(0x00ff00);

        refreshView(bound);
        expect(bound.tint).toBe(0xff0000);

        tint = 0x0000ff;
        refreshView(bound);
        expect(bound.tint).toBe(0x0000ff);
    });

    it('applies scaleX and scaleY, fixed or as bindings, separately', () => {
        let scaleY = 3;
        const el = jsx('container', { scaleX: 2, scaleY: () => scaleY });

        expect(el.scale.x).toBe(2);
        expect(el.scale.y).toBe(1); // Pixi's default until the first refresh

        refreshView(el);
        expect(el.scale.x).toBe(2);
        expect(el.scale.y).toBe(3);

        scaleY = 0.5;
        refreshView(el);
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

        refreshView(a);
        refreshView(b);
        expect(a.width).toBeCloseTo(10.25);
        expect(a.height).toBe(0);
        expect(a.label).toBe('a');
        expect(b.width).toBeCloseTo(3.5);
        expect(b.height).toBeCloseTo(7.75);

        a.width = 99;
        refreshView(a);
        expect(a.width).toBe(99);

        width = 10.62;
        height = 4.5;
        refreshView(a);
        expect(a.width).toBeCloseTo(10.62);
        expect(a.height).toBeCloseTo(4.5);
    });

    describe('onDestroyed attribute', () => {
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

        refreshView(el);
        expect(el.cursor).toBe('pointer');

        cursor = 'crosshair';
        refreshView(el);
        expect(el.cursor).toBe('crosshair');
    });
});
