// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/html';
import { FlockPanelView } from './flock-panel-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    const flock = { boidCount: 40, separation: 3, alignment: 0.5, cohesion: 3, wander: 9 };
    const slid: [string, number][] = [];
    const panel = FlockPanelView({
        boidCount: () => flock.boidCount,
        separation: () => flock.separation,
        alignment: () => flock.alignment,
        cohesion: () => flock.cohesion,
        wander: () => flock.wander,
        onBoidCountSlid: (count) => slid.push(['boidCount', count]),
        onSeparationSlid: (weight) => slid.push(['separation', weight]),
        onAlignmentSlid: (weight) => slid.push(['alignment', weight]),
        onCohesionSlid: (weight) => slid.push(['cohesion', weight]),
        onWanderSlid: (weight) => slid.push(['wander', weight]),
    });
    document.body.replaceChildren(panel);
    refreshView(panel);
    const slider = (key: string): HTMLInputElement => panel.querySelector(`#flock-${key}`) as HTMLInputElement;
    const shown = (key: string): string => slider(key).parentElement?.querySelector('.range-value')?.textContent ?? '';
    const slide = (key: string, value: number): void => {
        slider(key).valueAsNumber = value;
        slider(key).dispatchEvent(new Event('input'));
    };
    return { flock, slid, panel, slider, shown, slide };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FlockPanelView', () => {
    it('shows each setting on its slider and beside it', () => {
        const t = setup();

        expect(t.slider('boidCount').valueAsNumber).toBe(40);
        expect(t.shown('boidCount')).toBe('40');
        expect(t.slider('alignment').valueAsNumber).toBe(0.5);
        expect(t.shown('alignment')).toBe('0.5');
    });

    it('reports each slider that moves, and where to', () => {
        const t = setup();

        t.slide('boidCount', 120);
        t.slide('separation', 4);
        t.slide('alignment', 2);
        t.slide('cohesion', 5);
        t.slide('wander', 10);

        expect(t.slid).toEqual([['boidCount', 120], ['separation', 4], ['alignment', 2], ['cohesion', 5], ['wander', 10]]);
    });

    it('shows what it is given, not where a slider was moved to', () => {
        const t = setup();

        t.slide('boidCount', 120);
        refreshView(t.panel);

        expect(t.shown('boidCount')).toBe('40');
    });

    it('follows a setting when something else changes it', () => {
        const t = setup();

        // As a click in the three.js scene does
        t.flock.boidCount = 60;
        refreshView(t.panel);

        expect(t.slider('boidCount').valueAsNumber).toBe(60);
        expect(t.shown('boidCount')).toBe('60');
    });
});
