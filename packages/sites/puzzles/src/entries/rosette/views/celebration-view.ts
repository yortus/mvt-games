import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GlassWindow } from '../models';
import { shiftPolygon } from './board-drawing';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel } from './board-view-model';
import { easeInOut } from './ease-in-out';
import { LEAD_COLOR, LEAD_HALF_WIDTH, SUN_FROM_MS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CelebrationViewBindings {
    /** The window's shapes, its puzzle, and the board's presentation state, read once. */
    shapes: BoardShapes;
    puzzle: GlassWindow;
    viewModel: BoardViewModel;
    /** Whether the board's presentation state is for this puzzle yet. Until it is, nothing celebrates. */
    isStateCurrent: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The mended window's pieces celebrating: each pops and flashes as the
 * ripple reaches it, with a sparkle at one of its corners, then lights up
 * as the sun comes up behind the window, from the middle out. Its pieces
 * are made the first time it shows, and nothing is drawn again once the
 * celebration ends.
 */
export function CelebrationView(bindings: CelebrationViewBindings): Container {
    const { shapes, puzzle, viewModel } = bindings;
    const view = new Container();
    // Each piece, about its middle, with a light over it, then a sparkle for each, and how far each piece is from
    // the middle, as a share of the furthest, for the sun lighting it
    const pieces: Container[] = [];
    const sparkles: Graphics[] = [];
    let sunDistances = new Float64Array(0);
    let isMade = false;
    let drawnCelebrationMs = -1;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const isShown = viewModel.isCelebrating && bindings.isStateCurrent();
        view.visible = isShown;
        if (!isShown) {
            drawnCelebrationMs = -1;
            return;
        }
        const { celebrationMs, afterWaveMs } = viewModel;
        if (celebrationMs === drawnCelebrationMs) return;
        drawnCelebrationMs = celebrationMs;
        if (!isMade) make();
        for (let t = 0; t < pieces.length; t++) {
            const piece = pieces[t];
            const since = viewModel.rippleMsAt(t);
            const pop = since >= 0 && since < POP_MS ? Math.sin((Math.PI * since) / POP_MS) : 0;
            const sun = SUN_LIGHT * easeInOut((afterWaveMs - SUN_FROM_MS - sunDistances[t] * SUN_SPREAD_MS) / SUN_GLOW_MS);
            piece.visible = pop > 0 || sun > 0;
            piece.scale.set(1 + POP_GROWTH * pop);
            piece.children[0].visible = pop > 0;
            piece.children[1].alpha = Math.max(FLASH_ALPHA * pop, sun);
            const sparkle = sparkles[t];
            const glint = since >= 0 && since < SPARKLE_MS ? since / SPARKLE_MS : -1;
            sparkle.visible = glint >= 0;
            if (glint >= 0) {
                sparkle.scale.set(SPARKLE_SIZE * Math.sin(Math.PI * glint));
                sparkle.rotation = SPARKLE_TURN * glint;
            }
        }
    }

    /**
     * Makes the pieces, each about its middle: its glass and lead, shown as
     * it pops, and a light over it, added to what is beneath, for its flash
     * and the sun. Then a sparkle at one corner of each.
     */
    function make(): void {
        isMade = true;
        const { colours, patch } = puzzle;
        const { centreX, centreY, scale, insets, outers } = shapes;
        let furthest = 0;
        for (let t = 0; t < patch.count; t++) furthest = Math.max(furthest, Math.hypot(patch.middleXs[t], patch.middleYs[t]));
        sunDistances = new Float64Array(patch.count);
        for (let t = 0; t < insets.length; t++) {
            sunDistances[t] = Math.hypot(patch.middleXs[t], patch.middleYs[t]) / (furthest || 1);
            const mx = centreX + patch.middleXs[t] * scale;
            const my = centreY + patch.middleYs[t] * scale;
            const shape = shiftPolygon(insets[t], mx, my);
            const pane = new Graphics().poly(shape).fill(colours[t]).stroke({ color: LEAD_COLOR, width: LEAD_HALF_WIDTH * 2, join: 'round' });
            const glow = new Graphics().poly(shape).fill(0xffffff);
            glow.blendMode = 'add';
            const piece = new Container();
            piece.position.set(mx, my);
            piece.addChild(pane, glow);
            piece.visible = false;
            view.addChild(piece);
            pieces.push(piece);
        }
        const star = new GraphicsContext().poly(SPARKLE_POINTS).fill(0xffffff);
        for (let t = 0; t < outers.length; t++) {
            const corners = outers[t].length / 2;
            const corner = (t * 3) % corners;
            const sparkle = new Graphics(star);
            sparkle.blendMode = 'add';
            sparkle.position.set(outers[t][corner * 2], outers[t][corner * 2 + 1]);
            sparkle.visible = false;
            view.addChild(sparkle);
            sparkles.push(sparkle);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * As the ripple reaches each piece, the piece pops, for POP_MS, growing by
 * POP_GROWTH at most, and flashing as bright as FLASH_ALPHA, and a sparkle
 * at one of its corners grows to SPARKLE_SIZE pixels and fades, turning
 * SPARKLE_TURN radians, over SPARKLE_MS.
 */
const POP_MS = 340;
const POP_GROWTH = 0.16;
const FLASH_ALPHA = 0.55;
const SPARKLE_MS = 520;
const SPARKLE_SIZE = 9;
const SPARKLE_TURN = 0.9;
/** A sparkle: a star of four points, a unit long, thin between them. */
const SPARKLE_POINTS = [0, -1, 0.2, -0.2, 1, 0, 0.2, 0.2, 0, 1, -0.2, 0.2, -1, 0, -0.2, -0.2];
/**
 * As the sun comes up, from SUN_FROM_MS after the ripple reaches the frame,
 * each piece lights up over SUN_GLOW_MS, those furthest from the middle up
 * to SUN_SPREAD_MS later, as bright as SUN_LIGHT.
 */
const SUN_GLOW_MS = 900;
const SUN_SPREAD_MS = 700;
const SUN_LIGHT = 0.1;
