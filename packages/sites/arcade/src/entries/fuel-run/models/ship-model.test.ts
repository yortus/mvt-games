import { describe, it, expect } from 'vitest';
import { createShipModel } from './ship-model';

function makeShip(overrides?: Partial<{
    startWorldCol: number;
    startWorldRow: number;
    speed: number;
    scrollSpeed: number;
    minScreenCol: number;
    maxScreenCol: number;
    minRow: number;
    maxRow: number;
}>) {
    return createShipModel({
        startWorldCol: overrides?.startWorldCol ?? 5,
        startWorldRow: overrides?.startWorldRow ?? 7,
        speed: overrides?.speed ?? 6,
        scrollSpeed: overrides?.scrollSpeed ?? 3,
        minScreenCol: overrides?.minScreenCol ?? 1,
        maxScreenCol: overrides?.maxScreenCol ?? 18,
        minRow: overrides?.minRow ?? 0.5,
        maxRow: overrides?.maxRow ?? 13.5,
    });
}

describe('ShipModel', () => {
    describe('update - scroll', () => {
        it('advances with scroll speed', () => {
            const s = makeShip({ scrollSpeed: 3, speed: 6 });
            s.update(1000, 0); // 1 second, scrollCol=0
            // worldCol = 5 + 3*1 = 8
            expect(s.worldCol).toBeCloseTo(8, 1);
        });
    });

    describe('update - target', () => {
        it('flies to its target on the screen at its own speed, and holds it as the screen scrolls', () => {
            const speed = 6;
            const scrollSpeed = 3;
            const s = makeShip({ startWorldCol: 5, startWorldRow: 7, speed, scrollSpeed });
            const targetScreenCol = 5 + speed * 1.5;
            const targetRow = 7 - speed * 0.5;
            s.setTarget(targetScreenCol, targetRow);
            s.update(1000, scrollSpeed);
            expect(s.worldCol - scrollSpeed).toBeCloseTo(5 + speed);
            expect(s.worldRow).toBeCloseTo(targetRow);
            s.update(1000, scrollSpeed * 2);
            expect(s.worldCol - scrollSpeed * 2).toBeCloseTo(targetScreenCol);
            s.update(1000, scrollSpeed * 3);
            expect(s.worldCol - scrollSpeed * 3).toBeCloseTo(targetScreenCol);
            expect(s.worldRow).toBeCloseTo(targetRow);
        });

        it('flies to its target rather than the ways it is pushed', () => {
            const s = makeShip({ startWorldCol: 5, startWorldRow: 7, scrollSpeed: 0 });
            s.setXDirection('right');
            s.setYDirection('down');
            s.setTarget(5, 7);
            s.update(1000, 0);
            expect(s.worldCol).toBeCloseTo(5);
            expect(s.worldRow).toBeCloseTo(7);
        });
    });

    describe('kill / respawn', () => {
        it('kill sets alive to false', () => {
            const s = makeShip();
            s.kill();
            expect(s.isAlive).toBe(false);
        });

        it('dead ship does not move', () => {
            const s = makeShip({ scrollSpeed: 3 });
            s.kill();
            const col = s.worldCol;
            s.update(1000, 0);
            expect(s.worldCol).toBe(col);
        });

        it('respawn restores alive at new position', () => {
            const s = makeShip();
            s.kill();
            s.respawn(20, 5);
            expect(s.isAlive).toBe(true);
            expect(s.worldCol).toBe(20);
            expect(s.worldRow).toBe(5);
        });
    });
});
