import { describe, expect, it } from 'vitest';
import { CABINET_ENTRIES, FINAL_DEPTH, HALL_LENGTH, HEAD_INSIDE_MS, STEP_MS, WALK_SPEED, WHITE_IN_MS, WHITE_OUT_MS } from '../data';
import { createGameModel, type GameModel } from './game-model';
import { VALLEY_WALK_HALF_WIDTH } from './meadow-terrain';

describe('the hall inside the hall', () => {
    it('puts you one hall deeper, back at the entrance, when you step into the hall cabinet', () => {
        const model = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
        const start = { x: model.playerX, z: model.playerZ };
        stepIntoHallCabinet(model);
        expect(model.depth).toBe(1);
        expect(model.mode).toBe('walking');
        expect({ x: model.playerX, z: model.playerZ }).toEqual(start);
    });

    it('brings you back out, stepping back from the hall cabinet, when you walk through the door', () => {
        const model = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
        stepIntoHallCabinet(model);
        stepIntoHallCabinet(model);
        model.walking = 'back';
        // Until the door, about half a second behind the entrance
        for (let frame = 0; frame < 60 && model.depth === 2; frame++) model.update(FRAME_MS);
        expect(model.depth).toBe(1);
        expect(model.mode).toBe('stepping-back');
        expect(model.cabinetInPlay).toBe(model.hallCabinet);
    });

    it('keeps the door of the hall itself shut, since the hall is the whole site', () => {
        const model = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
        model.walking = 'back';
        walkFor(model, 1000);
        expect(model.mode).toBe('walking');
        expect(model.depth).toBe(0);
        expect(model.isDoorOpen).toBe(false);
    });
});

describe('the last hall', () => {
    it('is empty but for the button, which you can reach at the far end', () => {
        const model = goToTheLastHall();
        expect(model.hasCabinets).toBe(false);
        model.walking = 'forward';
        walkFor(model, HALL_WALK_MS);
        expect(model.cabinetInReach).toBeUndefined();
        expect(model.isButtonInReach).toBe(true);
    });

    // A click or tap on the button presses it from wherever the visitor can see it, not only from in reach
    it('takes you outside from anywhere in the last hall, and only there, once the button is pressed', () => {
        const model = goToTheLastHall();
        model.goOutside();
        expect(model.mode).toBe('going-outside');
        const firstHall = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
        firstHall.goOutside();
        expect(firstHall.mode).toBe('walking');
    });

    it('takes you outside, onto dry land in the meadow, once the view has faded to white and back', () => {
        const model = goToTheLastHall();
        model.walking = 'forward';
        walkFor(model, HALL_WALK_MS);
        model.walking = 'none';
        model.goOutside();
        walkFor(model, WHITE_OUT_MS);
        expect(model.isOutside).toBe(true);
        expect(model.whiteness).toBeGreaterThan(0.9);
        walkFor(model, WHITE_IN_MS);
        expect(model.mode).toBe('walking');
        expect(model.whiteness).toBe(0);
        const kind = model.meadow.kindAt(Math.floor(model.playerX), Math.floor(model.playerZ));
        expect(['grass', 'flowers']).toContain(kind);
    });

    it('takes you back inside, to the button, once the way in has been held a moment, and not if it is let go sooner', () => {
        const model = goOutside();
        model.isHeadingInside = true;
        walkFor(model, HEAD_INSIDE_MS / 2);
        model.isHeadingInside = false;
        walkFor(model, 1000);
        expect(model.isOutside).toBe(true);
        expect(model.whiteness).toBe(0);
        model.isHeadingInside = true;
        // And a few frames more, since each step of the walk is a whole frame
        walkFor(model, HEAD_INSIDE_MS + WHITE_OUT_MS + WHITE_IN_MS + 100);
        expect(model.isOutside).toBe(false);
        expect(model.mode).toBe('walking');
        expect(model.isButtonInReach).toBe(true);
    });

    it('keeps you out of the trees in the meadow, and off the steep sides of the valley', () => {
        const model = goToTheLastHall();
        model.walking = 'forward';
        walkFor(model, HALL_WALK_MS);
        model.goOutside();
        walkFor(model, WHITE_OUT_MS + WHITE_IN_MS + FRAME_MS);
        // Turn away from the river, slantwise, and walk a long way, into the forest at the foot of the hills
        model.turnBy(Math.PI / 3);
        model.walking = 'forward';
        let isInATree = false;
        let treesPassed = 0;
        let furthest = 0;
        for (let elapsed = 0; elapsed < 30000; elapsed += FRAME_MS) {
            model.update(FRAME_MS);
            const col = Math.floor(model.playerX);
            const row = Math.floor(model.playerZ);
            const isTree = model.meadow.kindAt(col, row) === 'tree';
            // The trunk is in the middle of its cell, so a player in the cell's middle has walked into it
            if (isTree && Math.hypot(model.playerX - col - 0.5, model.playerZ - row - 0.5) < 0.2) isInATree = true;
            if (model.meadow.kindAt(col, row + 1) === 'tree') treesPassed++;
            furthest = Math.max(furthest, Math.abs(model.playerZ - model.meadow.valleyMiddleAt(model.playerX)));
        }
        expect(treesPassed).toBeGreaterThan(0);
        expect(isInATree).toBe(false);
        expect(furthest).toBeLessThanOrEqual(VALLEY_WALK_HALF_WIDTH);
    });
});

/** Steps into the hall cabinet until the player reaches the last hall. */
function goToTheLastHall(): GameModel {
    const model = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
    while (model.depth < FINAL_DEPTH) stepIntoHallCabinet(model);
    return model;
}

/** Walks from the entrance straight down the aisle to the hall cabinet at the far end, and steps into it. */
function stepIntoHallCabinet(model: GameModel): void {
    model.walking = 'forward';
    walkFor(model, HALL_WALK_MS);
    model.walking = 'none';
    expect(model.cabinetInReach).toBe(model.hallCabinet);
    model.playCabinetInReach();
    walkFor(model, STEP_MS);
}

/** Goes to the last hall, walks up to the button, presses it, and waits until the player has arrived in the meadow. */
function goOutside(): GameModel {
    const model = goToTheLastHall();
    model.walking = 'forward';
    walkFor(model, HALL_WALK_MS);
    model.walking = 'none';
    model.goOutside();
    walkFor(model, WHITE_OUT_MS + WHITE_IN_MS);
    return model;
}

function walkFor(model: GameModel, ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) model.update(FRAME_MS);
}

const FRAME_MS = 1000 / 60;

/** Long enough to walk the length of a hall. */
const HALL_WALK_MS = (HALL_LENGTH / WALK_SPEED) * 1000;
