import { Container, type Sprite, type Text, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { countReads } from '#mvt-utils';
import { createJsx } from '#mvt-utils/jsx';
import { refreshScene } from '../container-mixin';
import { jsx } from './jsx-runtime';
import { List } from './list';
import { pixiElements } from './pixi-elements';
import { pixiTarget } from './pixi-target';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pixiTarget', () => {
    describe('refresh methods', () => {
        /**
         * A scripted run over Pixi elements using every write kind: each frame,
         * the properties the bindings write, and the reads counted. With
         * `ownCopyAt` 1, each shape has a copy of the refresh code of its own.
         */
        function script(ownCopyAt?: number): string[] {
            const runtime = createJsx({ target: pixiTarget, elements: pixiElements, ownCopyAt }).jsx;
            const state = { isShown: true, x: 0, scale: 1, tint: 0xff0000, width: 10.5, label: 'a', text: 'one' };
            const sprite = runtime('sprite', {
                texture: Texture.WHITE,
                x: () => state.x,
                tint: () => state.tint,
                width: () => state.width,
                label: () => state.label,
            }) as Sprite;
            // `scale` is on the text, not the sprite: Pixi's `width` setter
            // writes the scale, so the two fight on one element.
            const text = runtime('text', { text: () => state.text, scale: () => state.scale }) as Text;
            const root = runtime('container', { visible: () => state.isShown, children: [sprite, text] });

            const frames: string[] = [];
            const changes: (() => void)[] = [
                () => {},
                () => Object.assign(state, { x: 3, scale: 2 }),
                () => Object.assign(state, { tint: 0x00ff00, width: 12.25, label: 'b' }),
                () => Object.assign(state, { isShown: false, text: 'two' }),
                () => Object.assign(state, { isShown: true }),
            ];
            for (const change of changes) {
                change();
                const reads = countReads(() => refreshScene(root));
                frames.push([
                    root.visible, sprite.x, text.scale.y, sprite.tint, sprite.width.toFixed(2), sprite.label, text.text,
                    `reads ${reads}`,
                ].join(' '));
            }
            return frames;
        }

        it('leave Pixi elements in the same state, with the same read counts, in the shared copy and in own copies', () => {
            const shared = script();

            expect(script(1)).toEqual(shared);
            expect(shared[3]).toMatch(/^false .* one reads 1$/);
            expect(shared[4]).toBe('true 3 2 65280 12.25 b two reads 7');
        });
    });

    it('writes a style binding when it changes', () => {
        let style = { fontSize: 12 };
        const text = jsx('text', { text: 'x', style: () => style }) as Text;

        refreshScene(text);
        expect(text.style.fontSize).toBe(12);

        style = { fontSize: 20 };
        refreshScene(text);
        expect(text.style.fontSize).toBe(20);
    });

    it('rejects a function for an attribute that takes only a fixed value', () => {
        expect(() => jsx('sprite', { anchor: () => 0.5 })).toThrow(/'anchor' takes a fixed value in pixi-mvt\/jsx/);
    });

    it('rejects an attribute the element does not have', () => {
        // `anchor` is defined only on sprites and text
        expect(() => jsx('container', { anchor: 0.5 })).toThrow(/<container> has no attribute 'anchor' in pixi-mvt\/jsx/);
    });

    it('lets <List> build into a container it is given', () => {
        const container = new Container({ sortableChildren: true });
        const items = [1, 2, 3];
        const list = List<number>({
            items,
            container,
            children: (item) => jsx('container', { label: () => `item-${item()}` }),
        });

        expect(list).toBe(container);
        refreshScene(list);
        expect(container.children.map((c) => c.label)).toEqual(['item-1', 'item-2', 'item-3']);
        expect(container.sortableChildren).toBe(true);

        items.length = 1;
        refreshScene(list);
        expect(container.children.map((c) => c.label)).toEqual(['item-1']);
    });
});
