import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';
import type { RockPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RockViewBindings {
    getX(): number;
    getY(): number;
    getPhase(): RockPhase;
    isAlive(): boolean;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRockView(bindings: RockViewBindings): Container {
    const watchPhase = createWatch(bindings.getPhase);
    const watchTileSize = createWatch(bindings.getTileSize);

    const container = new Container();
    const gfx = new Graphics();
    container.addChild(gfx);

    let wobbleOffset = 0;

    drawRock();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (!bindings.isAlive()) {
            container.visible = false;
            return;
        }
        container.visible = true;

        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;

        const phaseChanged = watchPhase.changed();
        const tsChanged = watchTileSize.changed();
        const phase = bindings.getPhase();

        if (phase === 'shattered') {
            if (phaseChanged) drawShattered();
            container.position.set(x, y);
            return;
        }

        // Wobble visual
        if (phase === 'wobbling') {
            wobbleOffset = Math.sin(Date.now() * 0.03) * 2;
        } else {
            wobbleOffset = 0;
        }

        container.position.set(x + wobbleOffset, y);

        if (phaseChanged || tsChanged) {
            drawRock();
        }
    }

    function drawRock(): void {
        gfx.clear();
        const ts = watchTileSize.value;
        const r = ts * 0.42;

        // Main rock body — brownish rounded rectangle
        gfx.roundRect(-r, -r, r * 2, r * 2, r * 0.3).fill(0x8b7355);

        // Cracks
        gfx.moveTo(-r * 0.3, -r * 0.4).lineTo(0, r * 0.1).lineTo(r * 0.2, -r * 0.2)
            .stroke({ color: 0x5c4a32, width: 1.5 });
        gfx.moveTo(r * 0.1, r * 0.2).lineTo(-r * 0.1, r * 0.5)
            .stroke({ color: 0x5c4a32, width: 1 });

        // Highlight
        gfx.roundRect(-r * 0.7, -r * 0.7, r * 0.6, r * 0.4, r * 0.15)
            .fill({ color: 0xffffff, alpha: 0.15 });
    }

    function drawShattered(): void {
        gfx.clear();
        const ts = watchTileSize.value;
        const fragSize = ts * 0.2;

        // Fragments scattering outward
        gfx.rect(-fragSize * 2, -fragSize, fragSize, fragSize).fill(0x8b7355);
        gfx.rect(fragSize, -fragSize * 1.5, fragSize * 0.8, fragSize * 0.8).fill(0x6b5335);
        gfx.rect(-fragSize * 0.5, fragSize * 0.5, fragSize * 1.2, fragSize * 0.6).fill(0x7b6345);
        gfx.rect(fragSize * 1.5, fragSize * 0.3, fragSize * 0.6, fragSize * 0.9).fill(0x8b7355);
    }
}
