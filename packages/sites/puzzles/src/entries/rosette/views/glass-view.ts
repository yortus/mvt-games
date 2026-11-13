import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GlassWindow } from '../models';
import { drawPieceRing, LOCK_LEAD_WIDTH, mixColours } from './board-drawing';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel } from './board-view-model';
import { easeInOut } from './ease-in-out';
import { LEAD_COLOR, SOLVED_LEAD_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GlassViewBindings {
    /** The window's shapes, its puzzle, and the board's presentation state, read once. */
    shapes: BoardShapes;
    puzzle: GlassWindow;
    viewModel: BoardViewModel;
    /** Whether the board's presentation state is for this puzzle yet. Until it is, every piece is drawn at home. */
    isStateCurrent: () => boolean;
    pieceAt: (tile: number) => number;
    isLockedAt: (tile: number) => boolean;
    /** A count that rises with every swap. */
    changes: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The glass of every piece at home, the heavier lead round each locked
 * group, and the ring on each free piece. A tile whose piece is in flight,
 * or lifted with its group, stands empty, showing the lead behind. A side
 * of a locked piece gets heavier lead as its piece locks, and loses it as
 * the piece across it locks, so the heavier lead moves out round each
 * piece that joins the group. A ring fades as its piece locks. The heavier
 * lead turns white with the rest of the lead as the sun comes up behind the
 * mended window, and fades, as every piece is locked. The glass is drawn
 * again only as it changes.
 */
export function GlassView(bindings: GlassViewBindings): Container {
    const { shapes, puzzle, viewModel } = bindings;
    const view = new Container();
    const glass = new Graphics();
    // Drawn in white and tinted with the lead
    const locks = new Graphics();
    const rings = new Graphics();
    view.addChild(glass, locks, rings);
    let drawnChanges = -1;
    let drawnFlightsBegun = -1;
    let drawnFlightCount = -1;
    let drawnGroupsChanged = -1;
    let drawnLocksMoved = -1;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const flightCount = bindings.isStateCurrent() ? viewModel.flightCount : 0;
        const changes = bindings.changes();
        const { flightsBegun, groupsChanged, locksMoved, sunShare } = viewModel;
        const isGlassChanged = changes !== drawnChanges || flightsBegun !== drawnFlightsBegun || flightCount !== drawnFlightCount;
        if (isGlassChanged || groupsChanged !== drawnGroupsChanged || locksMoved !== drawnLocksMoved) draw();
        drawnChanges = changes;
        drawnFlightsBegun = flightsBegun;
        drawnFlightCount = flightCount;
        drawnGroupsChanged = groupsChanged;
        drawnLocksMoved = locksMoved;
        locks.tint = mixColours(LEAD_COLOR, SOLVED_LEAD_COLOR, sunShare);
        locks.alpha = 1 - sunShare;
    }

    function draw(): void {
        const { patch, colours } = puzzle;
        const { centreX, centreY, scale, insets, sideNeighbours, ringRadius } = shapes;
        const isStateCurrent = bindings.isStateCurrent();
        glass.clear();
        locks.clear();
        rings.clear();
        for (let t = 0; t < insets.length; t++) {
            if (isStateCurrent && (viewModel.flightKindAt(t) !== 'none' || viewModel.groupAt(t) >= 0)) continue;
            const inset = insets[t];
            glass.poly(inset).fill(colours[bindings.pieceAt(t)]);
            const share = isStateCurrent ? viewModel.lockShareAt(t) : bindings.isLockedAt(t) ? 1 : 0;
            if (share < 1) drawPieceRing(rings, centreX + patch.middleXs[t] * scale, centreY + patch.middleYs[t] * scale, ringRadius, 1 - share);
            if (share <= 0) continue;
            const start = patch.cornerStarts[t];
            const sides = patch.cornerStarts[t + 1] - start;
            for (let k = 0; k < sides; k++) {
                const across = sideNeighbours[start + k];
                const acrossShare = across < 0 ? 0 : isStateCurrent ? viewModel.lockShareAt(across) : bindings.isLockedAt(across) ? 1 : 0;
                const strength = share * (1 - acrossShare);
                if (strength <= 0) continue;
                const next = (k + 1) % sides;
                locks.moveTo(inset[k * 2], inset[k * 2 + 1]).lineTo(inset[next * 2], inset[next * 2 + 1]);
                locks.stroke({ color: 0xffffff, width: LOCK_LEAD_WIDTH * easeInOut(strength), cap: 'round' });
            }
        }
    }
}
