import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshScene, updateScene } from '../pixi-mvt';
import { jsx } from './jsx-runtime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jsx runtime', () => {
    it('applies static props at construction', () => {
        const el = jsx('container', { x: 3, label: 'fixed' });

        expect(el.x).toBe(3);
        expect(el.label).toBe('fixed');
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

    it('installs an onUpdate prop as the element\'s update hook, not a binding', () => {
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
