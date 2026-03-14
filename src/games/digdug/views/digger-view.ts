import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface DiggerViewTextures {
    readonly idle: Texture;
    readonly walkA: Texture;
    readonly walkB: Texture;
    readonly pump: Texture;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DiggerViewBindings {
    getRow(): number;
    getCol(): number;
    getDirection(): Direction;
    isAlive(): boolean;
    isHarpoonExtended(): boolean;
    getHarpoonDistance(): number;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDiggerView(
    bindings: DiggerViewBindings,
    textures: DiggerViewTextures,
): Container {
    const watcher = watch({
        direction: bindings.getDirection,
        tileSize: bindings.getTileSize,
        alive: bindings.isAlive,
        harpoon: bindings.isHarpoonExtended,
    });

    const view = new Container();
    const sprite = new Sprite({ texture: textures.idle, anchor: 0.5 });
    const harpoonGfx = new Graphics();
    view.addChild(sprite);
    view.addChild(harpoonGfx);

    let prevPose: 'idle' | 'walk-a' | 'walk-b' | 'pump' = 'idle';

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        const ts = bindings.getTileSize();
        const col = bindings.getCol();
        const row = bindings.getRow();
        const dir = bindings.getDirection();
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

        // Determine pose
        const harpoonChanged = watched.harpoon.changed;
        const dirChanged = watched.direction.changed;
        const isHarpoon = bindings.isHarpoonExtended();

        // Use fractional distance from tile centre as walk cycle input
        const progress = Math.abs(col - Math.round(col)) + Math.abs(row - Math.round(row));

        let pose: 'idle' | 'walk-a' | 'walk-b' | 'pump';
        if (isHarpoon) {
            pose = 'pump';
        } else if (progress < 0.01) {
            pose = 'idle';
        } else {
            pose = Math.sin(progress * Math.PI * 4) > 0 ? 'walk-b' : 'walk-a';
        }

        if (pose !== prevPose || dirChanged || harpoonChanged) {
            prevPose = pose;
            // prettier-ignore
            switch (pose) {
                case 'idle':   sprite.texture = textures.idle;   break;
                case 'walk-a': sprite.texture = textures.walkA;  break;
                case 'walk-b': sprite.texture = textures.walkB;  break;
                case 'pump':   sprite.texture = textures.pump;   break;
            }
        }

        // Direction: flip horizontally for left, rotate for up/down
        if (dir === 'left') {
            view.scale.x = -1;
            view.rotation = 0;
        } else if (dir === 'up') {
            view.scale.x = 1;
            view.rotation = -Math.PI / 2;
        } else if (dir === 'down') {
            view.scale.x = 1;
            view.rotation = Math.PI / 2;
        } else {
            view.scale.x = 1;
            view.rotation = 0;
        }

        // Harpoon line (stays procedural - variable length)
        harpoonGfx.clear();
        if (isHarpoon) {
            const dist = bindings.getHarpoonDistance();
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
