import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/pixi';
import {
    BENCH_LENGTH, BENCH_SPOTS, BENCH_WIDTH, HANGING_SPOTS, PARTITIONS, POT_SIZE, POT_SPOTS, ROOM_LENGTH, ROOM_WIDTH,
    START_X, START_Z, STEP_MS, VIEW_DISTANCE, VISITOR_RADIUS, WALK_SPEED,
} from '../data';
import { createDemoModel, type DemoModel } from './demo-model';

describe('a visitor in the gallery', () => {
    it('has room to stand in front of every painting, clear of the walls, the benches and the pots', () => {
        const blocked: string[] = [];
        for (let i = 0; i < HANGING_SPOTS.length; i++) {
            const spot = HANGING_SPOTS[i];
            const x = spot.x + Math.cos(spot.facing) * VIEW_DISTANCE;
            const z = spot.z + Math.sin(spot.facing) * VIEW_DISTANCE;
            const isInside = Math.abs(x) < ROOM_LENGTH / 2 - VISITOR_RADIUS && Math.abs(z) < ROOM_WIDTH / 2 - VISITOR_RADIUS;
            const isOnWall = PARTITIONS.some((wall) => overlaps(x, z, wall.x, wall.z, wall.sizeX, wall.sizeZ));
            const isOnBench = BENCH_SPOTS.some((bench) => overlaps(x, z, bench.x, bench.z, BENCH_LENGTH, BENCH_WIDTH));
            const isOnPot = POT_SPOTS.some((pot) => overlaps(x, z, pot.x, pot.z, POT_SIZE, POT_SIZE));
            if (!isInside || isOnWall || isOnBench || isOnPot) blocked.push(`painting ${i}`);
        }
        expect(blocked).toEqual([]);
    });

    it('is kept out of the wall between the corridors', async () => {
        const model = createDemoModel({ paintingCount: HANGING_SPOTS.length });
        // A quarter turn to the right faces south, toward the first wall between the corridors
        model.turnBy(Math.PI / 2);
        model.walking = 'forward';
        await advanceTime(4000, model);
        const wallFace = PARTITIONS[0].z - PARTITIONS[0].sizeZ / 2;
        expect(model.visitorZ).toBeCloseTo(wallFace - VISITOR_RADIUS, 5);
    });

    it('steps up to a painting, views it, and steps back square in front of it, a step further off', async () => {
        const model = await walkUpToFirstPainting();
        const painting = model.paintingInReach;
        expect(painting).toBeDefined();
        model.viewPaintingInReach();
        await advanceTime(STEP_MS, model);
        expect(model.mode).toBe('viewing');
        expect(model.paintingInView).toBe(painting);
        model.stopViewing();
        await advanceTime(STEP_MS, model);
        expect(model.mode).toBe('walking');
        expect(model.paintingInView).toBeUndefined();
        if (painting === undefined) return;
        const distance = Math.hypot(model.visitorX - painting.x, model.visitorZ - painting.z);
        expect(distance).toBeGreaterThan(VIEW_DISTANCE);
        expect(model.paintingInReach).toBe(painting);
    });

    it('sees the paintings in its own corridor, but not those through the wall between the corridors', () => {
        const model = createDemoModel({ paintingCount: HANGING_SPOTS.length });
        // Just inside the door, in the north corridor. The first painting is on its north wall, and the sixth
        // on the far side of the wall to the south, facing the middle corridor
        expect(model.isInSight(model.paintings[0])).toBe(true);
        expect(model.isInSight(model.paintings[5])).toBe(false);
    });

    it('goes through the door it came in by to the lantern room, and back through its own door, arriving inside each time', async () => {
        const model = createDemoModel({ paintingCount: HANGING_SPOTS.length });
        model.turnBy(Math.PI);
        model.walking = 'forward';
        await advanceTime(1000, model);
        expect(model.isInLanternRoom).toBe(true);
        expect(model.isInSight(model.paintings[0])).toBe(false);
        // Turned round in the lantern room, the visitor walks back out the way they came
        model.turnBy(Math.PI);
        await advanceTime(1000, model);
        expect(model.isInLanternRoom).toBe(false);
        expect(model.visitorX).toBeGreaterThan(-ROOM_LENGTH / 2);
        expect(model.walking).toBe('forward');
    });
});

/** Walks a few steps in, turns left to face the first painting, on the north wall, and walks up to it. */
async function walkUpToFirstPainting(): Promise<DemoModel> {
    const model = createDemoModel({ paintingCount: HANGING_SPOTS.length });
    model.walking = 'forward';
    await advanceTime(walkMsFor(HANGING_SPOTS[0].x - START_X), model);
    model.walking = 'none';
    model.turnBy(-Math.PI / 2);
    model.walking = 'forward';
    await advanceTime(walkMsFor(START_Z - (HANGING_SPOTS[0].z + VIEW_DISTANCE)), model);
    model.walking = 'none';
    await advanceTime(0, model);
    return model;
}

/** Whether a visitor standing at `x`, `z` would overlap a box with its middle at `boxX`, `boxZ`, `sizeX` by `sizeZ`. */
function overlaps(x: number, z: number, boxX: number, boxZ: number, sizeX: number, sizeZ: number): boolean {
    const gapX = Math.max(0, Math.abs(x - boxX) - sizeX / 2);
    const gapZ = Math.max(0, Math.abs(z - boxZ) - sizeZ / 2);
    return Math.hypot(gapX, gapZ) < VISITOR_RADIUS;
}

/** How long the visitor takes to walk `metres`. */
function walkMsFor(metres: number): number {
    return (metres / WALK_SPEED) * 1000;
}
