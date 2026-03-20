import gsap from 'gsap';
import {
    type Direction,
    type EnemyKind,
    type EnemyPhase,
    type InflationStage,
    DIRECTION_DELTA,
    oppositeDirection,
} from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EnemyModel {
    readonly col: number;
    readonly row: number;
    readonly direction: Direction;
    readonly kind: EnemyKind;
    readonly phase: EnemyPhase;
    readonly inflationStage: InflationStage;
    readonly alive: boolean;
    /** Whether this Fygar is currently breathing fire. */
    readonly fireActive: boolean;
    /** Whether this Fygar is telegraphing an imminent fire attack. */
    readonly fireTelegraph: boolean;
    /** Whether this enemy has been told to flee (last enemy alive). */
    readonly fleeing: boolean;
    /** Advance inflation by one stage. Returns true if enemy popped. */
    inflate(): boolean;
    /** Called by game-model when crushed by a rock. */
    crush(): void;
    /** Trigger fleeing behaviour (last enemy alive). */
    startFleeing(): void;
    /** Reset to initial state. */
    reset(row: number, col: number): void;
    /** Advance model state. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EnemyModelOptions {
    startRow: number;
    startCol: number;
    kind: EnemyKind;
    /** Tiles per second. */
    speed: number;
    /** Seconds between ghost-through-dirt attempts. */
    ghostInterval: number;
    /** Field dimensions for ghost bounds. */
    fieldRows: number;
    fieldCols: number;
    /** Returns whether the given tile can be walked on normally. */
    isWalkable: (row: number, col: number) => boolean;
    /** Live reference to the chase target (typically the digger). */
    chaseTarget: { readonly row: number; readonly col: number };
    /** Called before entering ghosting - return false to deny (e.g. another enemy is already ghosting). */
    canStartGhosting?: () => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const INFLATE_DEFLATE_RATE = 1.5; // stages per second when deflating
const GHOST_SPEED_FACTOR = 0.4; // ghosting is slower than normal
const FIRE_TELEGRAPH_MS = 600;
const FIRE_DURATION_MS = 800;
const FIRE_COOLDOWN_MS = 4000;
const FIRE_RANGE = 3; // tiles

const NEXT_INFLATION: readonly InflationStage[] = [1, 2, 3, 4, 4];

export function createEnemyModel(options: EnemyModelOptions): EnemyModel {
    const {
        startRow,
        startCol,
        kind,
        speed,
        ghostInterval,
        fieldRows,
        fieldCols,
        isWalkable,
        chaseTarget,
        canStartGhosting,
    } = options;

    const state = {
        col: startCol,
        row: startRow,
        tileCol: startCol,
        tileRow: startRow,
        direction: 'left' as Direction,
        moving: false,
        alive: true,
        phase: 'patrol' as EnemyPhase,
        inflationStage: 0 as InflationStage,
        ghostMovesRemaining: 0,
        fireActive: false,
        fireTelegraph: false,
        fireReady: false,
        fleeing: false,
        patrolSwitchTimer: 0,
    };

    const timeline = gsap.timeline({ paused: true });
    const fireTimeline = gsap.timeline({ paused: true });
    const deflateTimeline = gsap.timeline({ paused: true });
    const ghostTimeline = gsap.timeline({ paused: true });

    // ---- Public record -----------------------------------------------------

    const model: EnemyModel = {
        get col() {
            return state.col;
        },
        get row() {
            return state.row;
        },
        get direction() {
            return state.direction;
        },
        kind,
        get phase() {
            return state.phase;
        },
        get inflationStage() {
            return state.inflationStage;
        },
        get alive() {
            return state.alive;
        },
        get fireActive() {
            return state.fireActive;
        },
        get fireTelegraph() {
            return state.fireTelegraph;
        },
        get fleeing() {
            return state.fleeing;
        },

        inflate(): boolean {
            if (!state.alive || state.phase === 'popped' || state.phase === 'crushed') return false;

            state.phase = 'inflating';
            timeline.clear().time(0);
            fireTimeline.clear().time(0);
            deflateTimeline.clear().time(0);
            state.fireTelegraph = false;
            state.fireActive = false;
            state.moving = false;

            if (state.inflationStage < 4) {
                state.inflationStage = NEXT_INFLATION[state.inflationStage];
            }
            if (state.inflationStage === 4) {
                state.phase = 'popped';
                state.alive = false;
                return true;
            }
            scheduleDeflation();
            return false;
        },

        crush(): void {
            state.phase = 'crushed';
            state.alive = false;
            timeline.clear().time(0);
            fireTimeline.clear().time(0);
            deflateTimeline.clear().time(0);
            ghostTimeline.clear().time(0);
            state.moving = false;
        },

        startFleeing(): void {
            if (!state.alive) return;
            if (state.fleeing) return; // already triggered
            state.fleeing = true;
            state.fireActive = false;
            state.fireTelegraph = false;
            fireTimeline.clear().time(0);

            // If currently inflating, let inflation continue - flee after deflation
            if (state.phase === 'inflating') return;

            // If trapped in dirt (not on walkable tile), ghost to surface
            if (!isWalkable(state.tileRow, state.tileCol)) {
                state.phase = 'ghosting';
                timeline.clear().time(0);
                ghostTimeline.clear().time(0);
                state.moving = false;
                return;
            }

            // On surface or in tunnel - flee normally
            state.phase = 'fleeing';
            timeline.clear().time(0);
            ghostTimeline.clear().time(0);
            state.moving = false;
        },

        reset(row: number, col: number): void {
            timeline.clear().time(0);
            fireTimeline.clear().time(0);
            deflateTimeline.clear().time(0);
            ghostTimeline.clear().time(0);
            state.col = col;
            state.row = row;
            state.tileCol = col;
            state.tileRow = row;
            state.direction = 'left';
            state.moving = false;
            state.alive = true;
            state.phase = 'patrol';
            state.inflationStage = 0;
            state.ghostMovesRemaining = 0;
            state.fireActive = false;
            state.fireTelegraph = false;
            state.fireReady = false;
            state.fleeing = false;
            state.patrolSwitchTimer = 2000;
            scheduleFireCooldown();
            scheduleGhostCountdown(ghostInterval);
        },

        update(deltaMs: number): void {
            if (!state.alive) return;

            const dt = 0.001 * deltaMs;

            // 1. Advance all timelines
            timeline.time(timeline.time() + dt);
            fireTimeline.time(fireTimeline.time() + dt);
            deflateTimeline.time(deflateTimeline.time() + dt);
            ghostTimeline.time(ghostTimeline.time() + dt);

            // 2. Phase-specific early returns
            if (state.phase === 'inflating') return;
            if (kind === 'fygar' && (state.fireTelegraph || state.fireActive)) return;
            if (state.phase === 'ghosting') {
                advanceGhosting();
                return;
            }
            if (checkFleeEscape()) return;

            // 3. Orchestration
            if (state.phase === 'patrol') {
                state.patrolSwitchTimer -= deltaMs;
                const dist = distanceSq(state.tileRow, state.tileCol, chaseTarget.row, chaseTarget.col);
                if (dist < 36) state.phase = 'chase';
            }
            if (canFireNow()) {
                scheduleFireSequence();
                return;
            }
            if (!state.moving) scheduleMove();
        },
    };

    // Kick off initial timers
    scheduleFireCooldown();
    scheduleGhostCountdown(ghostInterval);

    return model;

    // ---- Helpers -----------------------------------------------------------

    function distanceSq(r1: number, c1: number, r2: number, c2: number): number {
        return (r1 - r2) ** 2 + (c1 - c2) ** 2;
    }

    /** Returns true if the digger is on the same row, in the direction we face, and within fire range. */
    function isDiggerInFireLine(): boolean {
        if (state.tileRow !== Math.round(chaseTarget.row)) return false;
        const dc = Math.round(chaseTarget.col) - state.tileCol;
        if (dc === 0) return false;
        if (state.direction === 'right' && dc > 0 && dc <= FIRE_RANGE) return true;
        if (state.direction === 'left' && dc < 0 && -dc <= FIRE_RANGE) return true;
        return false;
    }

    function scheduleFireSequence(): void {
        state.fireTelegraph = true;
        state.fireReady = false;
        // Stop movement for telegraph
        timeline.clear().time(0);
        state.moving = false;

        const telegraphEnd = FIRE_TELEGRAPH_MS * 0.001;
        const fireEnd = telegraphEnd + FIRE_DURATION_MS * 0.001;
        const cooldownEnd = fireEnd + FIRE_COOLDOWN_MS * 0.001;

        fireTimeline.clear().time(0);
        // Telegraph → fire
        fireTimeline.call(
            () => {
                state.fireTelegraph = false;
                state.fireActive = true;
            },
            undefined,
            telegraphEnd,
        );
        // Fire → cooldown
        fireTimeline.call(
            () => {
                state.fireActive = false;
            },
            undefined,
            fireEnd,
        );
        // Cooldown → ready
        fireTimeline.call(
            () => {
                state.fireReady = true;
            },
            undefined,
            cooldownEnd,
        );
    }

    function scheduleFireCooldown(): void {
        state.fireReady = false;
        fireTimeline.clear().time(0);
        fireTimeline.call(
            () => {
                state.fireReady = true;
            },
            undefined,
            FIRE_COOLDOWN_MS * 0.001,
        );
    }

    function scheduleDeflation(): void {
        const stages = state.inflationStage;
        if (stages <= 0) return;
        const duration = stages / INFLATE_DEFLATE_RATE;

        deflateTimeline.clear().time(0);
        deflateTimeline.to(state, { inflationStage: 0, duration, ease: 'none', roundProps: 'inflationStage' });
        deflateTimeline.call(
            () => {
                state.inflationStage = 0;
                if (state.fleeing) {
                    // Resume flee: ghost through dirt to surface
                    state.phase = 'ghosting';
                    timeline.clear().time(0);
                    state.moving = false;
                }
                else {
                    state.phase = 'chase';
                }
                if (kind === 'fygar') scheduleFireCooldown();
            },
            undefined,
            duration,
        );
    }

    function scheduleGhostCountdown(delaySec: number): void {
        ghostTimeline.clear().time(0);
        ghostTimeline.call(attemptGhosting, undefined, delaySec);
    }

    function attemptGhosting(): void {
        if (state.phase !== 'patrol' && state.phase !== 'chase') {
            scheduleGhostCountdown(ghostInterval);
            return;
        }
        if (canStartGhosting && !canStartGhosting()) {
            // Denied - retry sooner
            scheduleGhostCountdown(ghostInterval * 0.5);
            return;
        }
        state.phase = 'ghosting';
        state.ghostMovesRemaining = 3;
        timeline.clear().time(0);
        state.moving = false;
        // Schedule next ghost attempt for after this one ends
        scheduleGhostCountdown(ghostInterval);
    }

    function advanceGhosting(): void {
        if (state.moving) return;
        // Flee-ghosting: exit to normal fleeing once on a walkable tile
        if (state.fleeing && isWalkable(state.tileRow, state.tileCol)) {
            state.phase = 'fleeing';
            return;
        }
        // Normal ghosting: exit after min moves on a walkable tile
        if (!state.fleeing && state.ghostMovesRemaining <= 0 && isWalkable(state.tileRow, state.tileCol)) {
            state.phase = 'chase';
            return;
        }
        state.ghostMovesRemaining--;
        if (state.fleeing) {
            scheduleFleeGhostMove();
        }
        else {
            scheduleGhostMove();
        }
    }

    function checkFleeEscape(): boolean {
        if (state.phase !== 'fleeing') return false;
        if (state.tileRow === 0 && state.tileCol === 0) {
            state.alive = false;
            state.phase = 'popped';
            return true;
        }
        return false;
    }

    function canFireNow(): boolean {
        if (kind !== 'fygar') return false;
        if (state.fireTelegraph || state.fireActive) return false;
        if (state.phase === 'ghosting' || state.phase === 'fleeing' || state.phase === 'inflating') return false;
        // Fire immediately when digger is in range (override cooldown)
        if (isDiggerInFireLine()) return true;
        // Fire when cooldown has expired
        return state.fireReady;
    }

    function choosePatrolDirection(): Direction {
        const reverse = oppositeDirection(state.direction);
        let bestDir = state.direction;
        let found = false;

        // Prefer to continue in current direction
        const delta = DIRECTION_DELTA[state.direction];
        if (isWalkable(state.tileRow + delta[0], state.tileCol + delta[1])) {
            // Occasionally change direction
            if (state.patrolSwitchTimer <= 0) {
                // Pick a random walkable direction
                for (let i = 0; i < ALL_DIRS.length; i++) {
                    const dir = ALL_DIRS[i];
                    if (dir === reverse) continue;
                    const d = DIRECTION_DELTA[dir];
                    if (isWalkable(state.tileRow + d[0], state.tileCol + d[1])) {
                        bestDir = dir;
                        found = true;
                    }
                }
                if (!found) bestDir = state.direction;
                state.patrolSwitchTimer = 2000 + Math.random() * 3000;
            }
            else {
                return state.direction;
            }
        }
        else {
            // Current direction blocked - pick another
            for (let i = 0; i < ALL_DIRS.length; i++) {
                const dir = ALL_DIRS[i];
                if (dir === reverse) continue;
                const d = DIRECTION_DELTA[dir];
                if (isWalkable(state.tileRow + d[0], state.tileCol + d[1])) {
                    bestDir = dir;
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Dead end - reverse
                const rd = DIRECTION_DELTA[reverse];
                if (isWalkable(state.tileRow + rd[0], state.tileCol + rd[1])) {
                    bestDir = reverse;
                }
            }
        }

        return bestDir;
    }

    function chooseChaseDirection(): Direction {
        const targetRow = chaseTarget.row;
        const targetCol = chaseTarget.col;
        const reverse = oppositeDirection(state.direction);
        let bestDir = state.direction;
        let bestDist = Infinity;

        for (let i = 0; i < ALL_DIRS.length; i++) {
            const dir = ALL_DIRS[i];
            if (dir === reverse) continue;
            const delta = DIRECTION_DELTA[dir];
            const nr = state.tileRow + delta[0];
            const nc = state.tileCol + delta[1];
            if (!isWalkable(nr, nc)) continue;
            const d = distanceSq(nr, nc, targetRow, targetCol);
            if (d < bestDist) {
                bestDist = d;
                bestDir = dir;
            }
        }

        if (bestDist === Infinity) {
            const reverseDelta = DIRECTION_DELTA[reverse];
            if (isWalkable(state.tileRow + reverseDelta[0], state.tileCol + reverseDelta[1])) {
                return reverse;
            }
        }

        return bestDir;
    }

    function chooseFleeDirection(): Direction {
        // Head toward surface (row 0), then head left (col 0) once on surface
        const reverse = oppositeDirection(state.direction);

        if (state.tileRow === 0) {
            // On surface - head left toward col 0
            const leftDelta = DIRECTION_DELTA['left'];
            if (isWalkable(state.tileRow + leftDelta[0], state.tileCol + leftDelta[1])) {
                return 'left';
            }
        }

        // Underground - prioritise moving up
        let bestDir = state.direction;
        let bestScore = Infinity;

        for (let i = 0; i < ALL_DIRS.length; i++) {
            const dir = ALL_DIRS[i];
            if (dir === reverse) continue;
            const delta = DIRECTION_DELTA[dir];
            const nr = state.tileRow + delta[0];
            const nc = state.tileCol + delta[1];
            if (!isWalkable(nr, nc)) continue;
            // Score: prefer lower row and lower col
            const score = nr * 100 + nc;
            if (score < bestScore) {
                bestScore = score;
                bestDir = dir;
            }
        }

        if (bestScore === Infinity) {
            const reverseDelta = DIRECTION_DELTA[reverse];
            if (isWalkable(state.tileRow + reverseDelta[0], state.tileCol + reverseDelta[1])) {
                return reverse;
            }
        }

        return bestDir;
    }

    function scheduleMove(): void {
        if (!state.alive) return;

        let dir: Direction;
        if (state.phase === 'fleeing') {
            dir = chooseFleeDirection();
        }
        else if (state.phase === 'chase') {
            dir = chooseChaseDirection();
        }
        else {
            dir = choosePatrolDirection();
        }

        const delta = DIRECTION_DELTA[dir];
        const nextTileRow = state.tileRow + delta[0];
        const nextTileCol = state.tileCol + delta[1];

        if (!isWalkable(nextTileRow, nextTileCol)) return;

        state.direction = dir;
        state.moving = true;

        // Snap perpendicular axis to prevent diagonal sliding on axis switch
        if (delta[0] !== 0) state.col = state.tileCol;
        if (delta[1] !== 0) state.row = state.tileRow;

        const dist = Math.abs(nextTileCol - state.col) + Math.abs(nextTileRow - state.row) || 0.001;
        const duration = dist / speed;

        timeline.clear().time(0);
        timeline.to(state, { col: nextTileCol, row: nextTileRow, duration, ease: 'none' });
        timeline.set(state, { tileRow: nextTileRow, tileCol: nextTileCol, moving: false }, duration);
    }

    function scheduleFleeGhostMove(): void {
        // Move one tile toward surface (row 0) through dirt
        let bestDir: Direction = 'up';
        let bestDist = Infinity;

        for (let i = 0; i < ALL_DIRS.length; i++) {
            const dir = ALL_DIRS[i];
            const delta = DIRECTION_DELTA[dir];
            const nr = state.tileRow + delta[0];
            const nc = state.tileCol + delta[1];
            if (nr < 0 || nr >= fieldRows || nc < 0 || nc >= fieldCols) continue;
            // Prefer lowest row (surface), then lowest col
            const d = nr * 1000 + nc;
            if (d < bestDist) {
                bestDist = d;
                bestDir = dir;
            }
        }

        const delta = DIRECTION_DELTA[bestDir];
        const nextTileRow = state.tileRow + delta[0];
        const nextTileCol = state.tileCol + delta[1];

        state.direction = bestDir;
        state.moving = true;

        // Snap perpendicular axis to prevent diagonal sliding
        if (delta[0] !== 0) state.col = state.tileCol;
        if (delta[1] !== 0) state.row = state.tileRow;

        const dist = Math.abs(nextTileCol - state.col) + Math.abs(nextTileRow - state.row) || 0.001;
        const duration = dist / (speed * GHOST_SPEED_FACTOR);

        timeline.clear().time(0);
        timeline.to(state, { col: nextTileCol, row: nextTileRow, duration, ease: 'none' });
        timeline.set(state, { tileRow: nextTileRow, tileCol: nextTileCol, moving: false }, duration);
    }

    function scheduleGhostMove(): void {
        // Move one tile toward chase target through dirt
        const targetRow = chaseTarget.row;
        const targetCol = chaseTarget.col;
        let bestDir: Direction = 'up';
        let bestDist = Infinity;

        for (let i = 0; i < ALL_DIRS.length; i++) {
            const dir = ALL_DIRS[i];
            const delta = DIRECTION_DELTA[dir];
            const nr = state.tileRow + delta[0];
            const nc = state.tileCol + delta[1];
            // Ghosting ignores walkability - can move through anything in bounds
            if (nr < 0 || nr >= fieldRows || nc < 0 || nc >= fieldCols) continue;
            const d = distanceSq(nr, nc, targetRow, targetCol);
            if (d < bestDist) {
                bestDist = d;
                bestDir = dir;
            }
        }

        const delta = DIRECTION_DELTA[bestDir];
        const nextTileRow = state.tileRow + delta[0];
        const nextTileCol = state.tileCol + delta[1];

        state.direction = bestDir;
        state.moving = true;

        // Snap perpendicular axis to prevent diagonal sliding
        if (delta[0] !== 0) state.col = state.tileCol;
        if (delta[1] !== 0) state.row = state.tileRow;

        const dist = Math.abs(nextTileCol - state.col) + Math.abs(nextTileRow - state.row) || 0.001;
        const duration = dist / (speed * GHOST_SPEED_FACTOR);

        timeline.clear().time(0);
        timeline.to(state, { col: nextTileCol, row: nextTileRow, duration, ease: 'none' });
        timeline.set(state, { tileRow: nextTileRow, tileCol: nextTileCol, moving: false }, duration);
    }
}
