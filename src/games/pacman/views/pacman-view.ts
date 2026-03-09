import { Container, Sprite, type Texture } from 'pixi.js';
import { createWatch } from '#utils';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface PacmanViewTextures {
    readonly closed: Texture;
    readonly mid: Texture;
    readonly open: Texture;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PacmanViewBindings {
    getX(): number;
    getY(): number;
    getDirection(): Direction;
    getStepProgress(): number;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPacmanView(
    bindings: PacmanViewBindings,
    textures: PacmanViewTextures,
): Container {
    const watchDirection = createWatch(bindings.getDirection);
    const watchTileSize = createWatch(bindings.getTileSize);

    const container = new Container();
    const sprite = new Sprite({ texture: textures.closed, anchor: 0.5 });
    container.addChild(sprite);

    let prevFrame = -1;

    sprite.scale.set(watchTileSize.value / 20);
    container.rotation = directionToRotation(watchDirection.value);
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = watchTileSize.value;
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        container.position.set(x, y);

        if (watchTileSize.changed()) {
            sprite.scale.set(ts / 20);
        }

        // Mouth frame: 0 = closed, 1 = mid, 2 = open
        const progress = bindings.getStepProgress();
        const mouth = Math.sin(progress * Math.PI);
        const frame = mouth < 0.33 ? 0 : mouth < 0.66 ? 1 : 2;

        if (frame !== prevFrame) {
            prevFrame = frame;
            // prettier-ignore
            switch (frame) {
                case 0: sprite.texture = textures.closed; break;
                case 1: sprite.texture = textures.mid;    break;
                case 2: sprite.texture = textures.open;   break;
            }
        }

        if (watchDirection.changed()) {
            container.rotation = directionToRotation(watchDirection.value);
        }
    }

    function directionToRotation(dir: Direction): number {
        // prettier-ignore
        switch (dir) {
            case 'right': return 0;
            case 'down':  return Math.PI / 2;
            case 'left':  return Math.PI;
            case 'up':    return -Math.PI / 2;
        }
    }
}
