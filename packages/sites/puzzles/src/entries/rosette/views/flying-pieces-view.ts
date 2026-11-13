import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GlassWindow } from '../models';
import { drawLoosePiece, SHADOW_OFFSET } from './board-drawing';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel, PiecePose } from './board-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FlyingPiecesViewBindings {
    /** The window's shapes, its puzzle, and the board's presentation state, read once. */
    shapes: BoardShapes;
    puzzle: GlassWindow;
    viewModel: BoardViewModel;
    /** Whether the board's presentation state is for this puzzle yet. Until it is, no piece is in flight. */
    isStateCurrent: () => boolean;
    pieceAt: (tile: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The pieces in flight to their tiles: each drawn as its flight begins,
 * shaped for the tile it flies to, and moved every frame. The pieces flying
 * across are hidden outside the frame, so a piece leaving a tile the frame
 * trims slides out from behind it. A piece settling from where a drag let
 * it go, which may be outside the frame, shows whole, over the piece flying
 * out from under it.
 */
export function FlyingPiecesView(bindings: FlyingPiecesViewBindings): Container {
    const { shapes, puzzle, viewModel } = bindings;
    const { centreX, centreY, scale, outers } = shapes;
    const view = new Container();
    const frameMask = new Graphics();
    for (let t = 0; t < outers.length; t++) frameMask.poly(outers[t]).fill(0xffffff);
    const flying = new Container();
    flying.mask = frameMask;
    const dropping = new Container();
    view.addChild(frameMask, flying, dropping);
    // Each tile's piece in flight, made on its first flight, and the flight each was last drawn for
    const flyers: (Container | undefined)[] = [];
    for (let t = 0; t < outers.length; t++) flyers.push(undefined);
    const drawnFlightIds = new Int32Array(outers.length);
    const pose: PiecePose = { x: 0, y: 0, raise: 0, turn: 0, scale: 1, lift: 0 };
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const isStateCurrent = bindings.isStateCurrent();
        for (let t = 0; t < flyers.length; t++) {
            let flyer = flyers[t];
            const kind = viewModel.flightKindAt(t);
            if (!isStateCurrent || kind === 'none') {
                if (flyer !== undefined) flyer.visible = false;
                continue;
            }
            if (flyer === undefined) {
                flyer = new Container();
                flyer.addChild(new Graphics(), new Graphics());
                flyers[t] = flyer;
            }
            const flightId = viewModel.flightIdAt(t);
            if (drawnFlightIds[t] !== flightId) {
                drawnFlightIds[t] = flightId;
                drawLoosePiece({ into: flyer, shapes, puzzle, tile: t, piece: bindings.pieceAt(t) });
                // The newest flight goes on top of its layer
                (kind === 'drop' ? dropping : flying).addChild(flyer);
            }
            viewModel.findPose(t, pose);
            flyer.visible = true;
            flyer.position.set(centreX + pose.x * scale, centreY + pose.y * scale - pose.raise);
            flyer.rotation = pose.turn;
            flyer.scale.set(pose.scale);
            const shadow = flyer.children[0];
            shadow.alpha = pose.lift;
            shadow.position.set(SHADOW_OFFSET * pose.lift, SHADOW_OFFSET * 1.5 * pose.lift);
        }
    }
}
