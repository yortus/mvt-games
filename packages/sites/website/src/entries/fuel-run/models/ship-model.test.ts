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
    describe('initial state', () => {
        it('starts at given position, alive', () => {
            const s = makeShip({ startWorldCol: 5, startWorldRow: 7 });
            expect(s.worldCol).toBe(5);
            expect(s.worldRow).toBe(7);
            expect(s.isAlive).toBe(true);
        });
    });

    describe('update - scroll', () => {
        it('advances with scroll speed', () => {
            const s = makeShip({ scrollSpeed: 3, speed: 6 });
            s.update(1000, 0); // 1 second, scrollCol=0
            // worldCol = 5 + 3*1 = 8
            expect(s.worldCol).toBeCloseTo(8, 1);
        });
    });

    describe('update - player movement', () => {
        it('moves right when direction set', () => {
            const s = makeShip({ speed: 6, scrollSpeed: 0 });
            s.setXDirection('right');
            s.update(1000, 0);
            expect(s.worldCol).toBeCloseTo(11, 1); // 5 + 6
        });

        it('moves left when direction set', () => {
            const s = makeShip({ speed: 6, scrollSpeed: 0, startWorldCol: 10 });
            s.setXDirection('left');
            s.update(1000, 0);
            expect(s.worldCol).toBeCloseTo(4, 1); // 10 - 6
        });

        it('moves up when direction set', () => {
            const s = makeShip({ speed: 6, scrollSpeed: 0 });
            s.setYDirection('up');
            s.update(1000, 0);
            expect(s.worldRow).toBeCloseTo(1, 1); // 7 - 6
        });

        it('moves down when direction set', () => {
            const s = makeShip({ speed: 6, scrollSpeed: 0 });
            s.setYDirection('down');
            s.update(1000, 0);
            expect(s.worldRow).toBeCloseTo(13, 1); // 7 + 6
        });
    });

    describe('update - clamping', () => {
        it('clamps to min screen col', () => {
            const s = makeShip({ scrollSpeed: 0, speed: 100, minScreenCol: 1 });
            s.setXDirection('left');
            s.update(1000, 0); // tries to go far left
            const screenCol = s.worldCol - 0; // scrollCol=0
            expect(screenCol).toBeCloseTo(1, 1);
        });

        it('clamps to max screen col', () => {
            const s = makeShip({ scrollSpeed: 0, speed: 100, maxScreenCol: 18 });
            s.setXDirection('right');
            s.update(1000, 0);
            const screenCol = s.worldCol - 0;
            expect(screenCol).toBeCloseTo(18, 1);
        });

        it('clamps to min row', () => {
            const s = makeShip({ scrollSpeed: 0, speed: 100, minRow: 0.5 });
            s.setYDirection('up');
            s.update(1000, 0);
            expect(s.worldRow).toBeCloseTo(0.5, 1);
        });

        it('clamps to max row', () => {
            const s = makeShip({ scrollSpeed: 0, speed: 100, maxRow: 13.5 });
            s.setYDirection('down');
            s.update(1000, 0);
            expect(s.worldRow).toBeCloseTo(13.5, 1);
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
