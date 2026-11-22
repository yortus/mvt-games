import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS, MISSILE_SPEED, RUNOFF_WIDTH, SHIELD_MS, TRACK_WIDTH, WRECK_MS } from '../data';
import { PLAYER_SHOOTER } from './battle-model';
import { createGameModel } from './game-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('the track', () => {
    it('keeps its walls apart wherever it passes near itself', () => {
        // If two stretches came closer than this, their walls would cross, and
        // the car could be counted on the wrong stretch
        const { samples, length } = createGameModel().track;
        const clearance = TRACK_WIDTH + RUNOFF_WIDTH * 2;
        let closest = Infinity;
        for (let i = 0; i < samples.length; i++) {
            for (let j = i + 1; j < samples.length; j++) {
                const along = Math.min(samples[j].distance - samples[i].distance, length - (samples[j].distance - samples[i].distance));
                // Stretches close along the track are the same bend, not a pass
                if (along < clearance * 3) continue;
                closest = Math.min(closest, Math.hypot(samples[i].x - samples[j].x, samples[i].z - samples[j].z));
            }
        }
        expect(closest).toBeGreaterThan(clearance);
    });

    it('keeps each wall running forward, never folding back on itself round a tight bend', () => {
        const { track } = createGameModel();
        const { samples } = track;
        const folds: string[] = [];
        for (const side of [1, -1] as const) {
            for (let i = 0; i < samples.length; i++) {
                const a = samples[i];
                const next = (i + 1) % samples.length;
                const b = samples[next];
                const aOffset = side * track.findWallOffset(i, side);
                const bOffset = side * track.findWallOffset(next, side);
                // The step from one wall point to the next, along the way the track runs. The track's left is (dz, -dx)
                const stepX = (b.x + b.directionZ * bOffset) - (a.x + a.directionZ * aOffset);
                const stepZ = (b.z - b.directionX * bOffset) - (a.z - a.directionX * aOffset);
                if (stepX * a.directionX + stepZ * a.directionZ <= 0) folds.push(`${side > 0 ? 'left' : 'right'} ${i}`);
            }
        }
        expect(folds).toEqual([]);
    });
});

describe('a race', () => {
    it('wrecks a car that leaves the track at speed, and brings it back on the asphalt', () => {
        const model = createGameModel();
        model.update(COUNTDOWN_MS);
        // Flat out, turning off the track into the trees or the wall
        let elapsedMs = 0;
        while (model.car.wrecks === 0 && elapsedMs < 20000) {
            model.steering = elapsedMs > 3000 && elapsedMs < 3600 ? 1 : 0;
            model.update(FRAME_MS);
            elapsedMs += FRAME_MS;
        }
        expect(model.car.wrecks).toBe(1);

        model.steering = 0;
        model.update(WRECK_MS + FRAME_MS);

        expect(model.car.isWrecked).toBe(false);
        expect(model.car.isOnGrass).toBe(false);
        expect(model.car.shieldMs).toBeGreaterThan(SHIELD_MS / 2);
    });
});

describe('a fight', () => {
    it('leaves a burning wreck where a missile blows up a rival', () => {
        const model = createGameModel();
        model.update(COUNTDOWN_MS);
        // One of your missiles, fired at a rival from just behind it, along its heading
        const rival = model.rivals.cars[0];
        const { x: fromX, z: fromZ, heading, trackSample } = rival;
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        model.battle.fireMissile(fromX - cos * BEHIND, fromZ - sin * BEHIND, heading, rival.speed + MISSILE_SPEED, trackSample, PLAYER_SHOOTER);
        model.update(500);
        expect(model.rivalsDestroyed).toBe(1);
        const { wreckage } = model.battle;
        // Where the rival was when the missile struck it, since a wrecked rival stays where it blew up
        const wreck = wreckage.find((w) => w.isActive);
        expect(wreck).toBeDefined();
        expect(Math.hypot(wreck!.x - rival.x, wreck!.z - rival.z)).toBeLessThan(1);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FRAME_MS = 1000 / 60;

/** How far behind the rival the missile is fired from, in metres: a little more than a car's length. */
const BEHIND = 8;
