import { describe, expect, it } from 'vitest';
import { createDiggerModel } from './digger-model';

const FIELD = 12;
const SPEED = 4;
const TICK_MS = 1000 / 60;
const START_COL = 1;

describe('DiggerModel', () => {
    it('is moving throughout, tile after tile, while a direction is held', () => {
        const digger = createDigger();
        digger.setDirection('right');
        digger.update(TICK_MS);
        // Long enough to cross several tiles
        const ticks = Math.ceil(3 * 1000 / SPEED / TICK_MS);
        for (let i = 0; i < ticks; i++) {
            digger.update(TICK_MS);
            expect(digger.isMoving, `tick ${i}, at column ${digger.col}`).toBe(true);
        }
    });

    it('stops moving once the direction is let go, at the next tile', () => {
        const digger = createDigger();
        digger.setDirection('right');
        for (let i = 0; i < 10; i++) digger.update(TICK_MS);
        digger.setDirection('none');
        for (let i = 0; i < Math.ceil(1000 / SPEED / TICK_MS) + 1; i++) digger.update(TICK_MS);
        expect(digger.isMoving).toBe(false);
        // The tile after the one it started on
        expect(digger.col).toBe(START_COL + 1);
    });
});

describe('DiggerModel: the harpoon', () => {
    it('counts a shot for each press, the harpoon in or still out', () => {
        const digger = createDigger();
        digger.startPump();
        for (let i = 0; i < 10; i++) digger.update(TICK_MS);
        // Let go, and press again while it is on its way back
        digger.stopPump();
        digger.update(TICK_MS);
        expect(digger.isHarpoonExtended).toBe(true);
        digger.startPump();
        digger.update(TICK_MS);
        expect(digger.harpoonShots).toBe(2);
    });

    it('counts no shot for a press that pumps the creature it holds', () => {
        const digger = createDigger();
        digger.startPump();
        digger.update(TICK_MS);
        digger.lockHarpoon(true);
        digger.stopPump();
        digger.startPump();
        expect(digger.harpoonShots).toBe(1);
    });
});

function createDigger() {
    return createDiggerModel({
        startRow: 1,
        startCol: START_COL,
        speed: SPEED,
        fieldRows: FIELD,
        fieldCols: FIELD,
        isWalkable: () => true,
        isDirt: () => false,
    });
}
