// Spike: the 3D boids' settings panel, as its entry styles it.
import { refreshView } from '@mvtjs/html';
import { describe } from 'vitest';
import { createFlockModel } from '../../src/entries/boids';
import { FlockPanelView } from '../../src/entries/boids-3d/views';
import '../../src/entries/boids-3d/boids-3d.css';
import { visualHtmlTest } from '../harness';

describe('boids 3d', () => {
    visualHtmlTest('settings panel', () => {
        const model = createFlockModel({
            arenaWidth: 100, arenaHeight: 82, boidCount: 20, separation: 3.0, alignment: 0.5, cohesion: 3.0,
            wander: 9.0, visionAngle: 4.0, maxSpeed: 20, minSpeed: 5, perceptionRadius: 16,
        });
        const view = FlockPanelView({ model });
        refreshView(view);
        const root = document.createElement('div');
        root.className = 'boids-3d';
        root.style.cssText = 'position:relative;width:320px;height:420px;';
        root.append(view);
        return root;
    });
});
