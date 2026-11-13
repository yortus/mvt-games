import type { GlassWindow, TilePatch } from '../models';
import { easeInOut } from './ease-in-out';
import { measureTurn } from './measure-turn';
import type { SwapGesturesViewModel } from './swap-gestures-view-model';
import { FLY_MS, LIFT_RAISE, SETTLE_MS, SUN_FROM_MS } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The board's presentation state, and the rules that tie it together: the
 * pieces in flight to their tiles, the dragged piece's lift, how far each
 * piece has locked, the locked groups lifting, and the mended window's
 * celebration. Positions are in tile edges from the picture's middle, so a
 * test reads them without a renderer.
 *
 * - **A swap** sends each piece to the other's tile, moving and turning to
 *   fit it. A piece dropped by a drag settles from where it was let go,
 *   while the piece it swapped with flies across. A piece let go where it
 *   can't swap settles back home. More than one change at once is shown as
 *   it stands.
 * - **Pieces lock**, and unlock, only once every piece in flight has landed,
 *   and the group a piece joins lifts, shakes and settles. A group a swap
 *   breaks into is put down at once.
 * - **The celebration** starts once the picture is solved while it shows,
 *   and runs once its last pieces have landed: a ripple out from the piece
 *   swapped last, neighbour by neighbour, then the sun coming up. A picture
 *   opened solved doesn't celebrate. The swap that mends the window lifts
 *   no group, since the celebration takes over.
 *
 * A new puzzle, or the same one opened again, starts it all afresh.
 */
export interface BoardViewModel {
    /** The puzzle the state is for, and the count of puzzles opened when it was started. The board draws every piece at home for any other. */
    readonly puzzle: GlassWindow;
    readonly puzzlesOpened: number;
    /** What the piece on `tile` is doing: at home, flying across from another tile, or settling from where a drag let it go. */
    flightKindAt: (tile: number) => FlightKind;
    /** A number for the flight of `tile`'s piece, different for each flight begun, so the board draws each piece as its flight begins. */
    flightIdAt: (tile: number) => number;
    /** A count that rises with each flight begun. */
    readonly flightsBegun: number;
    /** How many pieces are in flight. */
    readonly flightCount: number;
    /**
     * Where the piece on `tile` is shown, into `pose`: at home, or partway
     * through its flight. A flying piece moves and turns at once, growing as
     * it lifts over the others and shrinking as it comes down. A dropped
     * piece turns first, then settles into its tile.
     */
    findPose: (tile: number, pose: PiecePose) => void;
    /** How far the piece on `tile` has locked, from 0, free, to 1, locked. */
    lockShareAt: (tile: number) => number;
    /** A count that rises as any piece's lock share moves. */
    readonly locksMoved: number;
    /** The locked groups lifting. */
    readonly groups: readonly LiftingGroup[];
    /** The index in `groups` of the group lifting that `tile` is in, or -1. */
    groupAt: (tile: number) => number;
    /** A count that rises as groups start and end. */
    readonly groupsChanged: number;
    /** The tile whose piece is being dragged, as the update step last saw it, or -1, and how large the piece has grown since it was lifted. */
    readonly liftedTile: number;
    readonly liftScale: number;
    /** Whether the picture celebrates: only one solved while it shows. */
    readonly isCelebrating: boolean;
    /** The time since the picture was solved and its last pieces landed, through its celebration, in ms. */
    readonly celebrationMs: number;
    /** The time since the ripple reached the frame, in ms: negative until it does. */
    readonly afterWaveMs: number;
    /** The time since the ripple reached `tile`, in ms: negative until it does. */
    rippleMsAt: (tile: number) => number;
    /** How far the sun has come up behind the mended window, from 0 to 1. */
    readonly sunShare: number;
    /** How far through its shimmer the mended window's glow is, from 0 to 1, round and round. */
    readonly shimmerShare: number;
    update: (deltaMs: number) => void;
}

/** What a piece is doing: at home, flying across from another tile, or settling from where a drag let it go. */
export type FlightKind = 'none' | 'fly' | 'drop';

/**
 * Where a piece is shown, which `findPose` fills in: in tile edges from the
 * picture's middle, raised in pixels, turned from its tile's own way round,
 * scaled, and how high its shadow is, from 0 to 1.
 */
export interface PiecePose {
    x: number;
    y: number;
    raise: number;
    turn: number;
    scale: number;
    lift: number;
}

/** A locked group lifting: its tiles, its middle and how far it reaches from it, in tile edges, and the time since it lifted. */
export interface LiftingGroup {
    readonly tiles: readonly number[];
    readonly x: number;
    readonly y: number;
    readonly reach: number;
    readonly ms: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardViewModelOptions {
    readonly puzzle: () => GlassWindow;
    readonly puzzlesOpened: () => number;
    readonly pieceAt: (tile: number) => number;
    readonly isLockedAt: (tile: number) => boolean;
    readonly isSolved: () => boolean;
    /** The tile swapped last, which the celebration ripples out from. Without it, the first. */
    readonly lastSwappedTile?: () => number;
    /** A count that rises with every swap. */
    readonly changes: () => number;
    /** The board's gestures, made afresh for each puzzle, or `undefined` while the board takes no input. */
    readonly gestures: () => SwapGesturesViewModel | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the board's presentation state, for the puzzle open now: every piece shown at home, and a picture solved already shown whole. */
export function createBoardViewModel(options: BoardViewModelOptions): BoardViewModel {
    const { puzzle, puzzlesOpened, pieceAt, isLockedAt, isSolved, lastSwappedTile, changes, gestures } = options;

    // The puzzle the state is for, and what was last seen of it: the piece on each tile, and the drags ended
    let statePuzzle = puzzle();
    let stateOpened = puzzlesOpened();
    let seenChanges = 0;
    let seenPieces = new Uint16Array(0);
    let seenDragsEnded = 0;
    // The pieces in flight to their tiles. A flight starts in tile edges from the picture's middle, raised some
    // pixels, turned from its tile's own way round, and scaled
    let flightKinds = new Uint8Array(0);
    let flightMs = new Float64Array(0);
    let fromXs = new Float64Array(0);
    let fromYs = new Float64Array(0);
    let fromRaises = new Float64Array(0);
    let fromTurns = new Float64Array(0);
    let fromScales = new Float64Array(0);
    let flightCount = 0;
    // Rises with each flight begun, and marks each tile's flight with it
    let flightsBegun = 0;
    let flightIds = new Int32Array(0);
    // The dragged piece, and how long since it was lifted
    let liftedTile = -1;
    let liftMs = 0;
    let isShowingSolved = false;
    let isCelebrating = false;
    // The time since the picture was solved and its last pieces landed, and the ripple's way out: each tile's steps
    // between neighbours from the piece swapped last, the time each step takes, when the ripple reaches the frame,
    // and when the celebration ends
    let celebrationMs = 0;
    let rippleSteps = new Int32Array(0);
    let rippleStepMs = 0;
    let waveEndMs = 0;
    let celebrationEndMs = 0;
    let shimmerMs = 0;
    // How far each piece has locked, and a count that rises as any of them moves
    let lockShares = new Float64Array(0);
    let locksMoved = 0;
    // The locked groups lifting, the group each tile is in, or -1, and a count that rises as groups start and end
    let groups: MovingGroup[] = [];
    let groupOf = new Int32Array(0);
    let groupsChanged = 0;
    // Where a piece is shown, for the flights a swap begins
    const pose: PiecePose = { x: 0, y: 0, raise: 0, turn: 0, scale: 1, lift: 0 };
    resetState();

    return {
        get puzzle() { return statePuzzle; },
        get puzzlesOpened() { return stateOpened; },
        flightKindAt: (tile) => FLIGHT_KINDS[flightKinds[tile]],
        flightIdAt: (tile) => flightIds[tile],
        get flightsBegun() { return flightsBegun; },
        get flightCount() { return flightCount; },
        findPose,
        lockShareAt: (tile) => lockShares[tile],
        get locksMoved() { return locksMoved; },
        get groups() { return groups; },
        groupAt: (tile) => groupOf[tile],
        get groupsChanged() { return groupsChanged; },
        get liftedTile() { return liftedTile; },
        get liftScale() { return 1 + (LIFT_SCALE - 1) * easeInOut(liftMs / LIFT_MS); },
        get isCelebrating() { return isCelebrating; },
        get celebrationMs() { return celebrationMs; },
        get afterWaveMs() { return celebrationMs - waveEndMs; },
        rippleMsAt: (tile) => celebrationMs - rippleSteps[tile] * rippleStepMs,
        get sunShare() { return isCelebrating ? easeInOut((celebrationMs - waveEndMs - SUN_FROM_MS) / SUN_RISE_MS) : 0; },
        get shimmerShare() { return shimmerMs / SHIMMER_MS; },
        update,
    };

    function update(deltaMs: number): void {
        if (puzzle() !== statePuzzle || puzzlesOpened() !== stateOpened) resetState();
        const { patch } = statePuzzle;
        const gesturesNow = gestures();

        // A drag that ended: its piece, let go at the size it had grown to
        let droppedTile = -1;
        if (gesturesNow !== undefined && gesturesNow.dragsEnded !== seenDragsEnded) {
            seenDragsEnded = gesturesNow.dragsEnded;
            droppedTile = gesturesNow.endedTile;
        }
        const droppedScale = 1 + (LIFT_SCALE - 1) * easeInOut(liftMs / LIFT_MS);

        // A swap sends each piece to the other's tile. More than one change at once is shown as it stands
        const changesNow = changes();
        if (changesNow !== seenChanges) {
            const isOneChange = changesNow === seenChanges + 1;
            seenChanges = changesNow;
            let a = -1;
            let b = -1;
            let changed = 0;
            for (let t = 0; t < patch.count; t++) {
                const piece = pieceAt(t);
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
                    findPose(to, pose);
                    beginFlight(from, FLIGHT_FLY, pose.x, pose.y, pose.raise, pose.turn - measureTurn(patch, to, from), pose.scale);
                    beginFlight(to, FLIGHT_DROP, gesturesNow!.endedX, gesturesNow!.endedY, LIFT_RAISE, -measureTurn(patch, from, to), droppedScale);
                    droppedTile = -1;
                }
                else {
                    findPose(b, pose);
                    const bX = pose.x;
                    const bY = pose.y;
                    const bRaise = pose.raise;
                    const bTurn = pose.turn;
                    const bScale = pose.scale;
                    findPose(a, pose);
                    beginFlight(b, FLIGHT_FLY, pose.x, pose.y, pose.raise, pose.turn - measureTurn(patch, a, b), pose.scale);
                    beginFlight(a, FLIGHT_FLY, bX, bY, bRaise, bTurn - measureTurn(patch, b, a), bScale);
                }
            }
            else flightKinds.fill(FLIGHT_NONE);
        }
        // A piece let go where it couldn't swap settles back home
        if (droppedTile >= 0 && droppedTile < patch.count) {
            beginFlight(droppedTile, FLIGHT_DROP, gesturesNow!.endedX, gesturesNow!.endedY, LIFT_RAISE, 0, droppedScale);
        }

        flightCount = 0;
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

        // Pieces lock, and unlock, once every piece in flight has landed. The group a piece joins lifts, shakes and
        // settles, as one
        if (flightCount === 0) {
            let joined: number[] | undefined;
            const step = deltaMs / LOCK_GROW_MS;
            let isMoving = false;
            for (let t = 0; t < lockShares.length; t++) {
                const share = lockShares[t];
                const target = isLockedAt(t) ? 1 : 0;
                if (share === target) continue;
                lockShares[t] = target > share ? Math.min(target, share + step) : Math.max(target, share - step);
                if (lockShares[t] !== share) isMoving = true;
                if (share === 0 && lockShares[t] > 0) (joined ??= []).push(t);
            }
            if (isMoving) locksMoved++;
            // The swap that mends the window starts its celebration instead
            if (joined !== undefined && !isSolved()) liftGroupsOf(joined);
        }

        // The dragged piece grows from the moment it is lifted
        const dragged = gesturesNow?.draggedTile ?? -1;
        if (dragged !== liftedTile) {
            liftedTile = dragged;
            liftMs = 0;
        }
        else if (dragged >= 0) liftMs = Math.min(LIFT_MS, liftMs + deltaMs);

        // The celebration starts once the picture is solved, and runs once its last pieces have landed
        const isSolvedNow = isSolved();
        if (isSolvedNow !== isShowingSolved) {
            isShowingSolved = isSolvedNow;
            isCelebrating = isSolvedNow;
            celebrationMs = 0;
            if (isSolvedNow) startRipple(lastSwappedTile?.() ?? 0);
        }
        if (isCelebrating && flightCount === 0) celebrationMs = Math.min(celebrationEndMs, celebrationMs + deltaMs);
        if (isCelebrating) shimmerMs = (shimmerMs + deltaMs) % SHIMMER_MS;
    }

    /** Starts the state afresh, for the puzzle open now: every piece shown at home, and a picture solved already shown whole, without its celebration. */
    function resetState(): void {
        statePuzzle = puzzle();
        stateOpened = puzzlesOpened();
        seenChanges = changes();
        seenDragsEnded = gestures()?.dragsEnded ?? 0;
        const count = statePuzzle.patch.count;
        seenPieces = new Uint16Array(count);
        for (let t = 0; t < count; t++) seenPieces[t] = pieceAt(t);
        flightKinds = new Uint8Array(count);
        flightMs = new Float64Array(count);
        fromXs = new Float64Array(count);
        fromYs = new Float64Array(count);
        fromRaises = new Float64Array(count);
        fromTurns = new Float64Array(count);
        fromScales = new Float64Array(count);
        flightIds = new Int32Array(count);
        flightCount = 0;
        liftedTile = -1;
        liftMs = 0;
        lockShares = new Float64Array(count);
        for (let t = 0; t < count; t++) lockShares[t] = isLockedAt(t) ? 1 : 0;
        locksMoved++;
        groups = [];
        groupOf = new Int32Array(count).fill(-1);
        groupsChanged++;
        isShowingSolved = isSolved();
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

    function findPose(tile: number, into: PiecePose): void {
        const { middleXs, middleYs } = statePuzzle.patch;
        const kind = flightKinds[tile];
        if (kind === FLIGHT_NONE) {
            into.x = middleXs[tile];
            into.y = middleYs[tile];
            into.raise = 0;
            into.turn = 0;
            into.scale = 1;
            into.lift = 0;
            return;
        }
        let turnShare: number;
        let moveShare: number;
        let bulge = 0;
        if (kind === FLIGHT_DROP) {
            const p = flightMs[tile] / DROP_MS;
            turnShare = easeInOut(p / DROP_TURN_SHARE);
            moveShare = easeInOut((p - DROP_SETTLE_FROM) / (1 - DROP_SETTLE_FROM));
            into.lift = 1 - moveShare;
        }
        else {
            const p = Math.min(1, flightMs[tile] / FLY_MS);
            turnShare = easeInOut(p);
            moveShare = turnShare;
            bulge = Math.sin(Math.PI * p);
            into.lift = bulge;
        }
        into.x = fromXs[tile] + (middleXs[tile] - fromXs[tile]) * moveShare;
        into.y = fromYs[tile] + (middleYs[tile] - fromYs[tile]) * moveShare;
        into.raise = fromRaises[tile] * (1 - moveShare);
        into.turn = fromTurns[tile] * (1 - turnShare);
        into.scale = fromScales[tile] + (1 - fromScales[tile]) * moveShare + FLY_GROWTH * bulge;
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
        const lifted: MovingGroup[] = [];
        for (let i = 0; i < joined.length; i++) {
            if (isTaken[joined[i]] === 1) continue;
            const tiles = [joined[i]];
            isTaken[joined[i]] = 1;
            for (let head = 0; head < tiles.length; head++) {
                const near = patch.neighboursOf(tiles[head]);
                for (let j = 0; j < near.length; j++) {
                    if (isTaken[near[j]] === 1 || !isLockedAt(near[j])) continue;
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
    function setGroups(next: MovingGroup[]): void {
        groups = next;
        groupOf.fill(-1);
        for (let i = 0; i < groups.length; i++) for (let j = 0; j < groups[i].tiles.length; j++) groupOf[groups[i].tiles[j]] = i;
        groupsChanged++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What a tile's piece is doing, as kept for each tile, and the kind each stands for. */
const FLIGHT_NONE = 0;
const FLIGHT_FLY = 1;
const FLIGHT_DROP = 2;
const FLIGHT_KINDS: readonly FlightKind[] = ['none', 'fly', 'drop'];

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
/** How much larger a dragged piece grows, and how quickly, in ms. */
const LIFT_SCALE = 1.3;
const LIFT_MS = 120;
/** How long a piece takes to lock, its ring fading and the heavier lead growing round it, in ms. */
const LOCK_GROW_MS = 280;
/**
 * The celebration's ripple: how long a step between neighbours takes, at
 * most, in ms, and how long it takes to reach the frame, at most, so a large
 * window's steps are quicker.
 */
const RIPPLE_STEP_MS = 75;
const RIPPLE_MS = 900;
/** How long the sun takes to come up behind the mended window, in ms, once it starts, at SUN_FROM_MS. */
const SUN_RISE_MS = 1800;
/** How long one glint takes to cross the mended window's glow, in ms: the shimmer's period. */
const SHIMMER_MS = 2600;

/** A group lifting, as the view model keeps it, with its time moving on. */
interface MovingGroup {
    readonly tiles: readonly number[];
    readonly x: number;
    readonly y: number;
    readonly reach: number;
    ms: number;
}

/** A group lifting from `tiles`, measured from the patch: its middle is the average of its tiles' middles. */
function measureGroup(patch: TilePatch, tiles: readonly number[]): MovingGroup {
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
