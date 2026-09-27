import { Container, Texture } from 'pixi.js';
import { Container as SolidContainer, Sprite } from 'pixi-solid';
import { createComponent, createMemo, createRoot, Index } from 'solid-js';
import type { Grains } from '../models';
import { pickGrainTint } from './grain-colors';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SolidGrainSpritesViewBindings {
    /** Every grain, addressed by id. Its reads must be tracked (a `'store'` model), or nothing ever updates. */
    grains: () => Grains;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grains as a sprite per grain, as a SolidJS developer would write it
 * with pixi-solid: an `<Index>` over the grain ids, each a `<Sprite>` whose
 * props read its grain. Solid tracks those reads, so a sprite's props are
 * set again only when its grain changes. Nothing is polled: this view has
 * no refresh, and a settled tank costs it nothing per frame. Drawn in cells,
 * like `GrainSpritesView`.
 *
 * The tree is built in its own Solid root, inside an ordinary Pixi
 * container, and disposed with it.
 *
 * A Solid developer would write the tree as JSX:
 *
 * ```tsx
 * const grainSprites = (
 *     <SolidContainer>
 *         <Index each={ids()}>
 *             {(_item, id) => (
 *                 <Sprite
 *                     texture={Texture.WHITE}
 *                     width={1}
 *                     height={1}
 *                     visible={bindings.grains().at(id) !== undefined}
 *                     x={colOf(bindings.grains(), id)}
 *                     y={rowOf(bindings.grains(), id)}
 *                     tint={tintOf(bindings.grains(), id)}
 *                 />
 *             )}
 *         </Index>
 *     </SolidContainer>
 * );
 * ```
 *
 * The code below is exactly what Solid's JSX compiler (`babel-preset-solid`
 * 1.9.15) turns that into, checked against the compiler's output: the same
 * `createComponent` calls, a getter for every attribute the compiler cannot
 * prove unchanging (including `Texture.WHITE`, since any property read might
 * be reactive), and plain values for the rest. So it runs exactly as the
 * JSX would. It is written out by hand only so that this repo needs neither
 * Solid's compiler nor the Babel toolchain it runs on. The repo's own JSX
 * runtime needs no compiler beyond the TypeScript transform every build
 * already has.
 *
 * When editing, keep it in that form: an attribute that reads state must
 * stay a getter, or it is read once and never updates.
 */
export function SolidGrainSpritesView(bindings: SolidGrainSpritesViewBindings): Container {
    const host = new Container();

    createRoot((dispose) => {
        host.on('destroyed', dispose);

        // One id per slot, up to the highest in use; remade only when that changes.
        const ids = createMemo(() => idsBelow(bindings.grains().length));

        const grainSprites = createComponent(SolidContainer, {
            get children() {
                return createComponent(Index, {
                    get each() { return ids(); },
                    children: (_item: () => number, id: number) => createComponent(Sprite, {
                        get texture() { return Texture.WHITE; },
                        width: 1,
                        height: 1,
                        get visible() { return bindings.grains().at(id) !== undefined; },
                        get x() { return colOf(bindings.grains(), id); },
                        get y() { return rowOf(bindings.grains(), id); },
                        get tint() { return tintOf(bindings.grains(), id); },
                    }),
                });
            },
        });
        // pixi-solid returns Pixi objects, typed as Solid's DOM elements.
        host.addChild(grainSprites as unknown as Container);
    });

    return host;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function idsBelow(length: number): number[] {
    const ids: number[] = [];
    for (let id = 0; id < length; id++) ids.push(id);
    return ids;
}

// A slot's grain may be gone: its props read the grain only while it is there.

function colOf(grains: Grains, id: number): number {
    return grains.at(id) === undefined ? 0 : grains.colOf(id);
}

function rowOf(grains: Grains, id: number): number {
    return grains.at(id) === undefined ? 0 : grains.rowOf(id);
}

function tintOf(grains: Grains, id: number): number {
    return grains.at(id) === undefined ? 0xffffff : pickGrainTint(grains.kindOf(id), id);
}
