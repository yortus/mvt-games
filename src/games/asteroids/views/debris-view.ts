import { Container, Graphics } from 'pixi.js';
import type { DebrisParticle } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DebrisViewBindings {
    getParticles(): readonly DebrisParticle[];
    isActive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDebrisView(bindings: DebrisViewBindings): Container {
    let gfx: Graphics;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        gfx = new Graphics();
        view.addChild(gfx);
    }

    function refresh(): void {
        const active = bindings.isActive();
        view.visible = active;
        if (!active) return;

        gfx.clear();
        const particles = bindings.getParticles();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (!p.active) continue;

            const cos = Math.cos(p.angle);
            const sin = Math.sin(p.angle);
            const dx = cos * p.length;
            const dy = sin * p.length;

            gfx
                .moveTo(p.x - dx, p.y - dy)
                .lineTo(p.x + dx, p.y + dy)
                .stroke({ color: 0xffffff, width: 1.5 });
        }
    }
}
