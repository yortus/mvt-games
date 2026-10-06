import type { Container, Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { CHUNK_HEIGHT, CITY_START_Y, chunkKindAt } from './city-layout';
import { CityView } from './city-view';
import { TrafficView } from './traffic-view';

describe('CityView', () => {
    it('draws every kind of chunk, over a long flight', () => {
        let scrollY = 0;
        const view = CityView({ scrollY: () => scrollY, timeMs: () => scrollY, width: 240, height: 320 });
        const kinds = new Set<string>();
        for (; scrollY < 400 * CHUNK_HEIGHT; scrollY += CHUNK_HEIGHT / 3) {
            refreshView(view);
            kinds.add(chunkKindAt(Math.floor(scrollY / CHUNK_HEIGHT)));
        }
        expect([...kinds].sort()).toEqual(['blocks', 'coast', 'hub', 'sea']);
    });

    it('places each chunk where the scroll puts it', () => {
        let scrollY = 0;
        const view = CityView({ scrollY: () => scrollY, timeMs: () => 0, width: 240, height: 320 });
        refreshView(view);
        const ground = (view.children[0] as Container).children;
        const firstTop = ground[0].y;
        scrollY = 10;
        refreshView(view);
        expect(ground[0].y).toBe(firstTop + 10);
    });
});

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
