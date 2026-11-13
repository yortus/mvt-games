import type { Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { CITY_START_Y } from './city-layout';
import { TrafficView } from './traffic-view';

describe('TrafficView', () => {
    it('drives only on the streets, not over the water', () => {
        let scrollY = 0;
        const view = TrafficView({ scrollY: () => scrollY, timeMs: () => 5000, height: 320 });
        refreshView(view);
        expect(view.children.some((s) => (s as Sprite).visible)).toBe(false);

        scrollY = CITY_START_Y + 100;
        refreshView(view);
        expect(view.children.every((s) => (s as Sprite).visible)).toBe(true);
    });
});
