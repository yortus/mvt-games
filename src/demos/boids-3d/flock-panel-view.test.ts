// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshScene } from '../../html-mvt';
import { createFlockModel } from '../boids';
import { FlockPanelView } from './flock-panel-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    const model = createFlockModel({
        arenaWidth: 100,
        arenaHeight: 82,
        boidCount: 40,
        separation: 3,
        alignment: 0.5,
        cohesion: 3,
        wander: 9,
        visionAngle: 4,
        maxSpeed: 20,
        minSpeed: 5,
        perceptionRadius: 16,
        seed: 1,
    });
    const panel = FlockPanelView({ model });
    document.body.replaceChildren(panel);
    refreshScene(panel);
    const slider = (key: string): HTMLInputElement => panel.querySelector(`#flock-${key}`) as HTMLInputElement;
    const shown = (key: string): string => slider(key).parentElement?.querySelector('.range-value')?.textContent ?? '';
    return { model, panel, slider, shown };
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

    it('sets the model when a slider moves', () => {
        const t = setup();

        t.slider('boidCount').valueAsNumber = 120;
        t.slider('boidCount').dispatchEvent(new Event('input'));
        refreshScene(t.panel);

        expect(t.model.boidCount).toBe(120);
        expect(t.shown('boidCount')).toBe('120');
    });

    it('follows the model when something else changes it', () => {
        const t = setup();

        // As a click in the three.js scene does
        t.model.boidCount = 60;
        refreshScene(t.panel);

        expect(t.slider('boidCount').valueAsNumber).toBe(60);
        expect(t.shown('boidCount')).toBe('60');
    });
});
