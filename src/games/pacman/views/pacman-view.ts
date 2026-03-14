import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#utils';
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
    getRow(): number;
    getCol(): number;
    getDirection(): Direction;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPacmanView(
    bindings: PacmanViewBindings,
    textures: PacmanViewTextures,
): Container {
    const watcher = watch({ direction: bindings.getDirection });

    const view = new Container();
    const sprite = new Sprite({ texture: textures.closed, anchor: 0.5 });
    view.addChild(sprite);

    let prevFrame = -1;

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        const ts = bindings.getTileSize();
        const col = bindings.getCol();
        const row = bindings.getRow();
        view.position.set(col * ts + ts / 2, row * ts + ts / 2);
        sprite.scale.set(ts / 20);

        // Mouth frame: 0 = closed, 1 = mid, 2 = open
        // Use fractional distance from nearest tile centre as mouth cycle input
        const frac = Math.abs(col - Math.round(col)) + Math.abs(row - Math.round(row));
        const mouth = Math.sin(frac * Math.PI);
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

        if (watched.direction.changed) {
            view.rotation = directionToRotation(watched.direction.value);
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
