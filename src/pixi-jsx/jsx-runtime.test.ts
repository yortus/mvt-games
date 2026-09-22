import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshScene } from '../pixi-mvt';
import { jsx } from './jsx-runtime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jsx runtime', () => {
    it('applies dynamic bindings at construction and on each refresh', () => {
        let x = 1;
        const el = jsx('container', { x: () => x });
        expect(el.x).toBe(1);

        x = 5;
        refreshScene(el);
        expect(el.x).toBe(5);
    });

    it('writes watched bindings only when their value changes', () => {
        let label = 'a';
        const el = jsx('container', { label: () => label });

        // A direct write is left alone while the binding is unchanged...
        el.label = 'overwritten';
        refreshScene(el);
        expect(el.label).toBe('overwritten');

        // ...and replaced once it changes
        label = 'b';
        refreshScene(el);
        expect(el.label).toBe('b');
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

            // A hidden element still runs its own hook, so it can show itself
            visible = true;
            refreshScene(parent);
            expect(parent.visible).toBe(true);
            expect(child.x).toBe(7);
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
