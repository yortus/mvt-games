import { describe, it, expect } from 'vitest';
import { createFighterModel, type FighterModel } from './fighter-model';
import { ARENA_MIN_X, ARENA_MAX_X, FIGHTER_BODY_WIDTH } from '../data';
import { JUMP_DURATION_MS } from './model-constants';

// ---------------------------------------------------------------------------
// Helper: advance a fighter by a given number of ms
// ---------------------------------------------------------------------------

function advance(fighter: FighterModel, ms: number): void {
    fighter.update(ms);
}

// ---------------------------------------------------------------------------
// Helper: create a fighter with sensible defaults
// ---------------------------------------------------------------------------

function makeFighter(
    overrides?: Partial<{
        startX: number;
        startFacing: 'left' | 'right';
        arenaMinX: number;
        arenaMaxX: number;
    }>,
): FighterModel {
    return createFighterModel({
        startX: overrides?.startX ?? 5.0,
        startFacing: overrides?.startFacing ?? 'right',
        arenaMinX: overrides?.arenaMinX ?? ARENA_MIN_X,
        arenaMaxX: overrides?.arenaMaxX ?? ARENA_MAX_X,
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FighterModel', () => {
    // --- tryMove rejected during active move ---

    describe('tryMove rejected during active move', () => {
        it('rejects move while attacking', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            expect(f.phase).toBe('attacking');
            expect(f.tryMove('walk-forward')).toBe(false);
            expect(f.phase).toBe('attacking');
        });

        it('rejects move while airborne', () => {
            const f = makeFighter();
            f.tryMove('jump');
            expect(f.phase).toBe('airborne');
            expect(f.tryMove('walk-forward')).toBe(false);
            expect(f.phase).toBe('airborne');
        });

        it('rejects move while blocking', () => {
            const f = makeFighter();
            f.block();
            expect(f.phase).toBe('blocking');
            expect(f.tryMove('walk-forward')).toBe(false);
            expect(f.phase).toBe('blocking');
        });

        it('rejects move while hit-reacting', () => {
            const f = makeFighter();
            f.hit(0.5);
            expect(f.phase).toBe('hit-reacting');
            expect(f.tryMove('walk-forward')).toBe(false);
            expect(f.phase).toBe('hit-reacting');
        });
    });

    // --- Progress advances during moves ---

    describe('progress', () => {
        it('same move is rejected while holding at completion', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            advance(f, 350);
            expect(f.tryMove('foot-sweep')).toBe(false);
        });

        it('different move is accepted from completion', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            advance(f, 350);
            expect(f.tryMove('high-punch')).toBe(true);
            expect(f.move).toBe('high-punch');
        });
    });

    // --- Hitbox activation ---

    describe('hitbox activation', () => {
        it('activates hitbox during the active window for foot-sweep', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep'); // hitbox active 160-320ms
            expect(f.isHitboxActive).toBe(false); // t=0: before window

            advance(f, 81); // t=81ms: before window
            expect(f.isHitboxActive).toBe(false);

            advance(f, 80); // t=161ms: inside window
            expect(f.isHitboxActive).toBe(true);

            advance(f, 80); // t=241ms: inside window
            expect(f.isHitboxActive).toBe(true);
        });

        it('hitbox rectangle is zeroed when not active', () => {
            const f = makeFighter();
            const hb = f.hitbox;
            expect(hb.w).toBe(0);
            expect(hb.h).toBe(0);
        });
    });

    // --- Auto-turn moves ---

    describe('auto-turn moves', () => {
        it('back-lunge-punch starts in turning phase then flips facing', () => {
            const f = makeFighter({ startFacing: 'right' });
            f.tryMove('back-lunge-punch');
            expect(f.phase).toBe('turning');
            expect(f.facing).toBe('right'); // not flipped yet

            // Advance past 3 turn frames at 80ms each = 240ms
            advance(f, 241);
            expect(f.facing).toBe('left');
        });

        it('back-low-kick auto-turns', () => {
            const f = makeFighter({ startFacing: 'left' });
            f.tryMove('back-low-kick');
            expect(f.phase).toBe('turning');
            expect(f.facing).toBe('left');

            advance(f, 241);
            expect(f.facing).toBe('right');
        });
    });

    // --- Position clamping ---

    describe('position clamping', () => {
        it('clamps position at arena left boundary', () => {
            const f = makeFighter({ startX: ARENA_MIN_X + 0.1, startFacing: 'left' });
            f.tryMove('walk-forward'); // left-facing, forward = move left
            advance(f, 2000);
            expect(f.x).toBe(ARENA_MIN_X);
        });

        it('clamps position at arena right boundary', () => {
            const f = makeFighter({ startX: ARENA_MAX_X - 0.1, startFacing: 'right' });
            f.tryMove('walk-forward');
            advance(f, 2000);
            expect(f.x).toBe(ARENA_MAX_X);
        });
    });

    // --- isFacing ---

    describe('isFacing', () => {
        it('facing same position returns true', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            expect(f.isFacing(5.0)).toBe(true);
        });
    });

    // --- Body box ---

    describe('bodyBox', () => {
        it('is centred on the fighter, and rises with it, the same size, as it jumps', () => {
            const f = makeFighter({ startX: 5.0 });
            const groundHeight = f.bodyBox.h;
            expect(f.bodyBox.x).toBeCloseTo(5.0 - FIGHTER_BODY_WIDTH / 2);
            expect(f.bodyBox.y).toBe(0);
            expect(f.bodyBox.w).toBe(FIGHTER_BODY_WIDTH);
            expect(groundHeight).toBeGreaterThan(0);

            // The body box is the same object each time, so read its fields
            // after each update rather than keeping it.
            f.tryMove('jump');
            advance(f, JUMP_DURATION_MS / 2);
            expect(f.height).toBeGreaterThan(0);
            expect(f.bodyBox.y).toBe(f.height);
            expect(f.bodyBox.w).toBe(FIGHTER_BODY_WIDTH);
            expect(f.bodyBox.h).toBe(groundHeight);
        });
    });

    // --- External commands ---

    describe('defeat', () => {
        it('stays in defeated phase (does not auto-return)', () => {
            const f = makeFighter();
            f.defeat('a');
            advance(f, 2000);
            expect(f.phase).toBe('defeated');
        });
    });

    // --- Reset ---

    describe('reset', () => {
        it('clears active timeline so advance does nothing', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            advance(f, 50);
            f.reset(5.0, 'right');
            advance(f, 500);
            expect(f.phase).toBe('idle');
        });
    });
});
