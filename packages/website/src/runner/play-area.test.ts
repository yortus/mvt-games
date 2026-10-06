import { describe, expect, it } from 'vitest';
import { fitPlayArea } from './play-area';

describe('fitPlayArea', () => {
    it('scales the play area to fit, and centres it', () => {
        const area = fitPlayArea({ areaWidth: 1000, areaHeight: 500, screenWidth: 200, screenHeight: 200 });
        expect(area.scale).toBe(2.5);
        expect(area.stageWidth).toBe(400);
        expect(area.stageHeight).toBe(200);
        expect(area.offsetX).toBe(100);
        expect(area.offsetY).toBe(0);
    });

    it('scales by whole numbers for pixel art', () => {
        const area = fitPlayArea({ areaWidth: 1000, areaHeight: 500, screenWidth: 200, screenHeight: 200, integerScale: true });
        expect(area.scale).toBe(2);
        expect(area.stageWidth).toBe(500);
        expect(area.offsetX).toBe(150);
        expect(area.offsetY).toBe(25);
    });

    it('shrinks pixel art below 1x rather than overflow', () => {
        const area = fitPlayArea({ areaWidth: 100, areaHeight: 100, screenWidth: 200, screenHeight: 400, integerScale: true });
        expect(area.scale).toBe(0.25);
    });

    it('leaves room for touch controls, and puts a portrait play area at the top', () => {
        const area = fitPlayArea({ areaWidth: 400, areaHeight: 800, screenWidth: 200, screenHeight: 200, hasTouchControls: true });
        // Below the play area: 800 - 160 = 640 tall, so the width decides: 400 / 200
        expect(area.scale).toBe(2);
        expect(area.offsetY).toBe(0);
    });

    it('takes the larger of the portrait and landscape margins', () => {
        const area = fitPlayArea({ areaWidth: 800, areaHeight: 400, screenWidth: 200, screenHeight: 200, hasTouchControls: true });
        // Beside: (800 - 160) / 200 = 3.2, but the height allows only 2; below: 240 / 200 = 1.2
        expect(area.scale).toBe(2);
    });
});
