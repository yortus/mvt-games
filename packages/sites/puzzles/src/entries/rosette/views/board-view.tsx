/** @jsxImportSource @mvtjs/pixi */

import { Container, type Graphics, Rectangle } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import type { GlassWindow } from '../models';
import { mixColours } from './board-drawing';
import { type BoardShapes, createBoardShapes } from './board-shapes';
import { createBoardViewModel } from './board-view-model';
import { CelebrationView } from './celebration-view';
import { easeInOut } from './ease-in-out';
import { FlyingPiecesView } from './flying-pieces-view';
import { GlassView } from './glass-view';
import { GlowView } from './glow-view';
import { GodRaysView } from './god-rays-view';
import { LiftedPieceView } from './lifted-piece-view';
import { LiftingGroupsView } from './lifting-groups-view';
import { LightSweepView } from './light-sweep-view';
import { OutlinesView } from './outlines-view';
import { SunlightView } from './sunlight-view';
import { createSwapGesturesViewModel, type SwapGesturesViewModel } from './swap-gestures-view-model';
import { LEAD_COLOR, RIM_WIDTH, SOLVED_LEAD_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A picture being put back together, or shown whole. */
export interface BoardViewBindings {
    /** The puzzle. The board is built afresh for each new one, fitted to its size. */
    puzzle: () => GlassWindow;
    /** The space the picture is fitted into, and centred in, from the board's origin, read once. */
    width: number;
    height: number;
    /** The piece on `tile`, coloured as the puzzle colours it. */
    pieceAt: (tile: number) => number;
    /** Whether the piece on `tile` is locked. Each free piece has a small white ring, and each locked group heavier lead round it. */
    isLockedAt: (tile: number) => boolean;
    /** Whether the picture is solved. Once its last pieces land, it celebrates, ending in sunlight, its lead white and shimmering. */
    isSolved: () => boolean;
    /** The tile swapped last, which the celebration ripples out from, read as the picture is solved. Without it, the middle. */
    lastSwappedTile?: () => number;
    /** A count that rises with every swap, so the pieces are redrawn only as they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so a fresh copy of the same puzzle, started again, is drawn afresh too. */
    puzzlesOpened: () => number;
    /** Whether the pieces on two tiles can swap, so a drag over a tile that can't goes nowhere. Read only with `onSwapRequested`. */
    canSwap?: (a: number, b: number) => boolean;
    /** The player asked to swap the pieces on two tiles, by a drag or two taps. Without it, the board takes no input. */
    onSwapRequested?: (a: number, b: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The picture, fitted into a space and centred in it: a window of rhombus
 * tiles cut to its frame, each a flat piece of coloured glass, held in dark
 * lead, as in a leaded window. Each free piece, one still to place, has a small white
 * ring at its middle, and each group of locked pieces has lead half as wide
 * again round its outside, with the usual lead between its pieces. As a
 * piece locks, once every piece in flight has landed, its ring fades and the
 * heavier lead grows round it, and the whole group it joined lifts, shakes
 * and settles back as one piece, the composite of its glass and lead,
 * moving gently enough that a large group stays calm. As one unlocks, its
 * ring comes back.
 *
 * A piece being dragged lifts off its tile, growing a little under the
 * finger, with a shadow, and follows the pointer, and the tile it would
 * swap with is outlined. A piece picked up by a tap is outlined too. A
 * piece the frame trims lifts out whole, its hidden part showing, and a
 * piece flying out of a trimmed tile slides out from behind the frame.
 *
 * When two pieces swap, each flies to the other's tile, turning to fit it,
 * and a tile stands empty until its new piece lands. A dropped piece turns
 * first, where it was let go, then settles into its tile, while the piece
 * it swapped with lifts and flies across. A piece let go where it can't
 * swap settles back home.
 *
 * Once the picture is solved and its last pieces have landed, it
 * celebrates. A ripple spreads out from the piece swapped last, neighbour
 * by neighbour: each piece pops and flashes as it reaches it, with a
 * sparkle at one of its corners. As the ripple reaches the frame, the whole
 * window pulses, and a band of light sweeps across it. Then the window
 * steps back, making room for the floor below it, and the sun comes up
 * behind it: the pieces light up from the middle out, the lead between them
 * turns white, inside a rim that stays dark, with a soft glow along it that
 * shimmers as glints travel slowly across, beams of light shine through
 * the window onto the floor, where its colours land in a soft pool, and
 * shimmering god rays of warm sunlight fan out across it all from the sun,
 * above and to its left. A picture opened already solved is shown whole,
 * as it was before its celebration began, with no sun behind it.
 *
 * It is made of layers: the sunlight, behind, the window, which can pulse
 * and step back as one, and the god rays, in front. The window's layers
 * are the rim and the lead, drawn here, then a view for each of the rest:
 * the glass ({@link GlassView}), the mended window's glow, the outlines,
 * the light's sweep, the groups lifting, the pieces in flight, the dragged
 * piece, and the celebration's pieces and sparkles. Each is made afresh,
 * with the window's shapes (`createBoardShapes`), for each puzzle. Where
 * each piece is, how far each has locked, which groups are lifting and how
 * far the celebration has got are the board's view model's to say
 * (`createBoardViewModel`), and which tiles a gesture picks, the gestures
 * view model's. What a swap does is up to whoever the board reports to.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onSwapRequested !== undefined;
    if (isInteractive) view.cursor = 'pointer';

    // What is built for the puzzle shown: its shapes, the window's layers, which pulse and step back as one, about the
    // middle of its top, the sunlight and god rays, made as the sun comes up, and the gestures
    let builtPuzzle: GlassWindow | undefined;
    let builtOpened = -1;
    let shapes: BoardShapes | undefined;
    let windowLayer = new Container();
    let sunlight: Container | undefined;
    let godRays: Container | undefined;
    let gestures: SwapGesturesViewModel | undefined;
    // The presentation state: the pieces in flight, the locks, the groups lifting and the celebration. It reads the
    // gestures made for each puzzle, which on a new board have ended no drags
    const viewModel = createBoardViewModel({
        puzzle: bindings.puzzle,
        puzzlesOpened: bindings.puzzlesOpened,
        pieceAt: bindings.pieceAt,
        isLockedAt: bindings.isLockedAt,
        isSolved: bindings.isSolved,
        lastSwappedTile: bindings.lastSwappedTile,
        changes: bindings.changes,
        gestures: () => gestures,
    });
    build(bindings.puzzle());

    if (isInteractive) {
        listenToPointer({
            target: view,
            onPressed: (x, y) => gestures?.press(toTileX(x), toTileY(y)),
            onMoved: (x, y) => gestures?.move(toTileX(x), toTileY(y)),
            onReleased: () => gestures?.release(),
            onCancelled: () => gestures?.cancel(),
        });
    }
    setUpdate(view, viewModel.update);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const puzzle = bindings.puzzle();
        if (puzzle !== builtPuzzle || bindings.puzzlesOpened() !== builtOpened) build(puzzle);
        drawStage();
    }

    /**
     * Builds the board for `puzzle`: its fit, its pieces' shapes, the window's
     * layers, and its gestures. Each layer's view is new, so it starts with
     * nothing drawn.
     */
    function build(puzzle: GlassWindow): void {
        builtPuzzle = puzzle;
        builtOpened = bindings.puzzlesOpened();
        const { patch } = puzzle;
        const built = createBoardShapes({ patch, width: bindings.width, height: bindings.height });
        shapes = built;
        const { centreX, centreY, scale, windowTop, outers } = built;

        for (const child of view.removeChildren()) child.destroy({ children: true });
        sunlight = undefined;
        godRays = undefined;
        // What most layers take: the window's shapes and puzzle, the presentation state, and whether it is for them yet
        const layer = { shapes: built, puzzle, viewModel, isStateCurrent: isStateForBuilt, pieceAt: bindings.pieceAt };
        // The rim round the window stays dark. The lead is drawn in white and tinted, so it turns white as the sun comes
        // up behind the mended window
        windowLayer = (
            <container x={centreX} y={windowTop} pivotX={centreX} pivotY={windowTop}>
                <graphics ref={(rim) => drawRim(rim, outers)} />
                <graphics ref={(lead) => drawLead(lead, outers)} tint={() => mixColours(LEAD_COLOR, SOLVED_LEAD_COLOR, viewModel.sunShare)} />
                <GlassView {...layer} isLockedAt={bindings.isLockedAt} changes={bindings.changes} />
                <GlowView shapes={built} puzzle={puzzle} viewModel={viewModel} />
                <OutlinesView
                    shapes={built}
                    pickedTile={() => gestures?.pickedTile ?? -1}
                    draggedTile={() => gestures?.draggedTile ?? -1}
                    targetTile={() => gestures?.targetTile ?? -1}
                />
                <LightSweepView shapes={built} viewModel={viewModel} />
                <LiftingGroupsView {...layer} />
                <FlyingPiecesView {...layer} />
                <LiftedPieceView
                    shapes={built}
                    puzzle={puzzle}
                    viewModel={viewModel}
                    pieceAt={bindings.pieceAt}
                    draggedTile={() => gestures?.draggedTile ?? -1}
                    pointerX={() => gestures?.pointerX ?? 0}
                    pointerY={() => gestures?.pointerY ?? 0}
                />
                <CelebrationView {...layer} />
            </container>
        );
        view.addChild(windowLayer);

        if (isInteractive) {
            const edgeX = patch.halfWidth * scale + RIM_WIDTH;
            const edgeY = patch.halfHeight * scale + RIM_WIDTH;
            view.hitArea = new Rectangle(centreX - edgeX, centreY - edgeY, edgeX * 2, edgeY * 2);
            gestures = createSwapGesturesViewModel({
                tileAt: patch.tileAt,
                isLockedAt: bindings.isLockedAt,
                canSwap: bindings.canSwap ?? canSwapFreely,
                onSwapRequested: (a, b) => bindings.onSwapRequested?.(a, b),
            });
        }
    }

    /**
     * The mended window on its stage: it pulses as the ripple reaches the
     * frame, then steps back, making room for the floor, as the sun comes up
     * behind it, with the sunlight below it and the god rays over it all.
     */
    function drawStage(): void {
        const isShown = viewModel.isCelebrating && isStateForBuilt();
        if (!isShown) {
            windowLayer.scale.set(1);
            if (sunlight !== undefined) sunlight.visible = false;
            if (godRays !== undefined) godRays.visible = false;
            return;
        }
        const afterWave = viewModel.afterWaveMs;
        const pulse = afterWave >= 0 && afterWave < PULSE_MS ? Math.sin((Math.PI * afterWave) / PULSE_MS) : 0;
        const stepBack = easeInOut((afterWave - STEP_BACK_FROM_MS) / STEP_BACK_MS);
        windowLayer.scale.set((1 - (1 - STEP_BACK_SCALE) * stepBack) * (1 + PULSE_GROWTH * pulse));
        if (sunlight === undefined && viewModel.sunShare > 0) makeSunlight();
        if (sunlight !== undefined) sunlight.visible = true;
        if (godRays !== undefined) godRays.visible = true;
    }

    /**
     * Makes the sunlight, for the window as it stands once stepped back, with
     * its pieces' own colours, and the god rays, from the sun above the
     * window and to its left, reaching on down to the floor.
     */
    function makeSunlight(): void {
        const { colours, patch } = builtPuzzle!;
        const { centreX, scale, windowTop, outers } = shapes!;
        const outlines: number[][] = [];
        for (let t = 0; t < outers.length; t++) {
            const outer = outers[t];
            const outline: number[] = [];
            for (let i = 0; i < outer.length; i += 2) {
                outline.push(centreX + (outer[i] - centreX) * STEP_BACK_SCALE, windowTop + (outer[i + 1] - windowTop) * STEP_BACK_SCALE);
            }
            outlines.push(outline);
        }
        const halfWidth = patch.halfWidth * scale * STEP_BACK_SCALE;
        const height = patch.halfHeight * 2 * scale * STEP_BACK_SCALE;
        sunlight = SunlightView({
            outlines,
            colours,
            left: centreX - halfWidth,
            top: windowTop,
            width: halfWidth * 2,
            height,
            strength: () => viewModel.sunShare,
        });
        // Behind the window, so its beams show only where they come out below it
        view.addChildAt(sunlight, 0);
        godRays = GodRaysView({
            sunX: centreX - halfWidth - halfWidth * 2 * SUN_LEFT,
            sunY: windowTop - height * SUN_ABOVE,
            length: height * GOD_RAY_REACH,
            strength: () => viewModel.sunShare,
        });
        view.addChild(godRays);
    }

    /** Whether two tiles can swap, when the board isn't told: any two free ones. */
    function canSwapFreely(a: number, b: number): boolean {
        return a !== b && !bindings.isLockedAt(a) && !bindings.isLockedAt(b);
    }

    /** Whether the presentation state is for the puzzle built, which it is but for the frame a new puzzle opens. */
    function isStateForBuilt(): boolean {
        return viewModel.puzzle === builtPuzzle && viewModel.puzzlesOpened === builtOpened;
    }

    /** Where a point on the board is in the picture, in tile edges from its middle. */
    function toTileX(x: number): number {
        return (x - shapes!.centreX) / shapes!.scale;
    }

    function toTileY(y: number): number {
        return (y - shapes!.centreY) / shapes!.scale;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Draws the rim round the window: each tile's outline, stroked wide, so only the part outside the lead shows. */
function drawRim(rim: Graphics, outers: BoardShapes['outers']): void {
    for (let t = 0; t < outers.length; t++) rim.poly(outers[t]).stroke({ color: LEAD_COLOR, width: RIM_WIDTH * 2, join: 'round' });
}

/** Draws the lead between the pieces, in white, to be tinted: every tile's outline, filled, which the glass covers but for the lead. */
function drawLead(lead: Graphics, outers: BoardShapes['outers']): void {
    for (let t = 0; t < outers.length; t++) lead.poly(outers[t]).fill(0xffffff);
}

/**
 * After the ripple reaches the frame: the window's pulse, its time in ms
 * and how much it grows. Then the window steps back, from STEP_BACK_FROM_MS
 * after, over STEP_BACK_MS, to STEP_BACK_SCALE of its size, making room for
 * the floor.
 */
const PULSE_MS = 480;
const PULSE_GROWTH = 0.035;
const STEP_BACK_FROM_MS = 350;
const STEP_BACK_MS = 1000;
const STEP_BACK_SCALE = 0.78;
/**
 * Where the sun is, for the god rays: how far left of the window, as a share
 * of its width, and how far above it, as a share of its height, and how far
 * the rays reach, as a share of its height.
 */
const SUN_LEFT = 0.12;
const SUN_ABOVE = 0.28;
const GOD_RAY_REACH = 1.55;
