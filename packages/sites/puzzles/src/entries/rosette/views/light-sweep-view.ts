import { Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel } from './board-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LightSweepViewBindings {
    /** The window's shapes, and the board's presentation state, read once. */
    shapes: BoardShapes;
    viewModel: BoardViewModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A band of light that sweeps across the mended window, across and a little down, as the celebration's ripple reaches the frame. */
export function LightSweepView(bindings: LightSweepViewBindings): Graphics {
    const { shapes, viewModel } = bindings;
    const view = new Graphics();
    let wasSweeping = true;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const sweepMs = viewModel.afterWaveMs;
        const isSweeping = viewModel.isCelebrating && sweepMs >= 0 && sweepMs < SWEEP_MS;
        if (isSweeping || wasSweeping) draw(sweepMs, isSweeping);
        wasSweeping = isSweeping;
    }

    function draw(sweepMs: number, isSweeping: boolean): void {
        view.clear();
        if (!isSweeping) return;
        const { insets, sweepPlaces } = shapes;
        const at = (sweepMs / SWEEP_MS) * (1 + LIGHT_BAND * 2) - LIGHT_BAND;
        for (let t = 0; t < insets.length; t++) {
            const strength = 1 - Math.abs(sweepPlaces[t] - at) / LIGHT_BAND;
            if (strength > 0) view.poly(insets[t]).fill({ color: 0xffffff, alpha: LIGHT_ALPHA * strength });
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the light takes to sweep across the mended window, in ms, how wide its band is, as a share of the window, and how bright. */
const SWEEP_MS = 1100;
const LIGHT_BAND = 0.22;
const LIGHT_ALPHA = 0.55;
