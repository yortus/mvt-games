import { Container, Graphics, Sprite } from 'pixi.js';
import { watch } from '#mvt-utils';
import { textures } from '../data';
import type { Direction } from '../models';
import { setTickMethods } from '../../../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DiggerViewBindings {
    row: () => number;
    col: () => number;
    direction: () => Direction;
    isAlive: () => boolean;
    isHarpoonExtended: () => boolean;
    harpoonDistance: () => number;
    tileSize: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function DiggerView(bindings: DiggerViewBindings): Container {
    const watcher = watch({
        direction: bindings.direction,
        tileSize: bindings.tileSize,
        alive: bindings.isAlive,
        harpoon: bindings.isHarpoonExtended,
    });

    const digger = textures.get().digger;
    let sprite: Sprite;
    let harpoonGfx: Graphics;

    const view = new Container();
    initialiseView();
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: digger.idle, anchor: 0.5 });
        harpoonGfx = new Graphics();
        view.addChild(sprite);
        view.addChild(harpoonGfx);
    }

    function refresh(): void {
        const watched = watcher.poll();

        const ts = bindings.tileSize();
        const col = bindings.col();
        const row = bindings.row();
        const dir = bindings.direction();
        const x = col * ts + ts / 2;
        const y = row * ts + ts / 2;
        view.position.set(x, y);

        if (watched.alive.changed) {
            view.visible = watched.alive.value;
        }
        if (!bindings.isAlive()) return;

        if (watched.tileSize.changed) {
            sprite.scale.set(ts / 20);
        }

        // Determine pose texture
        // Use fractional distance from tile centre as walk cycle input
        const progress = Math.abs(col - Math.round(col)) + Math.abs(row - Math.round(row));
        if (bindings.isHarpoonExtended()) {
            sprite.texture = digger.pump;
        }
        else if (progress < 0.01) {
            sprite.texture = digger.idle;
        }
        else {
            sprite.texture = Math.sin(progress * Math.PI * 4) > 0 ? digger.walkB : digger.walkA;
        }

        // Direction: flip horizontally for left, rotate for up/down
        if (dir === 'left') {
            view.scale.x = -1;
            view.rotation = 0;
        }
        else if (dir === 'up') {
            view.scale.x = 1;
            view.rotation = -Math.PI / 2;
        }
        else if (dir === 'down') {
            view.scale.x = 1;
            view.rotation = Math.PI / 2;
        }
        else {
            view.scale.x = 1;
            view.rotation = 0;
        }

        // Harpoon line (stays procedural - variable length)
        harpoonGfx.clear();
        if (bindings.isHarpoonExtended()) {
            const dist = bindings.harpoonDistance();
            const harpoonLen = dist * ts;
            if (harpoonLen >= 1) {
                const startX = ts * 0.35;
                harpoonGfx
                    .moveTo(startX, -1)
                    .lineTo(startX + harpoonLen, -1)
                    .moveTo(startX, 1)
                    .lineTo(startX + harpoonLen, 1)
                    .stroke({ color: 0xffffff, width: 1 });

                const tipX = startX + harpoonLen;
                harpoonGfx
                    .moveTo(tipX, -4)
                    .lineTo(tipX + 6, 0)
                    .lineTo(tipX, 4)
                    .closePath()
                    .fill(0xff2222);
            }
        }
    }
}
