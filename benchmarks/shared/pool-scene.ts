import { Container } from 'pixi.js';
import { createSlotList, type Slot } from '../../src/common';
import { jsx, List } from '../../src/pixi-jsx';
import { refreshScene } from '../../src/pixi-mvt';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Short-lived items, like bullets, held in a `SlotList`. `spawnPerFrame` items
 * appear each frame, and each lives long enough that about 500 are alive at
 * once.
 *
 * - `list`: `<List>` projects the slots. It builds one container per slot the
 *   first time the slot is used, and reuses it for every later item.
 * - `rebuild`: a hand-written view builds a container when an item appears,
 *   and destroys it when the item goes.
 *
 * Both allocate a new model record per item.
 *
 * Returns one frame: the model advances, then the view catches up.
 */
export function createPoolFrame(poolApproach: string, spawnPerFrame: number): () => void {
    const lifetime = Math.round(LIVE_TARGET / spawnPerFrame);
    const bullets = createSlotList<Bullet>();
    const root = new Container();

    if (poolApproach === 'list') {
        root.addChild(jsx(List as never, {
            items: bullets.slots,
            children: (slot: () => Slot<Bullet>) => jsx('container', {
                x: () => slot().value.x,
                y: () => slot().value.y,
            }),
        }));
    }
    else if (poolApproach === 'rebuild') {
        root.onRefresh = createRebuildingView(root, bullets.slots);
    }
    else {
        throw new Error(`unknown approach: ${poolApproach}`);
    }

    let spawned = 0;
    const advance = (bullet: Bullet, slot: Slot<Bullet>): void => {
        bullet.age++;
        bullet.x += 2;
        if (bullet.age >= lifetime) bullets.remove(slot);
    };
    return () => {
        bullets.forEachLive(advance);
        for (let i = 0; i < spawnPerFrame; i++) {
            spawned++;
            bullets.insert({ x: 0, y: spawned % 480, age: 0 });
        }
        bullets.update(16);
        refreshScene(root);
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LIVE_TARGET = 500;

interface Bullet {
    x: number;
    y: number;
    age: number;
}

/** A hand-written view that keeps one container per live slot, building and destroying as slots change. */
function createRebuildingView(root: Container, slots: { readonly length: number; at(index: number): Slot<Bullet> | undefined }): () => void {
    const views: (Container | undefined)[] = [];
    const shown: (Slot<Bullet> | undefined)[] = [];
    return () => {
        const length = Math.max(slots.length, views.length);
        for (let i = 0; i < length; i++) {
            const slot = i < slots.length ? slots.at(i) : undefined;
            if (slot !== shown[i]) {
                views[i]?.destroy();
                views[i] = undefined;
                shown[i] = slot;
                if (slot !== undefined) {
                    const view = new Container();
                    root.addChild(view);
                    views[i] = view;
                }
            }
            const view = views[i];
            if (view !== undefined && slot !== undefined) {
                view.x = slot.value.x;
                view.y = slot.value.y;
            }
        }
    };
}
