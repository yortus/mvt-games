import { describe, it, expect } from 'vitest';
import { createFighterModel, type FighterModel } from './fighter-model';
import {
    type InputDirection,
    type MoveKind,
    MOVE_DATA,
    CROUCH_PUNCH_FRAME_SEQUENCE,
    ARENA_MIN_X,
    ARENA_MAX_X,
    JUMP_DURATION_MS,
    HIT_REACTION_MS,
    BLOCK_REACTION_MS,
} from '../data';

// ---------------------------------------------------------------------------
// Helper: advance a fighter by a given number of ms
// ---------------------------------------------------------------------------

function advance(fighter: FighterModel, ms: number): void {
    fighter.update(ms);
}

// ---------------------------------------------------------------------------
// Helper: create a fighter with sensible defaults
// ---------------------------------------------------------------------------

function makeFighter(overrides?: Partial<{
    startX: number;
    startFacing: 'left' | 'right';
    arenaMinX: number;
    arenaMaxX: number;
}>): FighterModel {
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
            expect(f.moveKind).toBeUndefined();
            expect(f.frameIndex).toBe(0);
            expect(f.hitboxActive).toBe(false);
            expect(f.jumpHeight).toBe(0);
        });
    });

    // --- Input handling ---

    describe('applyInput from idle', () => {

        it('stays idle on no input', () => {
            const f = makeFighter();
            f.applyInput('none', false);
            expect(f.phase).toBe('idle');
        });

        it('starts walking forward', () => {
            const f = makeFighter();
            f.applyInput('forward', false);
            expect(f.phase).toBe('walking');
        });

        it('starts walking backward', () => {
            const f = makeFighter();
            f.applyInput('backward', false);
            expect(f.phase).toBe('walking');
        });

        it('initiates jump on up input', () => {
            const f = makeFighter();
            f.applyInput('up', false);
            expect(f.phase).toBe('airborne');
            expect(f.moveKind).toBe('jump');
        });

        // Table of all directional moves without attack
        const noAttackMoves: [InputDirection, MoveKind][] = [
            ['up-forward', 'high-punch'],
            ['down-forward', 'high-kick'],
            ['down', 'foot-sweep'],
            ['down-backward', 'crouch-punch'],
            ['up-backward', 'back-lunge-punch'],
        ];

        for (const [dir, expectedKind] of noAttackMoves) {
            it(`triggers ${expectedKind} on ${dir} without attack`, () => {
                const f = makeFighter();
                f.applyInput(dir, false);
                // auto-turn moves start in 'turning', others in 'attacking'/'airborne'
                const md = MOVE_DATA[expectedKind];
                if (md.autoTurn) {
                    expect(f.phase).toBe('turning');
                } else if (md.airborne) {
                    expect(f.phase).toBe('airborne');
                } else {
                    expect(f.phase).toBe('attacking');
                }
            });
        }

        // Table of all directional moves with attack
        const withAttackMoves: [InputDirection, MoveKind][] = [
            ['up', 'flying-kick'],
            ['up-forward', 'front-somersault'],
            ['forward', 'mid-kick'],
            ['down-forward', 'low-kick'],
            ['down', 'back-crouch-punch'],
            ['down-backward', 'back-low-kick'],
            ['backward', 'roundhouse'],
            ['up-backward', 'back-somersault'],
        ];

        for (const [dir, expectedKind] of withAttackMoves) {
            it(`triggers ${expectedKind} on ${dir} with attack`, () => {
                const f = makeFighter();
                f.applyInput(dir, true);
                const md = MOVE_DATA[expectedKind];
                if (md.autoTurn) {
                    expect(f.phase).toBe('turning');
                } else if (md.airborne) {
                    expect(f.phase).toBe('airborne');
                } else {
                    expect(f.phase).toBe('attacking');
                }
            });
        }
    });

    // --- Input ignored during active move ---

    describe('input ignored during active move', () => {
        it('ignores input while attacking', () => {
            const f = makeFighter();
            f.applyInput('down', false); // foot-sweep
            expect(f.phase).toBe('attacking');
            f.applyInput('forward', false); // try to walk
            expect(f.phase).toBe('attacking'); // still attacking
        });

        it('ignores input while airborne', () => {
            const f = makeFighter();
            f.applyInput('up', false); // jump
            expect(f.phase).toBe('airborne');
            f.applyInput('forward', false);
            expect(f.phase).toBe('airborne');
        });

        it('ignores input while blocking', () => {
            const f = makeFighter();
            f.applyBlock();
            expect(f.phase).toBe('blocking');
            f.applyInput('forward', false);
            expect(f.phase).toBe('blocking');
        });

        it('ignores input while hit-reacting', () => {
            const f = makeFighter();
            f.applyHit(0.5);
            expect(f.phase).toBe('hit-reacting');
            f.applyInput('forward', false);
            expect(f.phase).toBe('hit-reacting');
        });
    });

    // --- Frame progression for attacks ---

    describe('frame progression', () => {
        it('progresses through foot-sweep frames', () => {
            const f = makeFighter();
            f.applyInput('down', false); // foot-sweep: 4 frames at 80ms each
            expect(f.moveKind).toBe('foot-sweep');
            expect(f.frameIndex).toBe(0);

            // Advance through each frame
            const frames: number[] = [f.frameIndex];
            for (let i = 0; i < 3; i++) {
                advance(f, 81);
                frames.push(f.frameIndex);
            }
            // Sequential: 0, 1, 2, 3
            expect(frames).toEqual([0, 1, 2, 3]);
        });

        it('holds at final frame after ground move completes', () => {
            const f = makeFighter();
            f.applyInput('down', false); // foot-sweep: 4 frames at 80ms each = 320ms
            expect(f.phase).toBe('attacking');

            advance(f, 350); // past end
            // Ground moves hold at final frame (moveComplete) rather than returning to idle
            expect(f.phase).toBe('attacking');
            expect(f.moveKind).toBe('foot-sweep');

            // Releasing input (idle) should return to idle
            f.applyInput('none', false);
            expect(f.phase).toBe('idle');
            expect(f.moveKind).toBeUndefined();
        });

        it('progresses through roundhouse frames', () => {
            const f = makeFighter();
            f.applyInput('backward', true); // roundhouse: 4 frames at 80ms
            expect(f.moveKind).toBe('roundhouse');
            expect(f.frameIndex).toBe(0);

            advance(f, 81);
            expect(f.frameIndex).toBe(1);
            advance(f, 80);
            expect(f.frameIndex).toBe(2);
            advance(f, 80);
            expect(f.frameIndex).toBe(3);
        });

        it('progresses through crouch-punch special sequence', () => {
            const f = makeFighter();
            f.applyInput('down-backward', false); // crouch-punch
            expect(f.moveKind).toBe('crouch-punch');
            // Expected sequence: [0, 1, 0, 0]
            expect(f.frameIndex).toBe(CROUCH_PUNCH_FRAME_SEQUENCE[0]);

            advance(f, 81);
            expect(f.frameIndex).toBe(CROUCH_PUNCH_FRAME_SEQUENCE[1]);
            advance(f, 80);
            expect(f.frameIndex).toBe(CROUCH_PUNCH_FRAME_SEQUENCE[2]);
            advance(f, 80);
            expect(f.frameIndex).toBe(CROUCH_PUNCH_FRAME_SEQUENCE[3]);
        });
    });

    // --- Hitbox activation ---

    describe('hitbox activation', () => {
        it('activates hitbox only on hit frames for foot-sweep', () => {
            const f = makeFighter();
            f.applyInput('down', false); // foot-sweep: hit frames at indices 2, 3
            expect(f.hitboxActive).toBe(false); // frame 0

            advance(f, 81); // frame 1
            expect(f.hitboxActive).toBe(false);

            advance(f, 80); // frame 2 - hit frame
            expect(f.hitboxActive).toBe(true);

            advance(f, 80); // frame 3 - hit frame
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
            f.applyInput('down', false); // foot-sweep
            // Advance to a hit frame (index 2)
            advance(f, 81); // frame 1
            advance(f, 80); // frame 2 - hit
            expect(f.hitboxActive).toBe(true);
            const hb = f.hitbox;
            expect(hb.w).toBeGreaterThan(0);
            expect(hb.h).toBeGreaterThan(0);
        });
    });

    // --- Explicit frame sequences ---

    describe('explicit frame sequences', () => {
        it('high-punch uses punch frames [0, 2]', () => {
            const f = makeFighter();
            f.applyInput('up-forward', false); // high-punch
            expect(f.moveKind).toBe('high-punch');
            expect(f.frameIndex).toBe(0);

            advance(f, 81);
            expect(f.frameIndex).toBe(2);
        });

        it('high-kick uses kick frames [0, 5, 6]', () => {
            const f = makeFighter();
            f.applyInput('down-forward', false); // high-kick
            expect(f.moveKind).toBe('high-kick');
            expect(f.frameIndex).toBe(0);

            advance(f, 81);
            expect(f.frameIndex).toBe(5);
            advance(f, 80);
            expect(f.frameIndex).toBe(6);
        });

        it('mid-kick uses kick frames [0, 1, 2]', () => {
            const f = makeFighter();
            f.applyInput('forward', true); // mid-kick
            expect(f.moveKind).toBe('mid-kick');
            expect(f.frameIndex).toBe(0);

            advance(f, 81);
            expect(f.frameIndex).toBe(1);
            advance(f, 80);
            expect(f.frameIndex).toBe(2);
        });

        it('low-kick uses kick frames [0, 3, 4]', () => {
            const f = makeFighter();
            f.applyInput('down-forward', true); // low-kick
            expect(f.moveKind).toBe('low-kick');
            expect(f.frameIndex).toBe(0);

            advance(f, 81);
            expect(f.frameIndex).toBe(3);
            advance(f, 80);
            expect(f.frameIndex).toBe(4);
        });
    });

    // --- Auto-turn moves ---

    describe('auto-turn moves', () => {
        it('back-lunge-punch starts in turning phase then flips facing', () => {
            const f = makeFighter({ startFacing: 'right' });
            f.applyInput('up-backward', false); // back-lunge-punch (auto-turn)
            expect(f.phase).toBe('turning');
            expect(f.facing).toBe('right'); // not flipped yet

            // Advance through 3 turn frames at 80ms each = 240ms
            advance(f, 241);
            // After turn frames, facing should flip
            expect(f.facing).toBe('left');
        });

        it('back-crouch-punch (attack+down) auto-turns', () => {
            const f = makeFighter({ startFacing: 'right' });
            f.applyInput('down', true); // back-crouch-punch (auto-turn)
            expect(f.phase).toBe('turning');
            expect(f.facing).toBe('right');

            advance(f, 241);
            expect(f.facing).toBe('left');
        });

        it('back-low-kick auto-turns', () => {
            const f = makeFighter({ startFacing: 'left' });
            f.applyInput('down-backward', true); // back-low-kick (auto-turn)
            expect(f.phase).toBe('turning');
            expect(f.facing).toBe('left');

            advance(f, 241);
            expect(f.facing).toBe('right');
        });

        it('returns to idle after auto-turn move completes', () => {
            const f = makeFighter({ startFacing: 'right' });
            f.applyInput('up-backward', false); // back-lunge-punch
            // Turn: 3 * 80ms = 240ms, then 2 punch frames * 80ms = 160ms => ~400ms total
            advance(f, 500);
            // Auto-turn ground moves hold at final frame
            f.applyInput('none', false); // release to return to idle
            expect(f.phase).toBe('idle');
            expect(f.facing).toBe('left'); // flipped
        });
    });

    // --- Jump ---

    describe('jump', () => {
        it('enters airborne phase with jump moveKind', () => {
            const f = makeFighter();
            f.applyInput('up', false);
            expect(f.phase).toBe('airborne');
            expect(f.moveKind).toBe('jump');
        });

        it('jump height rises and falls', () => {
            const f = makeFighter();
            f.applyInput('up', false);

            // At start, jumpHeight is 0
            expect(f.jumpHeight).toBe(0);

            // Halfway, should be near peak
            advance(f, JUMP_DURATION_MS / 2);
            expect(f.jumpHeight).toBeGreaterThan(0);

            // At end, back to 0
            advance(f, JUMP_DURATION_MS / 2 + 10);
            expect(f.jumpHeight).toBe(0);
            expect(f.phase).toBe('idle');
        });
    });

    // --- Walking ---

    describe('walking', () => {
        it('moves position forward while walking', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.applyInput('forward', false);
            const startX = f.x;
            advance(f, 500);
            expect(f.x).toBeGreaterThan(startX);
        });

        it('moves position backward while walking', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.applyInput('backward', false);
            const startX = f.x;
            advance(f, 500);
            expect(f.x).toBeLessThan(startX);
        });

        it('stops walking when input becomes idle', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.applyInput('forward', false);
            advance(f, 200);
            const midX = f.x;
            f.applyInput('none', false);
            expect(f.phase).toBe('idle');
            advance(f, 200);
            // Position should not change while idle
            expect(f.x).toBe(midX);
        });

        it('cycles walk frame index based on distance', () => {
            const f = makeFighter({ startX: 2.0, startFacing: 'right' });
            f.applyInput('forward', false);
            expect(f.frameIndex).toBe(0);

            // Walk enough to cycle at least one frame
            // WALK_SPEED = 2.0 wu/s, frame cycle every 0.25 wu => 0.125s = 125ms
            advance(f, 130);
            expect(f.frameIndex).toBeGreaterThan(0);
        });
    });

    // --- Position clamping ---

    describe('position clamping', () => {
        it('clamps position at arena left boundary', () => {
            const f = makeFighter({ startX: ARENA_MIN_X + 0.1, startFacing: 'left' });
            f.applyInput('forward', false); // left-facing, forward = move left
            advance(f, 2000); // walk a long time
            expect(f.x).toBe(ARENA_MIN_X);
        });

        it('clamps position at arena right boundary', () => {
            const f = makeFighter({ startX: ARENA_MAX_X - 0.1, startFacing: 'right' });
            f.applyInput('forward', false);
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

    describe('applyHit', () => {
        it('enters hit-reacting phase', () => {
            const f = makeFighter();
            f.applyHit(0.5);
            expect(f.phase).toBe('hit-reacting');
        });

        it('returns to idle after hit reaction duration', () => {
            const f = makeFighter();
            f.applyHit(0.5);
            advance(f, HIT_REACTION_MS + 10);
            expect(f.phase).toBe('idle');
        });

        it('applies knockback to position', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            const startX = f.x;
            f.applyHit(0.5);
            advance(f, HIT_REACTION_MS + 10);
            // Knockback pushes away from attacker (opposite of facing)
            expect(f.x).toBeLessThan(startX);
        });
    });

    describe('applyBlock', () => {
        it('enters blocking phase', () => {
            const f = makeFighter();
            f.applyBlock();
            expect(f.phase).toBe('blocking');
        });

        it('returns to idle after block duration', () => {
            const f = makeFighter();
            f.applyBlock();
            advance(f, BLOCK_REACTION_MS + 10);
            expect(f.phase).toBe('idle');
        });

        it('progresses through 3 block frames', () => {
            const f = makeFighter();
            f.applyBlock();
            expect(f.frameIndex).toBe(0);
            advance(f, BLOCK_REACTION_MS * 0.34 + 1);
            expect(f.frameIndex).toBe(1);
            advance(f, BLOCK_REACTION_MS * 0.34);
            expect(f.frameIndex).toBe(2);
        });
    });

    describe('applyDefeat', () => {
        it('enters defeated phase with correct variant', () => {
            const f = makeFighter();
            f.applyDefeat('c');
            expect(f.phase).toBe('defeated');
            expect(f.defeatVariant).toBe('c');
        });

        it('stays in defeated phase (does not auto-return)', () => {
            const f = makeFighter();
            f.applyDefeat('a');
            advance(f, 2000);
            expect(f.phase).toBe('defeated');
        });

        it('progresses through 3 defeat frames', () => {
            const f = makeFighter();
            f.applyDefeat('b');
            expect(f.frameIndex).toBe(0);
            advance(f, 121);
            expect(f.frameIndex).toBe(1);
            advance(f, 120);
            expect(f.frameIndex).toBe(2);
        });
    });

    describe('applyWon', () => {
        it('enters won phase', () => {
            const f = makeFighter();
            f.applyWon();
            expect(f.phase).toBe('won');
        });

        it('stays in won phase', () => {
            const f = makeFighter();
            f.applyWon();
            advance(f, 5000);
            expect(f.phase).toBe('won');
        });
    });

    describe('applyLost', () => {
        it('enters lost phase', () => {
            const f = makeFighter();
            f.applyLost();
            expect(f.phase).toBe('lost');
        });

        it('stays in lost phase', () => {
            const f = makeFighter();
            f.applyLost();
            advance(f, 5000);
            expect(f.phase).toBe('lost');
        });
    });

    // --- Reset ---

    describe('reset', () => {
        it('returns to idle at new position and facing', () => {
            const f = makeFighter({ startX: 3.0, startFacing: 'right' });
            f.applyInput('down', false); // start attack
            advance(f, 50);

            f.reset(7.5, 'left');
            expect(f.phase).toBe('idle');
            expect(f.x).toBe(7.5);
            expect(f.facing).toBe('left');
            expect(f.moveKind).toBeUndefined();
            expect(f.frameIndex).toBe(0);
            expect(f.hitboxActive).toBe(false);
            expect(f.jumpHeight).toBe(0);
        });

        it('clears active timeline so advance does nothing', () => {
            const f = makeFighter();
            f.applyInput('down', false);
            advance(f, 50);
            f.reset(5.0, 'right');
            advance(f, 500);
            // Should still be idle, timeline cleared
            expect(f.phase).toBe('idle');
        });
    });

    // --- Airborne moves ---

    describe('airborne attacks', () => {
        it('flying-kick is a low airborne forward kick', () => {
            const f = makeFighter({ startX: 5.0, startFacing: 'right' });
            f.applyInput('up', true); // flying-kick
            expect(f.phase).toBe('airborne');
            expect(f.moveKind).toBe('flying-kick');

            // Should gain some height (less than full jump) and lunge forward
            const startX = f.x;
            advance(f, 200);
            expect(f.jumpHeight).toBeGreaterThan(0);
            expect(f.x).toBeGreaterThan(startX);

            // Returns to idle after completion (doesn't hold)
            advance(f, 300);
            expect(f.jumpHeight).toBe(0);
            expect(f.phase).toBe('idle');
        });

        it('front-somersault is airborne', () => {
            const f = makeFighter();
            f.applyInput('up-forward', true); // front-somersault
            expect(f.phase).toBe('airborne');
            expect(f.moveKind).toBe('front-somersault');
        });

        it('back-somersault is airborne', () => {
            const f = makeFighter();
            f.applyInput('up-backward', true); // back-somersault
            expect(f.phase).toBe('airborne');
            expect(f.moveKind).toBe('back-somersault');
        });

        it('airborne moves return to ground after completion', () => {
            const f = makeFighter();
            f.applyInput('up-forward', true); // front-somersault: 6 frames * 80ms = 480ms
            advance(f, 600);
            expect(f.jumpHeight).toBe(0);
            expect(f.phase).toBe('idle');
        });
    });

    // --- Edge cases ---

    describe('edge cases', () => {
        it('attack button with no direction is idle', () => {
            const f = makeFighter();
            f.applyInput('none', true);
            expect(f.phase).toBe('idle');
        });

        it('can transition from walking to attack', () => {
            const f = makeFighter();
            f.applyInput('forward', false);
            expect(f.phase).toBe('walking');
            f.applyInput('down', false); // foot-sweep
            expect(f.phase).toBe('attacking');
            expect(f.moveKind).toBe('foot-sweep');
        });

        it('can transition from walking to idle', () => {
            const f = makeFighter();
            f.applyInput('forward', false);
            expect(f.phase).toBe('walking');
            f.applyInput('none', false);
            expect(f.phase).toBe('idle');
        });
    });
});
