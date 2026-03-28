import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';
import type { CupcakeKind } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CupcakeViewBindings {
    getKind(): CupcakeKind;
    getX(): number;
    getY(): number;
    getAlpha(): number;
    isSelected(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCupcakeView(bindings: CupcakeViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    const watcher = watch({
        kind: bindings.getKind,
        selected: bindings.isSelected,
    });

    view.addChild(gfx);
    drawCupcake(gfx, bindings.getKind(), bindings.isSelected());
    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.position.set(bindings.getX(), bindings.getY());
        view.alpha = bindings.getAlpha();

        const watched = watcher.poll();
        if (watched.kind.changed || watched.selected.changed) {
            gfx.clear();
            drawCupcake(gfx, watched.kind.value, watched.selected.value);
        }
    }
}

function drawCupcake(gfx: Graphics, kind: CupcakeKind, selected: boolean): void {
    const color = KIND_COLOR[kind];
    const frosting = KIND_FROSTING[kind];
    const size = 16;

    // Cupcake base (trapezoid)
    gfx.moveTo(-size * 0.7, size * 0.2)
        .lineTo(-size * 0.5, size * 0.8)
        .lineTo(size * 0.5, size * 0.8)
        .lineTo(size * 0.7, size * 0.2)
        .closePath()
        .fill(0x8B6914);

    // Wrapper lines
    gfx.moveTo(-size * 0.6, size * 0.35)
        .lineTo(size * 0.6, size * 0.35)
        .stroke({ color: 0x6B4914, width: 1 });
    gfx.moveTo(-size * 0.55, size * 0.55)
        .lineTo(size * 0.55, size * 0.55)
        .stroke({ color: 0x6B4914, width: 1 });

    // Frosting dome (semicircle on top)
    gfx.circle(0, size * 0.1, size * 0.65).fill(frosting);
    gfx.circle(0, -size * 0.15, size * 0.5).fill(color);

    // Cherry on top
    gfx.circle(0, -size * 0.55, size * 0.15).fill(0xCC0000);
    gfx.circle(size * 0.03, -size * 0.6, size * 0.05).fill(0xFF4444);

    // Selection highlight
    if (selected) {
        gfx.rect(-size * 0.85, -size * 0.75, size * 1.7, size * 1.65)
            .stroke({ color: 0xFFFF00, width: 2 });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const KIND_COLOR: Record<CupcakeKind, number> = {
    strawberry: 0xFF6B8A,
    chocolate: 0x6B3A2A,
    vanilla: 0xFFF5CC,
    blueberry: 0x5B7FFF,
    mint: 0x7FFFB2,
    lemon: 0xFFEB3B,
};

const KIND_FROSTING: Record<CupcakeKind, number> = {
    strawberry: 0xFFB6C1,
    chocolate: 0x8B5E3C,
    vanilla: 0xFFFFE0,
    blueberry: 0x8BA8FF,
    mint: 0xB2FFD6,
    lemon: 0xFFF59D,
};
