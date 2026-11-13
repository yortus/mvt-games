import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GlassWindow } from '../models';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel } from './board-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GlowViewBindings {
    /** The window's shapes, its puzzle, and the board's presentation state, read once. */
    shapes: BoardShapes;
    puzzle: GlassWindow;
    viewModel: BoardViewModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The mended window's glow: a line of warm light along each side two pieces
 * share, through the middle of the lead, which comes up with the sun and
 * shimmers as glints travel slowly across. Its lines are made the first
 * time it shows, and then only faded and brightened, so nothing is drawn
 * again while it shimmers.
 */
export function GlowView(bindings: GlowViewBindings): Container {
    const { shapes, puzzle, viewModel } = bindings;
    const view = new Container();
    // Each line, and how far its middle is along the shimmer's way, in tile edges
    const sides: Graphics[] = [];
    const alongs: number[] = [];
    let isMade = false;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const share = viewModel.sunShare;
        view.visible = share > 0;
        if (share <= 0) return;
        if (!isMade) make();
        const wave = 2 * Math.PI * viewModel.shimmerShare;
        for (let i = 0; i < sides.length; i++) {
            const glint = 0.5 + 0.5 * Math.sin(wave - alongs[i] * SHIMMER_SPACING);
            sides[i].alpha = share * (GLOW_LEAST + (1 - GLOW_LEAST) * glint * glint * glint);
        }
    }

    /** Makes the glow's lines: one along each side two pieces share. */
    function make(): void {
        isMade = true;
        const { cornerStarts, cornerXs, cornerYs } = puzzle.patch;
        const { outers, sideNeighbours } = shapes;
        for (let t = 0; t < outers.length; t++) {
            const outer = outers[t];
            const start = cornerStarts[t];
            const count = cornerStarts[t + 1] - start;
            for (let k = 0; k < count; k++) {
                const across = sideNeighbours[start + k];
                // Each shared side once, from the lower numbered of its two tiles. The frame has no glow
                if (across < t) continue;
                const next = (k + 1) % count;
                const side = new Graphics();
                drawGlowLine(side, outer[k * 2], outer[k * 2 + 1], outer[next * 2], outer[next * 2 + 1]);
                view.addChild(side);
                sides.push(side);
                const midX = (cornerXs[start + k] + cornerXs[start + next]) / 2;
                const midY = (cornerYs[start + k] + cornerYs[start + next]) / 2;
                alongs.push(midX * SHIMMER_COS + midY * SHIMMER_SIN);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Draws a line of the glow from (`ax`, `ay`) to (`bx`, `by`), in its strokes from wide and faint to narrow and bright. */
function drawGlowLine(into: Graphics, ax: number, ay: number, bx: number, by: number): void {
    for (let i = 0; i < GLOW_WIDTHS.length; i++) {
        into.moveTo(ax, ay).lineTo(bx, by).stroke({ color: GLOW_COLOR, width: GLOW_WIDTHS[i], alpha: GLOW_ALPHAS[i], cap: 'round' });
    }
    into.blendMode = 'add';
}

/**
 * The glow: a warm white light, laid along the middle of the lead in strokes
 * from wide and faint to narrow and bright, each a width in pixels and an
 * alpha, and added to what is beneath, as light would be. It is this bright
 * between glints, as a share of its brightest.
 */
const GLOW_COLOR = 0xfff6e0;
const GLOW_WIDTHS = [10, 6, 3];
const GLOW_ALPHAS = [0.08, 0.16, 0.35];
const GLOW_LEAST = 0.4;
/**
 * The shimmer: glints travelling across the window, slanted a little from
 * across, one each time round the view model's shimmer, about
 * 1 / SHIMMER_SPACING tile edges apart, in radians a tile edge.
 */
const SHIMMER_SPACING = 1.8;
const SHIMMER_COS = Math.cos(0.5);
const SHIMMER_SIN = Math.sin(0.5);
