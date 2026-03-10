import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { createWatch } from '#utils';
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
    const watchDirection = createWatch(bindings.getDirection);
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchAlive = createWatch(bindings.isAlive);
    const watchHarpoon = createWatch(bindings.isHarpoonExtended);

    const container = new Container();
    const sprite = new Sprite({ texture: textures.idle, anchor: 0.5 });
    const harpoonGfx = new Graphics();
    container.addChild(sprite);
    container.addChild(harpoonGfx);

    let prevPose: 'idle' | 'walk-a' | 'walk-b' | 'pump' = 'idle';

    sprite.scale.set(watchTileSize.value / 20);
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = watchTileSize.value;
        const col = bindings.getCol();
        const row = bindings.getRow();
        const dir = bindings.getDirection();
        const x = col * ts + ts / 2;
        const y = row * ts + ts / 2;
        container.position.set(x, y);

        if (watchAlive.changed()) {
            container.visible = watchAlive.value;
        }
        if (!bindings.isAlive()) return;

        if (watchTileSize.changed()) {
            sprite.scale.set(ts / 20);
        }

        // Determine pose
        const harpoonChanged = watchHarpoon.changed();
        const dirChanged = watchDirection.changed();
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
            container.scale.x = -1;
            container.rotation = 0;
        } else if (dir === 'up') {
            container.scale.x = 1;
            container.rotation = -Math.PI / 2;
        } else if (dir === 'down') {
            container.scale.x = 1;
            container.rotation = Math.PI / 2;
        } else {
            container.scale.x = 1;
            container.rotation = 0;
        }

        // Harpoon line (stays procedural — variable length)
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
