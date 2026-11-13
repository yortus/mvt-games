import { Container, Graphics, GraphicsContext, Rectangle } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import type { GlassWindow, TilePatch } from '../models';
import { measureTurn } from './measure-turn';
import { layOutPicture } from './picture-layout';
import { GodRaysView } from './god-rays-view';
import { SunlightView } from './sunlight-view';
import { createSwapGesturesViewModel, type SwapGesturesViewModel } from './swap-gestures-view-model';
import { FLY_MS, LEAD_COLOR, LEAD_HALF_WIDTH, PICKED_COLOR, RIM_WIDTH, SOLVED_LEAD_COLOR, TARGET_COLOR } from './view-constants';

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
 * and step back as one, and the god rays, in front. The window's are the rim, the lead, the glass, the
 * locked groups' lead, the free pieces' rings, the solved window's glow,
 * the outlines, the light, the groups lifting, the pieces in flight, the
 * dragged piece, and the celebration's pieces and sparkles. The glass is
 * drawn again only as it changes. Which tiles a gesture picks is
 * the gestures view model's to say, and what a swap does is up to whoever
 * the board reports to.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onSwapRequested !== undefined;
    if (isInteractive) view.cursor = 'pointer';

    // Presentation state, moved on by the update step: the piece each tile
    // was last seen with, the pieces in flight to their tiles, how far the
    // dragged piece has grown, and the time since the picture was solved.
    // A flight starts in tile edges from the picture's middle, raised some
    // pixels, turned from its tile's own way round, and scaled.
    let statePuzzle = bindings.puzzle();
    let stateOpened = bindings.puzzlesOpened();
    let seenChanges = 0;
    let seenPieces = new Uint16Array(0);
    let seenDragsEnded = 0;
    let flightKinds = new Uint8Array(0);
    let flightMs = new Float64Array(0);
    let fromXs = new Float64Array(0);
    let fromYs = new Float64Array(0);
    let fromRaises = new Float64Array(0);
    let fromTurns = new Float64Array(0);
    let fromScales = new Float64Array(0);
    // Rises with each flight begun, and marks each tile's flight with it, so each piece is drawn as its flight begins
    let flightsBegun = 0;
    let flightIds = new Int32Array(0);
    let liftedTile = -1;
    let liftMs = 0;
    let isShowingSolved = false;
    // Whether the picture celebrates: only one solved while it shows, not one opened solved already
    let isCelebrating = false;
    // The time since the picture was solved and its last pieces landed, through its celebration, and the ripple's way
    // out: each tile's steps between neighbours from the piece swapped last, the time each step takes, when the ripple
    // reaches the frame, and when the celebration ends
    let celebrationMs = 0;
    let rippleSteps = new Int32Array(0);
    let rippleStepMs = 0;
    let waveEndMs = 0;
    let celebrationEndMs = 0;
    // The time through the solved window's shimmer
    let shimmerMs = 0;
    // How far each piece has locked, from 0, free, to 1, locked, and a count that rises as any of them moves
    let lockShares = new Float64Array(0);
    let locksMoved = 0;
    // Locked groups lifting, shaking and settling as one, after pieces join them, the group each tile is in, or -1, and a
    // count that rises as groups start and end
    let groups: LiftingGroup[] = [];
    let groupOf = new Int32Array(0);
    let groupsChanged = 0;

    // Where a piece is shown, from findPose: in tile edges, raised, turned, scaled, and how high its shadow is, from 0 to 1
    let poseX = 0;
    let poseY = 0;
    let poseRaise = 0;
    let poseTurn = 0;
    let poseScale = 1;
    let poseLift = 0;

    // What is built for the puzzle shown, and what was drawn last
    let builtPuzzle: GlassWindow | undefined;
    let builtOpened = -1;
    let scale = 1;
    let centreX = 0;
    let centreY = 0;
    let insets: number[][] = [];
    // Each piece's glass as it is drawn off its tile: a trimmed tile's whole rhombus, part of it hidden by the frame
    // while it is home, or the glass on the tile
    let pieceShapes: number[][] = [];
    // Each tile's outline, through the middle of its lead
    let outers: number[][] = [];
    // The tile across each side of each tile, numbered as its corners are, the side from a corner to the next, or -1
    // at the frame
    let sideNeighbours = new Int32Array(0);
    let sweepPlaces = new Float64Array(0);
    // The window's layers, together, so it can pulse and step back as one, about the middle of its top
    let windowLayer = new Container();
    let windowTop = 0;
    let rim = new Graphics();
    let lead = new Graphics();
    // The solved window's glow: a line of light along each side two pieces share, made the first time the window shows
    // solved, and how far each is along the shimmer's way
    let glowLayer = new Container();
    let glowSides: Graphics[] = [];
    let glowAlongs: number[] = [];
    let isGlowMade = false;
    let glass = new Graphics();
    // The heavier lead round the locked groups, drawn in white and tinted with the lead, and the free pieces' rings
    let locks = new Graphics();
    let rings = new Graphics();
    let ringRadius = 0;
    let outlines = new Graphics();
    let light = new Graphics();
    let groupLayer = new Container();
    // The pieces flying across, hidden outside the frame, so a piece leaving a trimmed tile slides out from behind it,
    // and the pieces settling from where a drag let them go, which may be outside the frame
    let flying = new Container();
    let frameMask = new Graphics();
    let dropping = new Container();
    let flyers: (Container | undefined)[] = [];
    let drawnFlightIds = new Int32Array(0);
    const lifted = new Container();
    lifted.addChild(new Graphics(), new Graphics());
    // The celebration: each piece, to pop as the ripple reaches it, with a light over it, then a sparkle for each, and
    // how far each piece is from the middle, as a share of the furthest, for the sun lighting it. The sunlight is made
    // as the sun comes up, and its strength is passed down to it
    let celebration = new Container();
    let celebrationPieces: Container[] = [];
    let sparkles: Graphics[] = [];
    let sunDistances = new Float64Array(0);
    let isCelebrationMade = false;
    let drawnCelebrationMs = -1;
    let sunlight: Container | undefined;
    let godRays: Container | undefined;
    let sunShare = 0;
    let gestures: SwapGesturesViewModel | undefined;
    let drawnChanges = -1;
    let drawnFlightsBegun = -1;
    let drawnFlightCount = -1;
    let drawnGroupsChanged = -1;
    let drawnLocksMoved = -1;
    let drawnPicked = -2;
    let drawnDragged = -2;
    let drawnTarget = -2;
    let drawnLiftedTile = -1;
    let drawnLiftedPiece = -1;
    let wasSweeping = false;
    build(statePuzzle);
    resetState();

    if (isInteractive) {
        listenToPointer({
            target: view,
            onPressed: (x, y) => gestures?.press(toTileX(x), toTileY(y)),
            onMoved: (x, y) => gestures?.move(toTileX(x), toTileY(y)),
            onReleased: () => gestures?.release(),
            onCancelled: () => gestures?.cancel(),
        });
    }
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        if (bindings.puzzle() !== statePuzzle || bindings.puzzlesOpened() !== stateOpened) resetState();
        const { patch } = statePuzzle;

        // A drag that ended: its piece, let go at the size it had grown to
        let droppedTile = -1;
        if (gestures !== undefined && gestures.dragsEnded !== seenDragsEnded) {
            seenDragsEnded = gestures.dragsEnded;
            droppedTile = gestures.endedTile;
        }
        const droppedScale = 1 + (LIFT_SCALE - 1) * easeInOut(liftMs / LIFT_MS);

        // A swap sends each piece to the other's tile. More than one change at once is shown as it stands
        const changes = bindings.changes();
        if (changes !== seenChanges) {
            const isOneChange = changes === seenChanges + 1;
            seenChanges = changes;
            let a = -1;
            let b = -1;
            let changed = 0;
            for (let t = 0; t < patch.count; t++) {
                const piece = bindings.pieceAt(t);
                if (piece === seenPieces[t]) continue;
                seenPieces[t] = piece;
                changed++;
                if (a < 0) a = t;
                else b = t;
            }
            if (groups.length > 0 && ((a >= 0 && groupOf[a] >= 0) || (b >= 0 && groupOf[b] >= 0))) setGroups([]);
            if (isOneChange && changed === 2) {
                if (droppedTile === a || droppedTile === b) {
                    // The dropped piece settles from where it was let go, into the tile it was dropped on
                    const from = droppedTile;
                    const to = from === a ? b : a;
                    findPose(to);
                    beginFlight(from, FLIGHT_FLY, poseX, poseY, poseRaise, poseTurn - measureTurn(patch, to, from), poseScale);
                    beginFlight(to, FLIGHT_DROP, gestures!.endedX, gestures!.endedY, LIFT_RAISE, -measureTurn(patch, from, to), droppedScale);
                    droppedTile = -1;
                }
                else {
                    findPose(b);
                    const bX = poseX;
                    const bY = poseY;
                    const bRaise = poseRaise;
                    const bTurn = poseTurn;
                    const bScale = poseScale;
                    findPose(a);
                    beginFlight(b, FLIGHT_FLY, poseX, poseY, poseRaise, poseTurn - measureTurn(patch, a, b), poseScale);
                    beginFlight(a, FLIGHT_FLY, bX, bY, bRaise, bTurn - measureTurn(patch, b, a), bScale);
                }
            }
            else flightKinds.fill(FLIGHT_NONE);
        }
        // A piece let go where it couldn't swap settles back home
        if (droppedTile >= 0 && droppedTile < patch.count) {
            beginFlight(droppedTile, FLIGHT_DROP, gestures!.endedX, gestures!.endedY, LIFT_RAISE, 0, droppedScale);
        }

        let flightCount = 0;
        for (let t = 0; t < flightKinds.length; t++) {
            if (flightKinds[t] === FLIGHT_NONE) continue;
            flightMs[t] += deltaMs;
            if (flightMs[t] >= (flightKinds[t] === FLIGHT_DROP ? DROP_MS : FLY_MS)) flightKinds[t] = FLIGHT_NONE;
            else flightCount++;
        }

        // Groups lifting settle back down
        let isGroupEnded = false;
        for (let i = 0; i < groups.length; i++) {
            groups[i].ms += deltaMs;
            if (groups[i].ms >= SETTLE_MS) isGroupEnded = true;
        }
        if (isGroupEnded) setGroups(groups.filter((group) => group.ms < SETTLE_MS));

        // Pieces lock, and unlock, once every piece in flight has landed.
        // The group a piece joins lifts, shakes and settles, as one
        if (flightCount === 0) {
            let joined: number[] | undefined;
            const step = deltaMs / LOCK_GROW_MS;
            let isMoving = false;
            for (let t = 0; t < lockShares.length; t++) {
                const share = lockShares[t];
                const target = bindings.isLockedAt(t) ? 1 : 0;
                if (share === target) continue;
                lockShares[t] = target > share ? Math.min(target, share + step) : Math.max(target, share - step);
                if (lockShares[t] !== share) isMoving = true;
                if (share === 0 && lockShares[t] > 0) (joined ??= []).push(t);
            }
            if (isMoving) locksMoved++;
            // The swap that mends the window starts its celebration instead
            if (joined !== undefined && !bindings.isSolved()) liftGroupsOf(joined);
        }

        // The dragged piece grows from the moment it is lifted
        const dragged = gestures?.draggedTile ?? -1;
        if (dragged !== liftedTile) {
            liftedTile = dragged;
            liftMs = 0;
        }
        else if (dragged >= 0) liftMs = Math.min(LIFT_MS, liftMs + deltaMs);

        // The light sweeps once the picture is solved and its last pieces have landed
        // The celebration starts once the picture is solved and its last pieces have landed
        const isSolved = bindings.isSolved();
        if (isSolved !== isShowingSolved) {
            isShowingSolved = isSolved;
            isCelebrating = isSolved;
            celebrationMs = 0;
            if (isSolved) startRipple(bindings.lastSwappedTile?.() ?? 0);
        }
        if (isCelebrating && flightCount === 0) celebrationMs = Math.min(celebrationEndMs, celebrationMs + deltaMs);
        if (isCelebrating) shimmerMs = (shimmerMs + deltaMs) % SHIMMER_MS;
    }

    function refresh(): void {
        const puzzle = bindings.puzzle();
        if (puzzle !== builtPuzzle || bindings.puzzlesOpened() !== builtOpened) build(puzzle);
        const flightCount = countFlights();
        const changes = bindings.changes();
        const isGlassChanged = changes !== drawnChanges || flightsBegun !== drawnFlightsBegun || flightCount !== drawnFlightCount;
        if (isGlassChanged || groupsChanged !== drawnGroupsChanged || locksMoved !== drawnLocksMoved) drawGlass();
        drawnLocksMoved = locksMoved;
        drawnChanges = changes;
        drawnFlightsBegun = flightsBegun;
        drawnFlightCount = flightCount;
        // As the sun comes up behind the mended window, its lead turns white, and the locked groups' heavier lead fades,
        // as every piece is locked
        sunShare = isCelebrating ? easeInOut((celebrationMs - waveEndMs - SUN_FROM_MS) / SUN_RISE_MS) : 0;
        lead.tint = mixColours(LEAD_COLOR, SOLVED_LEAD_COLOR, sunShare);
        locks.tint = lead.tint;
        locks.alpha = 1 - sunShare;
        drawGlow(sunShare);
        drawOutlines();
        drawGroups();
        drawFlying();
        drawLifted();
        // The band of light sweeps across as the ripple reaches the frame
        const sweepMs = celebrationMs - waveEndMs;
        const isSweeping = isCelebrating && sweepMs >= 0 && sweepMs < SWEEP_MS;
        if (isSweeping || wasSweeping) drawLight(sweepMs);
        wasSweeping = isSweeping;
        drawCelebration();
    }

    /** Starts the presentation state afresh, for the puzzle open now: every piece shown at home, and a picture solved already shown whole, without its celebration. */
    function resetState(): void {
        statePuzzle = bindings.puzzle();
        stateOpened = bindings.puzzlesOpened();
        seenChanges = bindings.changes();
        seenDragsEnded = gestures?.dragsEnded ?? 0;
        const count = statePuzzle.patch.count;
        seenPieces = new Uint16Array(count);
        for (let t = 0; t < count; t++) seenPieces[t] = bindings.pieceAt(t);
        flightKinds = new Uint8Array(count);
        flightMs = new Float64Array(count);
        fromXs = new Float64Array(count);
        fromYs = new Float64Array(count);
        fromRaises = new Float64Array(count);
        fromTurns = new Float64Array(count);
        fromScales = new Float64Array(count);
        flightIds = new Int32Array(count);
        liftedTile = -1;
        liftMs = 0;
        lockShares = new Float64Array(count);
        for (let t = 0; t < count; t++) lockShares[t] = bindings.isLockedAt(t) ? 1 : 0;
        locksMoved++;
        groups = [];
        groupOf = new Int32Array(count).fill(-1);
        groupsChanged++;
        isShowingSolved = bindings.isSolved();
        isCelebrating = false;
        rippleSteps = new Int32Array(count);
        rippleStepMs = 0;
        waveEndMs = 0;
        celebrationEndMs = SUN_FROM_MS + SUN_RISE_MS;
        celebrationMs = 0;
        shimmerMs = 0;
    }

    /**
     * Starts the ripple from tile `origin`: how many steps between
     * neighbours each tile is from it, how long each step takes, so the
     * ripple crosses even a large window quickly, and when the celebration's
     * parts that follow it begin and end.
     */
    function startRipple(origin: number): void {
        const { patch } = statePuzzle;
        const start = origin >= 0 && origin < patch.count ? origin : 0;
        rippleSteps.fill(-1);
        const queue = new Int32Array(patch.count);
        let head = 0;
        let tail = 0;
        rippleSteps[start] = 0;
        queue[tail++] = start;
        let mostSteps = 0;
        while (head < tail) {
            const t = queue[head++];
            mostSteps = rippleSteps[t];
            const near = patch.neighboursOf(t);
            for (let i = 0; i < near.length; i++) {
                if (rippleSteps[near[i]] >= 0) continue;
                rippleSteps[near[i]] = rippleSteps[t] + 1;
                queue[tail++] = near[i];
            }
        }
        // A tile the ripple can't reach goes with the furthest
        for (let t = 0; t < patch.count; t++) if (rippleSteps[t] < 0) rippleSteps[t] = mostSteps;
        rippleStepMs = Math.min(RIPPLE_STEP_MS, RIPPLE_MS / Math.max(1, mostSteps));
        waveEndMs = mostSteps * rippleStepMs;
        celebrationEndMs = waveEndMs + SUN_FROM_MS + SUN_RISE_MS;
    }

    /** Sends the piece now on `tile` to it from a pose: where it was, raised, turned from the tile's own way round, and scaled. */
    function beginFlight(tile: number, kind: number, x: number, y: number, raise: number, turn: number, startScale: number): void {
        flightKinds[tile] = kind;
        flightMs[tile] = 0;
        fromXs[tile] = x;
        fromYs[tile] = y;
        fromRaises[tile] = raise;
        fromTurns[tile] = turn;
        fromScales[tile] = startScale;
        flightsBegun++;
        flightIds[tile] = flightsBegun;
    }

    /**
     * Where the piece on `tile` is shown, into the pose variables: at home,
     * or partway through its flight. A flying piece moves and turns at
     * once, growing as it lifts over the others and shrinking as it comes
     * down. A dropped piece turns first, then settles into its tile.
     */
    function findPose(tile: number): void {
        const { middleXs, middleYs } = statePuzzle.patch;
        const kind = flightKinds[tile];
        if (kind === FLIGHT_NONE) {
            poseX = middleXs[tile];
            poseY = middleYs[tile];
            poseRaise = 0;
            poseTurn = 0;
            poseScale = 1;
            poseLift = 0;
            return;
        }
        let turnShare: number;
        let moveShare: number;
        let bulge = 0;
        if (kind === FLIGHT_DROP) {
            const p = flightMs[tile] / DROP_MS;
            turnShare = easeInOut(p / DROP_TURN_SHARE);
            moveShare = easeInOut((p - DROP_SETTLE_FROM) / (1 - DROP_SETTLE_FROM));
            poseLift = 1 - moveShare;
        }
        else {
            const p = Math.min(1, flightMs[tile] / FLY_MS);
            turnShare = easeInOut(p);
            moveShare = turnShare;
            bulge = Math.sin(Math.PI * p);
            poseLift = bulge;
        }
        poseX = fromXs[tile] + (middleXs[tile] - fromXs[tile]) * moveShare;
        poseY = fromYs[tile] + (middleYs[tile] - fromYs[tile]) * moveShare;
        poseRaise = fromRaises[tile] * (1 - moveShare);
        poseTurn = fromTurns[tile] * (1 - turnShare);
        poseScale = fromScales[tile] + (1 - fromScales[tile]) * moveShare + FLY_GROWTH * bulge;
    }

    /** Builds the board for `puzzle`: its fit, its pieces' shapes, its unchanging layers, and its gestures. */
    function build(puzzle: GlassWindow): void {
        builtPuzzle = puzzle;
        builtOpened = bindings.puzzlesOpened();
        const { patch } = puzzle;
        const { count, cornerStarts, cornerXs, cornerYs, middleXs, middleYs, halfWidth, halfHeight } = patch;
        ({ scale, centreX, centreY } = layOutPicture({ halfWidth, halfHeight, width: bindings.width, height: bindings.height }));

        lifted.removeFromParent();
        for (const child of view.removeChildren()) child.destroy({ children: true });
        // The rim round the window stays dark. The lead is drawn in white and tinted, so it can turn white as the picture
        // is solved. Each tile's outline is the rim's stroke, and the lead's fill covers all of it but the part outside the
        // window
        rim = new Graphics();
        lead = new Graphics();
        insets = [];
        pieceShapes = [];
        outers = [];
        let leftmost = Infinity;
        let rightmost = -Infinity;
        for (let t = 0; t < count; t++) {
            const outer: number[] = [];
            for (let c = cornerStarts[t]; c < cornerStarts[t + 1]; c++) outer.push(centreX + cornerXs[c] * scale, centreY + cornerYs[c] * scale);
            rim.poly(outer).stroke({ color: LEAD_COLOR, width: RIM_WIDTH * 2, join: 'round' });
            lead.poly(outer).fill(0xffffff);
            outers.push(outer);
            insets.push(insetPolygon(outer, LEAD_HALF_WIDTH));
            if (patch.trims[t] === 1) {
                const rhombus: number[] = [];
                for (let k = 0; k < 4; k++) rhombus.push(centreX + patch.rhombusXs[t * 4 + k] * scale, centreY + patch.rhombusYs[t * 4 + k] * scale);
                pieceShapes.push(insetPolygon(rhombus, LEAD_HALF_WIDTH));
            }
            else pieceShapes.push(insets[t]);
            leftmost = Math.min(leftmost, middleXs[t] + middleYs[t] * SWEEP_SLANT);
            rightmost = Math.max(rightmost, middleXs[t] + middleYs[t] * SWEEP_SLANT);
        }
        // Where each tile is along the light's sweep, from 0 to 1: across, and a little down
        sweepPlaces = new Float64Array(count);
        for (let t = 0; t < count; t++) sweepPlaces[t] = (middleXs[t] + middleYs[t] * SWEEP_SLANT - leftmost) / (rightmost - leftmost || 1);

        sideNeighbours = new Int32Array(cornerStarts[count]).fill(-1);
        for (let t = 0; t < count; t++) {
            const near = patch.neighboursOf(t);
            for (let c = cornerStarts[t]; c < cornerStarts[t + 1]; c++) {
                const next = c + 1 < cornerStarts[t + 1] ? c + 1 : cornerStarts[t];
                for (let i = 0; i < near.length; i++) {
                    if (!hasCorner(patch, near[i], cornerXs[c], cornerYs[c]) || !hasCorner(patch, near[i], cornerXs[next], cornerYs[next])) continue;
                    sideNeighbours[c] = near[i];
                    break;
                }
            }
        }

        glass = new Graphics();
        locks = new Graphics();
        rings = new Graphics();
        glowLayer = new Container();
        glowSides = [];
        glowAlongs = [];
        isGlowMade = false;
        ringRadius = Math.max(RING_LEAST, Math.min(RING_MOST, scale * RING_SHARE));
        outlines = new Graphics();
        light = new Graphics();
        groupLayer = new Container();
        flying = new Container();
        frameMask = new Graphics();
        for (let t = 0; t < count; t++) frameMask.poly(outers[t]).fill(0xffffff);
        flying.mask = frameMask;
        dropping = new Container();
        flyers = [];
        for (let t = 0; t < count; t++) flyers.push(undefined);
        drawnFlightIds = new Int32Array(count);
        celebration = new Container();
        celebrationPieces = [];
        sparkles = [];
        isCelebrationMade = false;
        drawnCelebrationMs = -1;
        sunlight = undefined;
        godRays = undefined;
        windowLayer = new Container();
        windowLayer.addChild(rim, lead, glass, locks, rings, glowLayer, outlines, light, groupLayer, frameMask, flying, dropping, lifted, celebration);
        windowTop = centreY - halfHeight * scale;
        windowLayer.pivot.set(centreX, windowTop);
        windowLayer.position.set(centreX, windowTop);
        view.addChild(windowLayer);
        lifted.visible = false;

        if (isInteractive) {
            const edgeX = halfWidth * scale + RIM_WIDTH;
            const edgeY = halfHeight * scale + RIM_WIDTH;
            view.hitArea = new Rectangle(centreX - edgeX, centreY - edgeY, edgeX * 2, edgeY * 2);
            gestures = createSwapGesturesViewModel({
                tileAt: patch.tileAt,
                isLockedAt: bindings.isLockedAt,
                canSwap: bindings.canSwap ?? canSwapFreely,
                onSwapRequested: (a, b) => bindings.onSwapRequested?.(a, b),
            });
        }
        drawnChanges = -1;
        drawnFlightsBegun = -1;
        drawnGroupsChanged = -1;
        drawnLocksMoved = -1;
        drawnPicked = -2;
        drawnDragged = -2;
        drawnTarget = -2;
        drawnLiftedTile = -1;
        drawnLiftedPiece = -1;
        wasSweeping = true;
    }

    /** Whether two tiles can swap, when the board isn't told: any two free ones. */
    function canSwapFreely(a: number, b: number): boolean {
        return a !== b && !bindings.isLockedAt(a) && !bindings.isLockedAt(b);
    }

    /**
     * The glass of every piece at home, the heavier lead round each locked
     * group, and the ring on each free piece. A tile whose piece is in flight,
     * or lifted with its group, stands empty, showing the lead behind. A side
     * of a locked piece gets heavier lead as its piece locks, and loses it as
     * the piece across it locks, so the heavier lead moves out round each
     * piece that joins the group. A ring fades as its piece locks.
     */
    function drawGlass(): void {
        const { colours, patch } = builtPuzzle!;
        // Until the update step has caught up with a new puzzle, every piece is drawn at home
        const isStateCurrent = isStateForBuilt();
        glass.clear();
        locks.clear();
        rings.clear();
        for (let t = 0; t < insets.length; t++) {
            if (isStateCurrent && (flightKinds[t] !== FLIGHT_NONE || groupOf[t] >= 0)) continue;
            const inset = insets[t];
            glass.poly(inset).fill(colours[bindings.pieceAt(t)]);
            const share = isStateCurrent ? lockShares[t] : bindings.isLockedAt(t) ? 1 : 0;
            if (share < 1) drawRing(rings, centreX + patch.middleXs[t] * scale, centreY + patch.middleYs[t] * scale, 1 - share);
            if (share <= 0) continue;
            const start = patch.cornerStarts[t];
            const sides = patch.cornerStarts[t + 1] - start;
            for (let k = 0; k < sides; k++) {
                const across = sideNeighbours[start + k];
                const acrossShare = across < 0 ? 0 : isStateCurrent ? lockShares[across] : bindings.isLockedAt(across) ? 1 : 0;
                const strength = share * (1 - acrossShare);
                if (strength <= 0) continue;
                const next = (k + 1) % sides;
                locks.moveTo(inset[k * 2], inset[k * 2 + 1]).lineTo(inset[next * 2], inset[next * 2 + 1]);
                locks.stroke({ color: 0xffffff, width: LOCK_LEAD_WIDTH * easeInOut(strength), cap: 'round' });
            }
        }
    }

    /** A free piece's ring, round (`x`, `y`), over a faint dark band so it shows on pale glass too, at `alpha`. */
    function drawRing(into: Graphics, x: number, y: number, alpha: number): void {
        into.circle(x, y, ringRadius).stroke({ color: LEAD_COLOR, width: RING_WIDTH + 2, alpha: RING_EDGE_ALPHA * alpha });
        into.circle(x, y, ringRadius).stroke({ color: RING_COLOR, width: RING_WIDTH, alpha });
    }

    /**
     * Lifts the locked group each newly locked tile is in, the locked
     * pieces joined to it neighbour to neighbour. A group already lifting
     * that the new one takes in is put down, and the new one lifts from the
     * start.
     */
    function liftGroupsOf(joined: readonly number[]): void {
        const { patch } = statePuzzle;
        const isTaken = new Uint8Array(patch.count);
        let kept = groups;
        const lifted: LiftingGroup[] = [];
        for (let i = 0; i < joined.length; i++) {
            if (isTaken[joined[i]] === 1) continue;
            const tiles = [joined[i]];
            isTaken[joined[i]] = 1;
            for (let head = 0; head < tiles.length; head++) {
                const near = patch.neighboursOf(tiles[head]);
                for (let j = 0; j < near.length; j++) {
                    if (isTaken[near[j]] === 1 || !bindings.isLockedAt(near[j])) continue;
                    isTaken[near[j]] = 1;
                    tiles.push(near[j]);
                }
            }
            kept = kept.filter((group) => !group.tiles.some((t) => isTaken[t] === 1));
            lifted.push(measureGroup(patch, tiles));
        }
        setGroups(kept.concat(lifted));
    }

    /** Sets the groups lifting, and which tile is in which. */
    function setGroups(next: LiftingGroup[]): void {
        groups = next;
        groupOf.fill(-1);
        for (let i = 0; i < groups.length; i++) for (let j = 0; j < groups[i].tiles.length; j++) groupOf[groups[i].tiles[j]] = i;
        groupsChanged++;
    }

    /**
     * The groups lifting, each one piece: its lead and glass, drawn
     * about its middle as it lifts, and moved, turned and scaled as one every
     * frame. As a large group's edge swings further for the same turn, a
     * group turns and grows only as far as keeps its edge within a few
     * pixels.
     */
    function drawGroups(): void {
        const isStateCurrent = isStateForBuilt();
        const isRebuilt = groupsChanged !== drawnGroupsChanged;
        if (isRebuilt) {
            drawnGroupsChanged = groupsChanged;
            for (const child of groupLayer.removeChildren()) child.destroy({ children: true });
            if (isStateCurrent) for (let i = 0; i < groups.length; i++) groupLayer.addChild(makeGroupView(groups[i]));
        }
        if (!isStateCurrent || groupLayer.children.length !== groups.length) return;
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const groupView = groupLayer.children[i] as Container;
            const p = Math.min(1, group.ms / SETTLE_MS);
            const bump = Math.sin(Math.PI * p);
            const reach = group.reach * scale;
            const growth = Math.min(SETTLE_GROWTH, SETTLE_EDGE_GROWTH / reach);
            const shake = Math.min(SETTLE_SHAKE, SETTLE_EDGE_SHAKE / reach);
            groupView.position.set(centreX + group.x * scale, centreY + group.y * scale - SETTLE_RAISE * bump);
            groupView.rotation = shake * Math.sin(2 * Math.PI * SETTLE_SHAKES * p) * (1 - p);
            groupView.scale.set(1 + growth * bump);
            const shadow = groupView.children[0];
            shadow.alpha = bump;
            shadow.position.set(SHADOW_OFFSET * bump, SHADOW_OFFSET * 1.5 * bump);
            groupView.children[1].tint = lead.tint;
            groupView.children[3].tint = lead.tint;
            groupView.children[3].alpha = locks.alpha;
        }
    }

    /** A group's composite, about its middle: its shadow, its lead (white, to be tinted), its glass, and the heavier lead round it. */
    function makeGroupView(group: LiftingGroup): Container {
        const { colours, patch } = builtPuzzle!;
        const mx = centreX + group.x * scale;
        const my = centreY + group.y * scale;
        const shadow = new Graphics();
        const groupLead = new Graphics();
        const groupGlass = new Graphics();
        const groupLocks = new Graphics();
        const isInGroup = new Uint8Array(outers.length);
        for (let i = 0; i < group.tiles.length; i++) isInGroup[group.tiles[i]] = 1;
        for (let i = 0; i < group.tiles.length; i++) {
            const t = group.tiles[i];
            const outer = shiftPolygon(outers[t], mx, my);
            const inset = shiftPolygon(insets[t], mx, my);
            shadow.poly(outer).fill({ color: 0x000000, alpha: SHADOW_ALPHA });
            groupLead.poly(outer).fill(0xffffff);
            groupGlass.poly(inset).fill(colours[bindings.pieceAt(t)]);
            const start = patch.cornerStarts[t];
            const sides = patch.cornerStarts[t + 1] - start;
            for (let k = 0; k < sides; k++) {
                const across = sideNeighbours[start + k];
                if (across >= 0 && isInGroup[across] === 1) continue;
                const next = (k + 1) % sides;
                groupLocks.moveTo(inset[k * 2], inset[k * 2 + 1]).lineTo(inset[next * 2], inset[next * 2 + 1]);
                groupLocks.stroke({ color: 0xffffff, width: LOCK_LEAD_WIDTH, cap: 'round' });
            }
        }
        const groupView = new Container();
        groupView.addChild(shadow, groupLead, groupGlass, groupLocks);
        return groupView;
    }

    /**
     * The solved window's glow, at `share` of its full brightness, along
     * the lead between its pieces. Its lines are made the first time it
     * shows, and then only shown, faded and brightened, as glints travel
     * across the window, so nothing is drawn again while it shimmers.
     */
    function drawGlow(share: number): void {
        glowLayer.visible = share > 0;
        if (share <= 0) return;
        if (!isGlowMade) makeGlow();
        const wave = (2 * Math.PI * shimmerMs) / SHIMMER_MS;
        for (let i = 0; i < glowSides.length; i++) {
            const glint = 0.5 + 0.5 * Math.sin(wave - glowAlongs[i] * SHIMMER_SPACING);
            glowSides[i].alpha = share * (GLOW_LEAST + (1 - GLOW_LEAST) * glint * glint * glint);
        }
    }

    /** Makes the glow's lines: one along each side two pieces share, through the middle of the lead. */
    function makeGlow(): void {
        isGlowMade = true;
        const { cornerStarts, cornerXs, cornerYs } = builtPuzzle!.patch;
        for (let t = 0; t < outers.length; t++) {
            const outer = outers[t];
            const start = cornerStarts[t];
            const sides = cornerStarts[t + 1] - start;
            for (let k = 0; k < sides; k++) {
                const across = sideNeighbours[start + k];
                // Each shared side once, from the lower numbered of its two tiles. The frame has no glow
                if (across < t) continue;
                const next = (k + 1) % sides;
                const side = new Graphics();
                drawGlowLine(side, outer[k * 2], outer[k * 2 + 1], outer[next * 2], outer[next * 2 + 1]);
                glowLayer.addChild(side);
                glowSides.push(side);
                // Where the side's middle is along the shimmer's way, in tile edges
                const midX = (cornerXs[start + k] + cornerXs[start + next]) / 2;
                const midY = (cornerYs[start + k] + cornerYs[start + next]) / 2;
                glowAlongs.push(midX * SHIMMER_COS + midY * SHIMMER_SIN);
            }
        }
    }

    /** The outline of a piece picked up by a tap, the tile a drag would swap with, and the empty tile a dragged piece left. */
    function drawOutlines(): void {
        const picked = gestures?.pickedTile ?? -1;
        const dragged = gestures?.draggedTile ?? -1;
        const target = gestures?.targetTile ?? -1;
        if (picked === drawnPicked && dragged === drawnDragged && target === drawnTarget) return;
        drawnPicked = picked;
        drawnDragged = dragged;
        drawnTarget = target;
        outlines.clear();
        if (dragged >= 0) outlines.poly(insets[dragged]).fill({ color: LEAD_COLOR, alpha: EMPTY_ALPHA });
        if (picked >= 0) {
            outlines.poly(insets[picked]).stroke({ color: LEAD_COLOR, width: OUTLINE_WIDTH + 2, join: 'round' });
            outlines.poly(insets[picked]).stroke({ color: PICKED_COLOR, width: OUTLINE_WIDTH, join: 'round' });
        }
        if (target >= 0) {
            outlines.poly(insets[target]).fill({ color: TARGET_COLOR, alpha: TARGET_ALPHA });
            outlines.poly(insets[target]).stroke({ color: LEAD_COLOR, width: OUTLINE_WIDTH + 2, join: 'round' });
            outlines.poly(insets[target]).stroke({ color: TARGET_COLOR, width: OUTLINE_WIDTH, join: 'round' });
        }
    }

    /** The pieces in flight: each drawn as its flight begins, shaped for the tile it flies to, and moved every frame. */
    function drawFlying(): void {
        const isStateCurrent = isStateForBuilt();
        for (let t = 0; t < flyers.length; t++) {
            let flyer = flyers[t];
            if (!isStateCurrent || flightKinds[t] === FLIGHT_NONE) {
                if (flyer !== undefined) flyer.visible = false;
                continue;
            }
            if (flyer === undefined) {
                flyer = new Container();
                flyer.addChild(new Graphics(), new Graphics());
                flyers[t] = flyer;
            }
            if (drawnFlightIds[t] !== flightIds[t]) {
                drawnFlightIds[t] = flightIds[t];
                drawPiece(flyer, t, bindings.pieceAt(t));
                // The newest flight goes on top of its layer, and a dropped piece settles over the one flying out from under it
                (flightKinds[t] === FLIGHT_DROP ? dropping : flying).addChild(flyer);
            }
            findPose(t);
            flyer.visible = true;
            flyer.position.set(centreX + poseX * scale, centreY + poseY * scale - poseRaise);
            flyer.rotation = poseTurn;
            flyer.scale.set(poseScale);
            const shadow = flyer.children[0];
            shadow.alpha = poseLift;
            shadow.position.set(SHADOW_OFFSET * poseLift, SHADOW_OFFSET * 1.5 * poseLift);
        }
    }

    /** The piece being dragged, lifted off its tile, growing, and following the pointer. */
    function drawLifted(): void {
        const dragged = gestures?.draggedTile ?? -1;
        lifted.visible = dragged >= 0;
        if (dragged < 0) return;
        // Drawn again for a new piece, as well as a new tile, since a tile picked up again after a swap holds another
        const piece = bindings.pieceAt(dragged);
        if (dragged !== drawnLiftedTile || piece !== drawnLiftedPiece) {
            drawnLiftedTile = dragged;
            drawnLiftedPiece = piece;
            drawPiece(lifted, dragged, piece);
            lifted.children[0].position.set(SHADOW_OFFSET, SHADOW_OFFSET * 1.5);
        }
        lifted.position.set(centreX + gestures!.pointerX * scale, centreY + gestures!.pointerY * scale - LIFT_RAISE);
        // Until the update step has seen this drag begin, the piece is drawn as it was on its tile
        lifted.scale.set(1 + (LIFT_SCALE - 1) * (liftedTile === dragged ? easeInOut(liftMs / LIFT_MS) : 0));
    }

    /**
     * Draws `piece` into a container of a shadow and a pane, shaped as tile
     * `tile`'s piece, about the tile's middle, with a free piece's ring: the
     * whole rhombus, for a tile the frame trims.
     */
    function drawPiece(into: Container, tile: number, piece: number): void {
        const { middleXs, middleYs } = builtPuzzle!.patch;
        const mx = centreX + middleXs[tile] * scale;
        const my = centreY + middleYs[tile] * scale;
        const shape = pieceShapes[tile];
        const about: number[] = [];
        for (let i = 0; i < shape.length; i += 2) about.push(shape[i] - mx, shape[i + 1] - my);
        (into.children[0] as Graphics).clear().poly(about).fill({ color: 0x000000, alpha: SHADOW_ALPHA });
        const pane = (into.children[1] as Graphics).clear().poly(about).fill(builtPuzzle!.colours[piece]).stroke({ color: LEAD_COLOR, width: LEAD_HALF_WIDTH * 2, join: 'round' });
        drawRing(pane, 0, 0, 1);
    }

    /** A band of light sweeping across the picture, `sweepMs` into its sweep, as the celebration's ripple reaches the frame. */
    function drawLight(sweepMs: number): void {
        light.clear();
        if (!isCelebrating || sweepMs < 0 || sweepMs >= SWEEP_MS) return;
        const at = (sweepMs / SWEEP_MS) * (1 + LIGHT_BAND * 2) - LIGHT_BAND;
        for (let t = 0; t < insets.length; t++) {
            const strength = 1 - Math.abs(sweepPlaces[t] - at) / LIGHT_BAND;
            if (strength > 0) light.poly(insets[t]).fill({ color: 0xffffff, alpha: LIGHT_ALPHA * strength });
        }
    }

    /**
     * The mended window's celebration: each piece pops and flashes as the
     * ripple reaches it, with a sparkle at one of its corners, then the
     * window pulses, and steps back as the sun comes up behind it, lighting
     * each piece from the middle out, and the sunlight comes up below.
     * Nothing is drawn again once it ends, but the sunlight's own drift.
     */
    function drawCelebration(): void {
        const isShown = isCelebrating && isStateForBuilt();
        celebration.visible = isShown;
        if (!isShown) {
            windowLayer.scale.set(1);
            if (sunlight !== undefined) sunlight.visible = false;
            if (godRays !== undefined) godRays.visible = false;
            drawnCelebrationMs = -1;
            return;
        }
        if (celebrationMs === drawnCelebrationMs) return;
        drawnCelebrationMs = celebrationMs;
        if (!isCelebrationMade) makeCelebration();

        const afterWave = celebrationMs - waveEndMs;
        const pulse = afterWave >= 0 && afterWave < PULSE_MS ? Math.sin((Math.PI * afterWave) / PULSE_MS) : 0;
        const stepBack = easeInOut((afterWave - STEP_BACK_FROM_MS) / STEP_BACK_MS);
        windowLayer.scale.set((1 - (1 - STEP_BACK_SCALE) * stepBack) * (1 + PULSE_GROWTH * pulse));
        for (let t = 0; t < celebrationPieces.length; t++) {
            const piece = celebrationPieces[t];
            const since = celebrationMs - rippleSteps[t] * rippleStepMs;
            const pop = since >= 0 && since < POP_MS ? Math.sin((Math.PI * since) / POP_MS) : 0;
            const sun = SUN_LIGHT * easeInOut((afterWave - SUN_FROM_MS - sunDistances[t] * SUN_SPREAD_MS) / SUN_GLOW_MS);
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
        if (sunlight === undefined && sunShare > 0) makeSunlight();
        if (sunlight !== undefined) sunlight.visible = true;
        if (godRays !== undefined) godRays.visible = true;
    }

    /**
     * Makes the celebration's pieces, each about its middle: its glass and
     * lead, shown as it pops, and a light over it, added to what is beneath,
     * for its flash and the sun. Then a sparkle at one corner of each.
     */
    function makeCelebration(): void {
        isCelebrationMade = true;
        const { colours, patch } = builtPuzzle!;
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
            celebration.addChild(piece);
            celebrationPieces.push(piece);
        }
        const star = new GraphicsContext().poly(SPARKLE_POINTS).fill(0xffffff);
        for (let t = 0; t < outers.length; t++) {
            const corners = outers[t].length / 2;
            const corner = (t * 3) % corners;
            const sparkle = new Graphics(star);
            sparkle.blendMode = 'add';
            sparkle.position.set(outers[t][corner * 2], outers[t][corner * 2 + 1]);
            sparkle.visible = false;
            celebration.addChild(sparkle);
            sparkles.push(sparkle);
        }
    }

    /**
     * Makes the sunlight, for the window as it stands once stepped back, with
     * its pieces' own colours, and the god rays, from the sun above the
     * window and to its left, reaching on down to the floor.
     */
    function makeSunlight(): void {
        const { colours, patch } = builtPuzzle!;
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
            strength: () => sunShare,
        });
        // Behind the window, so its beams show only where they come out below it
        view.addChildAt(sunlight, 0);
        godRays = GodRaysView({
            sunX: centreX - halfWidth - halfWidth * 2 * SUN_LEFT,
            sunY: windowTop - height * SUN_ABOVE,
            length: height * GOD_RAY_REACH,
            strength: () => sunShare,
        });
        view.addChild(godRays);
    }

    /** Whether the presentation state is for the puzzle built, which it is but for the frame a new puzzle opens. */
    function isStateForBuilt(): boolean {
        return statePuzzle === builtPuzzle && stateOpened === builtOpened;
    }

    function countFlights(): number {
        if (!isStateForBuilt()) return 0;
        let count = 0;
        for (let t = 0; t < flightKinds.length; t++) if (flightKinds[t] !== FLIGHT_NONE) count++;
        return count;
    }

    /** Where a point on the board is in the picture, in tile edges from its middle. */
    function toTileX(x: number): number {
        return (x - centreX) / scale;
    }

    function toTileY(y: number): number {
        return (y - centreY) / scale;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What a tile's piece is doing: at home, flying across from another tile, or settling from where a drag let it go. */
const FLIGHT_NONE = 0;
const FLIGHT_FLY = 1;
const FLIGHT_DROP = 2;
/**
 * How long a locked group takes to lift, shake and settle as a piece joins
 * it, in ms, how much larger it grows and how high it lifts, in pixels, at
 * the top, and how far it turns either way, in radians, and how many times,
 * dying away. A large group grows and turns less, so its edge moves no
 * more than a few pixels.
 */
const SETTLE_MS = 480;
const SETTLE_GROWTH = 0.14;
const SETTLE_RAISE = 5;
const SETTLE_SHAKE = 0.12;
const SETTLE_SHAKES = 3;
const SETTLE_EDGE_GROWTH = 6;
const SETTLE_EDGE_SHAKE = 5;

/** A locked group lifting: its tiles, its middle and how far it reaches from it, in tile edges, and the time since it lifted. */
interface LiftingGroup {
    readonly tiles: readonly number[];
    readonly x: number;
    readonly y: number;
    readonly reach: number;
    ms: number;
}

/** A group lifting from `tiles`, measured from the patch: its middle is the average of its tiles' middles. */
function measureGroup(patch: TilePatch, tiles: readonly number[]): LiftingGroup {
    let x = 0;
    let y = 0;
    for (let i = 0; i < tiles.length; i++) {
        x += patch.middleXs[tiles[i]];
        y += patch.middleYs[tiles[i]];
    }
    x /= tiles.length;
    y /= tiles.length;
    let reach = 0;
    for (let i = 0; i < tiles.length; i++) {
        for (let c = patch.cornerStarts[tiles[i]]; c < patch.cornerStarts[tiles[i] + 1]; c++) {
            reach = Math.max(reach, Math.hypot(patch.cornerXs[c] - x, patch.cornerYs[c] - y));
        }
    }
    return { tiles, x, y, reach, ms: 0 };
}

/** Draws a line of the glow from (`ax`, `ay`) to (`bx`, `by`), in its strokes from wide and faint to narrow and bright. */
function drawGlowLine(into: Graphics, ax: number, ay: number, bx: number, by: number): void {
    for (let i = 0; i < GLOW_WIDTHS.length; i++) {
        into.moveTo(ax, ay).lineTo(bx, by).stroke({ color: GLOW_COLOR, width: GLOW_WIDTHS[i], alpha: GLOW_ALPHAS[i], cap: 'round' });
    }
    into.blendMode = 'add';
}

/** A polygon's corners, given as x, y pairs, moved so (`x`, `y`) is at the origin. */
function shiftPolygon(points: readonly number[], x: number, y: number): number[] {
    const shifted: number[] = [];
    for (let i = 0; i < points.length; i += 2) shifted.push(points[i] - x, points[i + 1] - y);
    return shifted;
}
/** How much larger a flying piece grows halfway, as it lifts over the others. Its time is FLY_MS. */
const FLY_GROWTH = 0.12;
/**
 * How long a dropped piece takes to settle, in ms. It turns in the first
 * share of that time, where it was let go, and starts moving into its tile
 * a little before it has finished turning, so the two run on smoothly.
 */
const DROP_MS = 380;
const DROP_TURN_SHARE = 0.55;
const DROP_SETTLE_FROM = 0.35;
/**
 * The celebration's ripple: how long a step between neighbours takes, at
 * most, in ms, and how long it takes to reach the frame, at most, so a large
 * window's steps are quicker. As it reaches each piece, the piece pops, for
 * POP_MS, growing by POP_GROWTH at most, and flashing as bright as
 * FLASH_ALPHA, and a sparkle at one of its corners grows to SPARKLE_SIZE
 * pixels and fades, turning SPARKLE_TURN radians, over SPARKLE_MS.
 */
const RIPPLE_STEP_MS = 75;
const RIPPLE_MS = 900;
const POP_MS = 340;
const POP_GROWTH = 0.16;
const FLASH_ALPHA = 0.55;
const SPARKLE_MS = 520;
const SPARKLE_SIZE = 9;
const SPARKLE_TURN = 0.9;
/** A sparkle: a star of four points, a unit long, thin between them. */
const SPARKLE_POINTS = [0, -1, 0.2, -0.2, 1, 0, 0.2, 0.2, 0, 1, -0.2, 0.2, -1, 0, -0.2, -0.2];
/**
 * After the ripple reaches the frame: the window's pulse, its time in ms
 * and how much it grows. Then the window steps back, from STEP_BACK_FROM_MS
 * after, over STEP_BACK_MS, to STEP_BACK_SCALE of its size, making room for
 * the floor. Then the sun comes up, from SUN_FROM_MS after, over
 * SUN_RISE_MS, lighting each piece over SUN_GLOW_MS, those furthest from
 * the middle up to SUN_SPREAD_MS later, as bright as SUN_LIGHT.
 */
const PULSE_MS = 480;
const PULSE_GROWTH = 0.035;
const STEP_BACK_FROM_MS = 350;
const STEP_BACK_MS = 1000;
const STEP_BACK_SCALE = 0.78;
const SUN_FROM_MS = 800;
const SUN_RISE_MS = 1800;
const SUN_GLOW_MS = 900;
const SUN_SPREAD_MS = 700;
const SUN_LIGHT = 0.1;
/**
 * Where the sun is, for the god rays: how far left of the window, as a share
 * of its width, and how far above it, as a share of its height, and how far
 * the rays reach, as a share of its height.
 */
const SUN_LEFT = 0.12;
const SUN_ABOVE = 0.28;
const GOD_RAY_REACH = 1.55;
/** How long the light takes to sweep across the solved picture, in ms, how wide its band is, as a share of the picture, and how bright. */
const SWEEP_MS = 1100;
const LIGHT_BAND = 0.22;
const LIGHT_ALPHA = 0.55;
/** How far down the sweep slants as it goes across. */
const SWEEP_SLANT = 0.4;
/**
 * The solved window's glow: a warm white light, laid along the middle of the
 * lead in strokes from wide and faint to narrow and bright, each a width in
 * pixels and an alpha, and added to what is beneath, as light would be. It
 * is this bright between glints, as a share of its brightest.
 */
const GLOW_COLOR = 0xfff6e0;
const GLOW_WIDTHS = [10, 6, 3];
const GLOW_ALPHAS = [0.08, 0.16, 0.35];
const GLOW_LEAST = 0.4;
/**
 * The shimmer: glints travelling across the window, slanted a little from
 * across, one each SHIMMER_MS, about 1 / SHIMMER_SPACING tile edges apart,
 * in radians a tile edge.
 */
const SHIMMER_MS = 2600;
const SHIMMER_SPACING = 1.8;
const SHIMMER_COS = Math.cos(0.5);
const SHIMMER_SIN = Math.sin(0.5);
/** How long a piece takes to lock, its ring fading and the heavier lead growing round it, in ms. */
const LOCK_GROW_MS = 280;
/**
 * The lead round a locked group, half as wide again as the lead between two
 * pieces. It is drawn along the glass's edge, so half of it lies over the
 * glass, adding half a lead's width inside.
 */
const LOCK_LEAD_WIDTH = LEAD_HALF_WIDTH * 2;
/**
 * A free piece's ring: its colour, its radius as a share of a tile edge,
 * kept between these in pixels, its line's width, and how dark the faint
 * band beneath it is.
 */
const RING_COLOR = 0xffffff;
const RING_SHARE = 0.08;
const RING_LEAST = 3;
const RING_MOST = 4.5;
const RING_WIDTH = 1.5;
const RING_EDGE_ALPHA = 0.3;
/** The outlines of the piece picked up and the tile a drag is over. */
const OUTLINE_WIDTH = 2.5;
const TARGET_ALPHA = 0.18;
/** How dark the tile a piece was dragged from goes. */
const EMPTY_ALPHA = 0.75;
/**
 * How much larger a lifted piece grows, and how quickly, in ms, how far
 * above the pointer it is drawn, in pixels, so a finger doesn't hide it,
 * and its shadow.
 */
const LIFT_SCALE = 1.3;
const LIFT_MS = 120;
const LIFT_RAISE = 6;
const SHADOW_OFFSET = 4;
const SHADOW_ALPHA = 0.28;

/** Whether tile `tile` of `patch` has a corner at (`x`, `y`). */
function hasCorner(patch: TilePatch, tile: number, x: number, y: number): boolean {
    for (let c = patch.cornerStarts[tile]; c < patch.cornerStarts[tile + 1]; c++) {
        if (Math.abs(patch.cornerXs[c] - x) < CORNER_TOLERANCE && Math.abs(patch.cornerYs[c] - y) < CORNER_TOLERANCE) return true;
    }
    return false;
}

/** How close two corners are, in tile edges, to be taken as the same. */
const CORNER_TOLERANCE = 1e-6;

/**
 * The corners of a polygon, given as x, y pairs, round it the way every
 * tile goes, each moved inwards so every side moves `distance` in: the
 * glass inside its lead.
 */
function insetPolygon(points: readonly number[], distance: number): number[] {
    const n = points.length / 2;
    const inset: number[] = [];
    for (let k = 0; k < n; k++) {
        const px = points[((k + n - 1) % n) * 2];
        const py = points[((k + n - 1) % n) * 2 + 1];
        const cx = points[k * 2];
        const cy = points[k * 2 + 1];
        const nx = points[((k + 1) % n) * 2];
        const ny = points[((k + 1) % n) * 2 + 1];
        const [n1x, n1y] = inwardNormal(px, py, cx, cy);
        const [n2x, n2y] = inwardNormal(cx, cy, nx, ny);
        const along = distance / (1 + n1x * n2x + n1y * n2y);
        inset.push(cx + (n1x + n2x) * along, cy + (n1y + n2y) * along);
    }
    return inset;
}

/** The unit normal of the side from (ax, ay) to (bx, by) that points into its tile, given the way every tile goes round. */
function inwardNormal(ax: number, ay: number, bx: number, by: number): [number, number] {
    const length = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / length, (bx - ax) / length];
}

/** A colour partway from `a` to `b`, each 0xRRGGBB, mixed channel by channel. */
function mixColours(a: number, b: number, t: number): number {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const r = Math.round(((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t);
    const g = Math.round(((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t);
    const bl = Math.round((a & 0xff) + ((b & 0xff) - (a & 0xff)) * t);
    return (r << 16) | (g << 8) | bl;
}

function easeInOut(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}
