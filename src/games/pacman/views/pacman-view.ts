import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';
import type { Direction } from '../models';

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

    const pacmanTextures = textures.get().pacman;
    let sprite: Sprite;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        sprite = new Sprite({ texture: pacmanTextures.closed, anchor: 0.5 });
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
        sprite.texture = mouth < 0.33 ? pacmanTextures.closed : mouth < 0.66 ? pacmanTextures.mid : pacmanTextures.open;

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
