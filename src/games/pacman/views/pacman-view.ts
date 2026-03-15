import { Container, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import type { Direction } from '../models';
import { getTexture } from '../data';

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

export function createPacmanView(bindings: PacmanViewBindings): Container {
    const watcher = watch({ direction: bindings.getDirection });
    let sprite: Sprite;
    let prevFrame = -1;

    let closedTex: Texture;
    let midTex: Texture;
    let openTex: Texture;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        closedTex = getTexture('pacman-closed');
        midTex = getTexture('pacman-mid');
        openTex = getTexture('pacman-open');

        sprite = new Sprite({ texture: closedTex, anchor: 0.5 });
        view.addChild(sprite);
    }

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
                case 0: sprite.texture = closedTex; break;
                case 1: sprite.texture = midTex;    break;
                case 2: sprite.texture = openTex;   break;
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
