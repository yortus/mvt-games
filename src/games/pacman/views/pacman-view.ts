import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';
import type { Direction } from '../models';

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

export function createPacmanView(bindings: PacmanViewBindings): Container {
    // ---- Change detection ---------------------------------------------------
    const watchDirection = createWatch(bindings.getDirection);
    const watchTileSize = createWatch(bindings.getTileSize);
    let prevMouth = -1;

    // ---- Scene elements -------------------------------------------------------
    const container = new Container();
    const gfx = new Graphics();
    container.addChild(gfx);

    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = watchTileSize.value;
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        const progress = bindings.getStepProgress();

        // Derive mouth angle from step progress (one open/close cycle per tile)
        const MAX_MOUTH_ANGLE = 0.8;
        const mouth = Math.sin(progress * Math.PI) * MAX_MOUTH_ANGLE;

        container.position.set(x, y);
        container.rotation = directionToRotation(watchDirection.value);

        // Only redraw if mouth angle, direction, or tile size changed
        const dirChanged = watchDirection.changed();
        const tsChanged = watchTileSize.changed();
        if (mouth !== prevMouth || dirChanged || tsChanged) {
            prevMouth = mouth;

            const radius = ts * 0.45;
            gfx.clear();

            // Draw pac-man as an arc with a mouth wedge
            const startAngle = mouth;
            const endAngle = Math.PI * 2 - mouth;

            gfx.moveTo(0, 0).arc(0, 0, radius, startAngle, endAngle).closePath().fill(0xffff00);
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
