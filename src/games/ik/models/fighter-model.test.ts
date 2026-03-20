import { describe, it, expect } from 'vitest';
import { createFighterModel, type FighterModel } from './fighter-model';
import { type MoveKind, ARENA_MIN_X, ARENA_MAX_X, JUMP_DURATION_MS, HIT_REACTION_MS, BLOCK_REACTION_MS } from '../data';

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
    // --- Initial state ---

    describe('initial state', () => {
        it('starts in idle phase at the given position', () => {
            const f = makeFighter({ startX: 3.0, startFacing: 'left' });
            expect(f.phase).toBe('idle');
            expect(f.x).toBe(3.0);
            expect(f.facing).toBe('left');
            expect(f.move).toBeUndefined();
            expect(f.progress).toBe(0);
            expect(f.hitboxActive).toBe(false);
            expect(f.height).toBe(0);
        });
    });

    // --- tryMove from idle ---

    describe('tryMove from idle', () => {
        it('stays idle on idle move', () => {
            const f = makeFighter();
            expect(f.tryMove('idle')).toBe(true);
            expect(f.phase).toBe('idle');
        });

        it('starts walking forward', () => {
            const f = makeFighter();
            expect(f.tryMove('walk-forward')).toBe(true);
            expect(f.phase).toBe('walking');
        });

        it('starts walking backward', () => {
            const f = makeFighter();
            expect(f.tryMove('walk-backward')).toBe(true);
            expect(f.phase).toBe('walking');
        });

        it('initiates jump', () => {
            const f = makeFighter();
            expect(f.tryMove('jump')).toBe(true);
            expect(f.phase).toBe('airborne');
            expect(f.move).toBe('jump');
        });

        // Table of all attack moves (non-auto-turn, ground)
        const groundMoves: MoveKind[] = [
            'high-punch',
            'high-kick',
            'foot-sweep',
            'crouch-punch',
            'mid-kick',
            'low-kick',
            'roundhouse',
        ];

        for (const moveKind of groundMoves) {
            it(`triggers ${moveKind} in attacking phase`, () => {
                const f = makeFighter();
                expect(f.tryMove(moveKind)).toBe(true);
                expect(f.phase).toBe('attacking');
                expect(f.move).toBe(moveKind);
            });
        }

        // Auto-turn moves start in 'turning'
        const autoTurnMoves: MoveKind[] = ['back-lunge-punch', 'back-crouch-punch', 'back-low-kick'];

        for (const moveKind of autoTurnMoves) {
            it(`triggers ${moveKind} in turning phase (auto-turn)`, () => {
                const f = makeFighter();
                expect(f.tryMove(moveKind)).toBe(true);
                expect(f.phase).toBe('turning');
            });
        }

        // Airborne attack moves
        const airborneMoves: MoveKind[] = ['flying-kick', 'front-somersault', 'back-somersault'];

        for (const moveKind of airborneMoves) {
            it(`triggers ${moveKind} in airborne phase`, () => {
                const f = makeFighter();
                expect(f.tryMove(moveKind)).toBe(true);
                expect(f.phase).toBe('airborne');
                expect(f.move).toBe(moveKind);
            });
        }
    });

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
        it('starts at 0 for a new attack', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            expect(f.progress).toBe(0);
        });

        it('advances toward 1 during an attack', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep'); // 4 segments at 80ms = 320ms total
            advance(f, 160);
            expect(f.progress).toBeCloseTo(0.5, 1);
        });

        it('reaches 1 after ground move completes', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep'); // 320ms total
            advance(f, 350);
            expect(f.progress).toBeCloseTo(1, 1);
            expect(f.phase).toBe('attacking'); // holds at completion
        });

        it('holds at completion, then idle resets progress', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            advance(f, 350);
            expect(f.tryMove('idle')).toBe(true);
            expect(f.phase).toBe('idle');
            expect(f.progress).toBe(0);
        });

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
        it('activates hitbox only during hit-frame segments for foot-sweep', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep'); // hit frames at segment indices 2, 3
            expect(f.hitboxActive).toBe(false); // segment 0

            advance(f, 81); // segment 1
            expect(f.hitboxActive).toBe(false);

            advance(f, 80); // segment 2 - hit
            expect(f.hitboxActive).toBe(true);

            advance(f, 80); // segment 3 - hit
            expect(f.hitboxActive).toBe(true);
        });

        it('hitboxActive is false when idle', () => {
            const f = makeFighter();
            expect(f.hitboxActive).toBe(false);
        });

        it('hitbox rectangle is zeroed when not active', () => {
            const f = makeFighter();
            const hb = f.hitbox;
            expect(hb.w).toBe(0);
            expect(hb.h).toBe(0);
        });

        it('hitbox rectangle has real values when active', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.tryMove('foot-sweep');
            advance(f, 81); // segment 1
            advance(f, 80); // segment 2 - hit
            expect(f.hitboxActive).toBe(true);
            const hb = f.hitbox;
            expect(hb.w).toBeGreaterThan(0);
            expect(hb.h).toBeGreaterThan(0);
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

        it('back-crouch-punch auto-turns', () => {
            const f = makeFighter({ startFacing: 'right' });
            f.tryMove('back-crouch-punch');
            expect(f.phase).toBe('turning');
            expect(f.facing).toBe('right');

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

        it('returns to idle after auto-turn move completes', () => {
            const f = makeFighter({ startFacing: 'right' });
            f.tryMove('back-lunge-punch');
            // Turn: 3 * 80ms = 240ms, then 2 segments * 80ms = 160ms => ~400ms total
            advance(f, 500);
            // Auto-turn ground moves hold at completion
            f.tryMove('idle');
            expect(f.phase).toBe('idle');
            expect(f.facing).toBe('left'); // flipped
        });
    });

    // --- Jump ---

    describe('jump', () => {
        it('enters airborne phase with jump move', () => {
            const f = makeFighter();
            f.tryMove('jump');
            expect(f.phase).toBe('airborne');
            expect(f.move).toBe('jump');
        });

        it('height rises and falls', () => {
            const f = makeFighter();
            f.tryMove('jump');

            expect(f.height).toBe(0);

            // Halfway, should be near peak
            advance(f, JUMP_DURATION_MS / 2);
            expect(f.height).toBeGreaterThan(0);

            // At end, back to 0
            advance(f, JUMP_DURATION_MS / 2 + 10);
            expect(f.height).toBe(0);
            expect(f.phase).toBe('idle');
        });
    });

    // --- Walking ---

    describe('walking', () => {
        it('moves position forward while walking', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.tryMove('walk-forward');
            const startX = f.x;
            advance(f, 500);
            expect(f.x).toBeGreaterThan(startX);
        });

        it('moves position backward while walking', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.tryMove('walk-backward');
            const startX = f.x;
            advance(f, 500);
            expect(f.x).toBeLessThan(startX);
        });

        it('stops walking on idle', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.tryMove('walk-forward');
            advance(f, 200);
            const midX = f.x;
            f.tryMove('idle');
            expect(f.phase).toBe('idle');
            advance(f, 200);
            expect(f.x).toBe(midX);
        });

        it('walk progress cycles based on distance', () => {
            const f = makeFighter({ startX: 2.0, startFacing: 'right' });
            f.tryMove('walk-forward');
            expect(f.progress).toBe(0);

            // WALK_SPEED = 2.0 m/s, WALK_CYCLE_METRES = 2.0 m => full cycle in 1s
            // After 130ms: distance = 0.26m, progress ~= 0.26/2.0 = 0.13
            advance(f, 130);
            expect(f.progress).toBeGreaterThan(0);
            expect(f.progress).toBeLessThan(1);
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
        it('right-facing is facing target to the right', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            expect(f.isFacing(6.0)).toBe(true);
            expect(f.isFacing(4.0)).toBe(false);
        });

        it('left-facing is facing target to the left', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'left' });
            expect(f.isFacing(4.0)).toBe(true);
            expect(f.isFacing(6.0)).toBe(false);
        });

        it('facing same position returns true', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            expect(f.isFacing(5.0)).toBe(true);
        });
    });

    // --- Body box ---

    describe('bodyBox', () => {
        it('is centred on fighter position', () => {
            const f = makeFighter({ startX: 5.0 });
            const bb = f.bodyBox;
            expect(bb.x).toBeCloseTo(5.0 - 0.8 / 2);
            expect(bb.y).toBe(0);
            expect(bb.w).toBe(0.8);
            expect(bb.h).toBe(1.5);
        });
    });

    // --- External commands ---

    describe('hit', () => {
        it('enters hit-reacting phase', () => {
            const f = makeFighter();
            f.hit(0.5);
            expect(f.phase).toBe('hit-reacting');
        });

        it('returns to idle after hit reaction duration', () => {
            const f = makeFighter();
            f.hit(0.5);
            advance(f, HIT_REACTION_MS + 10);
            expect(f.phase).toBe('idle');
        });

        it('applies knockback to position', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            const startX = f.x;
            f.hit(0.5);
            advance(f, HIT_REACTION_MS + 10);
            expect(f.x).toBeLessThan(startX);
        });
    });

    describe('block', () => {
        it('enters blocking phase', () => {
            const f = makeFighter();
            f.block();
            expect(f.phase).toBe('blocking');
        });

        it('returns to idle after block duration', () => {
            const f = makeFighter();
            f.block();
            advance(f, BLOCK_REACTION_MS + 10);
            expect(f.phase).toBe('idle');
        });

        it('progress advances through block', () => {
            const f = makeFighter();
            f.block();
            expect(f.progress).toBe(0);
            advance(f, BLOCK_REACTION_MS * 0.5);
            expect(f.progress).toBeCloseTo(0.5, 1);
        });
    });

    describe('defeat', () => {
        it('enters defeated phase with correct variant', () => {
            const f = makeFighter();
            f.defeat('c');
            expect(f.phase).toBe('defeated');
            expect(f.defeatVariant).toBe('c');
        });

        it('stays in defeated phase (does not auto-return)', () => {
            const f = makeFighter();
            f.defeat('a');
            advance(f, 2000);
            expect(f.phase).toBe('defeated');
        });

        it('progress advances through defeat', () => {
            const f = makeFighter();
            f.defeat('b');
            expect(f.progress).toBe(0);
            // DEFEAT_TOTAL_MS = 3 * 120 = 360ms
            advance(f, 180);
            expect(f.progress).toBeCloseTo(0.5, 1);
        });
    });

    describe('won', () => {
        it('enters won phase', () => {
            const f = makeFighter();
            f.won();
            expect(f.phase).toBe('won');
        });

        it('stays in won phase', () => {
            const f = makeFighter();
            f.won();
            advance(f, 5000);
            expect(f.phase).toBe('won');
        });
    });

    describe('lost', () => {
        it('enters lost phase', () => {
            const f = makeFighter();
            f.lost();
            expect(f.phase).toBe('lost');
        });

        it('stays in lost phase', () => {
            const f = makeFighter();
            f.lost();
            advance(f, 5000);
            expect(f.phase).toBe('lost');
        });
    });

    // --- Reset ---

    describe('reset', () => {
        it('returns to idle at new position and facing', () => {
            const f = makeFighter({ startX: 3.0, startFacing: 'right' });
            f.tryMove('foot-sweep');
            advance(f, 50);

            f.reset(7.5, 'left');
            expect(f.phase).toBe('idle');
            expect(f.x).toBe(7.5);
            expect(f.facing).toBe('left');
            expect(f.move).toBeUndefined();
            expect(f.progress).toBe(0);
            expect(f.hitboxActive).toBe(false);
            expect(f.height).toBe(0);
        });

        it('clears active timeline so advance does nothing', () => {
            const f = makeFighter();
            f.tryMove('foot-sweep');
            advance(f, 50);
            f.reset(5.0, 'right');
            advance(f, 500);
            expect(f.phase).toBe('idle');
        });
    });

    // --- Airborne attacks ---

    describe('airborne attacks', () => {
        it('flying-kick is a low airborne forward kick', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.tryMove('flying-kick');
            expect(f.phase).toBe('airborne');
            expect(f.move).toBe('flying-kick');

            const startX = f.x;
            advance(f, 200);
            expect(f.height).toBeGreaterThan(0);
            expect(f.x).toBeGreaterThan(startX);

            // Returns to idle after completion
            advance(f, 300);
            expect(f.height).toBe(0);
            expect(f.phase).toBe('idle');
        });

        it('front-somersault is airborne', () => {
            const f = makeFighter();
            f.tryMove('front-somersault');
            expect(f.phase).toBe('airborne');
            expect(f.move).toBe('front-somersault');
        });

        it('back-somersault is airborne', () => {
            const f = makeFighter();
            f.tryMove('back-somersault');
            expect(f.phase).toBe('airborne');
            expect(f.move).toBe('back-somersault');
        });

        it('airborne moves return to ground after completion', () => {
            const f = makeFighter();
            f.tryMove('front-somersault'); // 6 segments * 80ms = 480ms
            advance(f, 600);
            expect(f.height).toBe(0);
            expect(f.phase).toBe('idle');
        });
    });

    // --- Edge cases ---

    describe('edge cases', () => {
        it('idle from idle is accepted', () => {
            const f = makeFighter();
            expect(f.tryMove('idle')).toBe(true);
            expect(f.phase).toBe('idle');
        });

        it('can transition from walking to attack', () => {
            const f = makeFighter();
            f.tryMove('walk-forward');
            expect(f.phase).toBe('walking');
            f.tryMove('foot-sweep');
            expect(f.phase).toBe('attacking');
            expect(f.move).toBe('foot-sweep');
        });

        it('can transition from walking to idle', () => {
            const f = makeFighter();
            f.tryMove('walk-forward');
            expect(f.phase).toBe('walking');
            f.tryMove('idle');
            expect(f.phase).toBe('idle');
        });
    });
});
