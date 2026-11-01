import { describe, expect, it } from 'vitest';
import { createShipModel } from './ship-model';

const SPEED = 100;
const START_X = 500;

function makeShip(): ReturnType<typeof createShipModel> {
    return createShipModel({ startX: START_X, startY: 0, speed: SPEED, minX: 0, maxX: 1000 });
}

describe('ShipModel', () => {
    it('flies to its target at its own speed, and stops there', () => {
        const ship = makeShip();
        const distance = SPEED * 1.5;
        ship.setTargetX(START_X + distance);
        ship.update(1000);
        expect(ship.x).toBeCloseTo(START_X + SPEED);
        ship.update(1000);
        expect(ship.x).toBeCloseTo(START_X + distance);
        ship.update(1000);
        expect(ship.x).toBeCloseTo(START_X + distance);
    });

    it('flies to its target rather than the way it is moving', () => {
        const ship = makeShip();
        ship.setDirection('right');
        ship.setTargetX(START_X - SPEED);
        ship.update(1000);
        expect(ship.x).toBeCloseTo(START_X - SPEED);
    });

    it('moves the way it is moving again once its target is cleared', () => {
        const ship = makeShip();
        ship.setDirection('right');
        ship.setTargetX(START_X);
        ship.update(1000);
        ship.setTargetX(undefined);
        ship.update(1000);
        expect(ship.x).toBeCloseTo(START_X + SPEED);
    });
});
