import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GlassWindow } from '../models';
import { drawLoosePiece, SHADOW_OFFSET } from './board-drawing';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel } from './board-view-model';
import { LIFT_RAISE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LiftedPieceViewBindings {
    /** The window's shapes, its puzzle, and the board's presentation state, read once. */
    shapes: BoardShapes;
    puzzle: GlassWindow;
    viewModel: BoardViewModel;
    pieceAt: (tile: number) => number;
    /** The tile whose piece is being dragged, or -1, and where the pointer is, in tile edges from the picture's middle. */
    draggedTile: () => number;
    pointerX: () => number;
    pointerY: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The piece being dragged, lifted off its tile with a shadow, growing as it
 * lifts, and following the pointer, drawn a little above it so a finger
 * doesn't hide it. A piece the frame trims lifts out whole.
 */
export function LiftedPieceView(bindings: LiftedPieceViewBindings): Container {
    const { shapes, puzzle, viewModel } = bindings;
    const view = new Container();
    view.addChild(new Graphics(), new Graphics());
    view.visible = false;
    let drawnTile = -1;
    let drawnPiece = -1;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const dragged = bindings.draggedTile();
        view.visible = dragged >= 0;
        if (dragged < 0) return;
        // Drawn again for a new piece, as well as a new tile, since a tile picked up again after a swap holds another
        const piece = bindings.pieceAt(dragged);
        if (dragged !== drawnTile || piece !== drawnPiece) {
            drawnTile = dragged;
            drawnPiece = piece;
            drawLoosePiece({ into: view, shapes, puzzle, tile: dragged, piece });
            view.children[0].position.set(SHADOW_OFFSET, SHADOW_OFFSET * 1.5);
        }
        const { centreX, centreY, scale } = shapes;
        view.position.set(centreX + bindings.pointerX() * scale, centreY + bindings.pointerY() * scale - LIFT_RAISE);
        // Until the update step has seen this drag begin, the piece is drawn as it was on its tile
        view.scale.set(viewModel.liftedTile === dragged ? viewModel.liftScale : 1);
    }
}
