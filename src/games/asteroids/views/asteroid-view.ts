import { Container, Graphics } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import type { AsteroidSize } from '../models';
import { setTickMethods } from '../../../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AsteroidViewBindings {
    x: () => number;
    y: () => number;
    angle: () => number;
    size: () => AsteroidSize;
    radius: () => number;
    isAlive: () => boolean;
    shapeSeed: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function AsteroidView(bindings: AsteroidViewBindings): Container {
    const watcher = watch({ seed: bindings.shapeSeed, radius: bindings.radius, size: bindings.size });
    let bodyGfx: Graphics;

    const view = new Container();
    initialiseView();
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        bodyGfx = new Graphics();
        view.addChild(bodyGfx);
        drawAsteroid();
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.seed.changed || watched.radius.changed || watched.size.changed) {
            drawAsteroid(); // a different asteroid now occupies this slot - redraw its outline
        }

        view.visible = bindings.isAlive();
        if (!bindings.isAlive()) return;

        view.position.set(bindings.x(), bindings.y());
        view.rotation = bindings.angle();
    }

    function drawAsteroid(): void {
        bodyGfx.clear();
        const radius = bindings.radius();
        const color = SIZE_COLOR[bindings.size()];
        const seed = bindings.shapeSeed();

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
            }
            else {
                bodyGfx.lineTo(px, py);
            }
        }
        bodyGfx.closePath();
        bodyGfx.stroke({ color, width: 1.5 });
        bodyGfx.fill({ color, alpha: 0.15 });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SIZE_COLOR: Record<AsteroidSize, number> = {
    large: 0x888888,
    medium: 0xaaaaaa,
    small: 0xcccccc,
};

const VERTICES = 10;
