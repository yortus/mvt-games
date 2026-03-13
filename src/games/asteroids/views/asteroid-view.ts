import { Container, Graphics } from 'pixi.js';
import { createWatcher } from '#utils';
import type { AsteroidSize } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AsteroidViewBindings {
    getX(): number;
    getY(): number;
    getAngle(): number;
    getSize(): AsteroidSize;
    getRadius(): number;
    isAlive(): boolean;
    getShapeSeed(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const SIZE_COLOR: Record<AsteroidSize, number> = {
    large: 0x888888,
    medium: 0xaaaaaa,
    small: 0xcccccc,
};

const VERTICES = 10;

export function createAsteroidView(bindings: AsteroidViewBindings): Container {
    const watcher = createWatcher({ alive: bindings.isAlive });

    const view = new Container();
    const bodyGfx = new Graphics();
    view.addChild(bodyGfx);

    drawAsteroid();
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.alive.changed) {
            view.visible = watched.alive.value;
        }
        if (!bindings.isAlive()) return;

        view.position.set(bindings.getX(), bindings.getY());
        view.rotation = bindings.getAngle();
    }

    function drawAsteroid(): void {
        bodyGfx.clear();
        const radius = bindings.getRadius();
        const color = SIZE_COLOR[bindings.getSize()];
        const seed = bindings.getShapeSeed();

        // Generate a jagged polygon using the seed for determinism
        let s = seed;
        function seededRand(): number {
            s = (s * 1664525 + 1013904223) & 0x7fffffff;
            return s / 0x7fffffff;
        }

        const step = (Math.PI * 2) / VERTICES;
        for (let i = 0; i < VERTICES; i++) {
            const angle = step * i;
            const jitter = 0.7 + seededRand() * 0.6;
            const r = radius * jitter;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) {
                bodyGfx.moveTo(px, py);
            } else {
                bodyGfx.lineTo(px, py);
            }
        }
        bodyGfx.closePath();
        bodyGfx.stroke({ color, width: 1.5 });
        bodyGfx.fill({ color, alpha: 0.15 });
    }
}
