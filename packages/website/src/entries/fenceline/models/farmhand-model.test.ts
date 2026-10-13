import { describe, expect, it } from 'vitest';
import { createFarmhandModel, type FarmhandModel } from './farmhand-model';
import { createFieldModel } from './field-model';
import { FARMHAND_SPEED, SLACK_DELAY_MS, SLACK_SPEED } from './model-constants';
import { createPlayerInput, type PlayerInput } from './player-input';

const STEP_MS = 1000 / 60;
/** How long the farmhand takes to go one grid step. */
const ONE_STEP_MS = 1000 / FARMHAND_SPEED;

function makeFarmhand(): { farmhand: FarmhandModel; input: PlayerInput } {
    const field = createFieldModel({ rows: 8, cols: 10, obstacles: [] });
    const input = createPlayerInput();
    const farmhand = createFarmhandModel({ row: 8, col: 5, speed: FARMHAND_SPEED, input, field });
    return { farmhand, input };
}

/** Runs the farmhand for `ms`, a frame at a time. */
function run(farmhand: FarmhandModel, ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) farmhand.update(STEP_MS);
}

describe('FarmhandModel', () => {
    it('walks along the fence the way held, and stops at a grid point when let go', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'right';
        run(farmhand, ONE_STEP_MS * 2.5);
        input.direction = 'none';
        run(farmhand, ONE_STEP_MS);
        expect(farmhand.row).toBe(8);
        expect(farmhand.col).toBe(8);
        expect(farmhand.phase).toBe('walking');
    });

    it('stays on the fence without the string button held', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        run(farmhand, ONE_STEP_MS * 3);
        expect(farmhand.row).toBe(8);
        expect(farmhand.isMoving).toBe(false);
    });

    it('strings wire into the meadow with the string button held, and keeps going once off the fence', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 0.5);
        input.stringPressed = false;
        run(farmhand, ONE_STEP_MS * 2.6);
        expect(farmhand.phase).toBe('stringing');
        expect(farmhand.wireLength).toBe(4);
        expect(farmhand.wireRows[0]).toBe(8);
        expect(farmhand.wireRows[3]).toBe(5);
    });

    it('reaches a fence, ready to tie the wire off, and walks on once it is', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 20);
        expect(farmhand.hasReachedFence).toBe(true);
        expect(farmhand.pointRow).toBe(0);
        expect(farmhand.wireLength).toBe(9);
        farmhand.tieOff();
        expect(farmhand.phase).toBe('walking');
        expect(farmhand.wireLength).toBe(0);
    });

    it('never steps back onto its own wire', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 2);
        input.direction = 'down';
        run(farmhand, ONE_STEP_MS * 2);
        const stoppedAt = farmhand.row;
        run(farmhand, ONE_STEP_MS * 2);
        expect(farmhand.row).toBe(stoppedAt);
        expect(farmhand.row).toBeLessThan(8);
        expect(farmhand.isMoving).toBe(false);
    });

    it('lets the wire go slack from its post while standing still, and snaps it when the slack arrives', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 3);
        input.direction = 'none';
        run(farmhand, SLACK_DELAY_MS);
        expect(farmhand.slackDistance).toBe(0);
        run(farmhand, (1000 / SLACK_SPEED) * 1.5);
        expect(farmhand.slackDistance).toBeGreaterThan(1);
        expect(farmhand.hasWireSnapped).toBe(false);
        run(farmhand, (1000 / SLACK_SPEED) * 4);
        expect(farmhand.hasWireSnapped).toBe(true);
    });

    it('takes up the slack on moving again', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 3);
        input.direction = 'none';
        run(farmhand, SLACK_DELAY_MS + 200);
        expect(farmhand.slackDistance).toBeGreaterThan(0);
        input.direction = 'left';
        run(farmhand, STEP_MS);
        expect(farmhand.slackDistance).toBe(0);
    });

    describe('steered by swipes', () => {
        function swipe(input: PlayerInput, direction: PlayerInput['swipeDirection']): void {
            input.swipeDirection = direction;
            input.swipeCount++;
        }

        it('keeps going the way swiped with nothing held, until a tap stops it', () => {
            const { farmhand, input } = makeFarmhand();
            swipe(input, 'right');
            run(farmhand, ONE_STEP_MS * 2.5);
            expect(farmhand.isMoving).toBe(true);
            input.tapCount++;
            run(farmhand, ONE_STEP_MS * 2);
            expect(farmhand.isMoving).toBe(false);
            expect(Number.isInteger(farmhand.col)).toBe(true);
            expect(farmhand.col).toBeGreaterThan(5);
        });

        it('strings wire off the fence without the string button', () => {
            const { farmhand, input } = makeFarmhand();
            swipe(input, 'up');
            run(farmhand, ONE_STEP_MS * 3);
            expect(farmhand.phase).toBe('stringing');
            expect(farmhand.wireLength).toBeGreaterThan(1);
        });

        it('sets off again on a swipe the same way after a tap', () => {
            const { farmhand, input } = makeFarmhand();
            swipe(input, 'right');
            run(farmhand, ONE_STEP_MS);
            input.tapCount++;
            run(farmhand, ONE_STEP_MS * 2);
            const stoppedAt = farmhand.col;
            swipe(input, 'right');
            run(farmhand, ONE_STEP_MS * 2);
            expect(farmhand.col).toBeGreaterThan(stoppedAt);
        });

        it('goes the way held over the way swiped', () => {
            const { farmhand, input } = makeFarmhand();
            swipe(input, 'right');
            input.direction = 'left';
            run(farmhand, ONE_STEP_MS * 2);
            expect(farmhand.col).toBeLessThan(5);
        });

        it('forgets the swipe when caught, so it waits after coming back', () => {
            const { farmhand, input } = makeFarmhand();
            swipe(input, 'up');
            run(farmhand, ONE_STEP_MS * 2);
            farmhand.snap();
            farmhand.respawn();
            run(farmhand, ONE_STEP_MS * 3);
            expect(farmhand.isMoving).toBe(false);
            expect(farmhand.phase).toBe('walking');
        });
    });

    it('tells whether its wire, or the farmhand at its end, is within reach of a point', () => {
        const { farmhand, input } = makeFarmhand();
        expect(farmhand.isWireWithin(8, 5, 1)).toBe(false);
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 3);
        input.direction = 'none';
        run(farmhand, ONE_STEP_MS);
        // The wire runs up column 5 from row 8
        expect(farmhand.isWireWithin(7, 5.5, 1)).toBe(true);
        expect(farmhand.isWireWithin(7, 7, 1)).toBe(false);
        expect(farmhand.isWireWithin(farmhand.row - 0.5, 5, 1)).toBe(true);
    });

    it('goes back to the wire\'s post when it respawns', () => {
        const { farmhand, input } = makeFarmhand();
        input.direction = 'up';
        input.stringPressed = true;
        run(farmhand, ONE_STEP_MS * 3);
        farmhand.snap();
        expect(farmhand.phase).toBe('snapped');
        farmhand.respawn();
        expect(farmhand.row).toBe(8);
        expect(farmhand.col).toBe(5);
        expect(farmhand.wireLength).toBe(0);
        expect(farmhand.phase).toBe('walking');
    });
});
