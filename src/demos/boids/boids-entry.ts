import type { Container } from 'pixi.js';
import type { DemoEntry, DemoSession } from '../demo-entry';
import { createFlockModel } from './flock-model';
import { createBoidsView } from './boids-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoidsEntry(): DemoEntry {
    return {
        id: 'boids',
        name: 'Boids - Flocking Simulation',
        description:
            'A bird flocking simulation using the boids algorithm developed '
            + 'by Craig Reynolds in 1986. The three classic rules - separation, '
            + 'alignment, and cohesion - produce emergent flocking behaviour '
            + 'from simple local interactions. All parameters are tuneable via sliders.',
        techniques: [
            'Boids flocking algorithm',
            'Separation / Alignment / Cohesion',
            'Interactive parameter tuning',
            'Domain coordinates in metres',
        ],
        get screenWidth() { return computeLayout().screenWidth; },
        get screenHeight() { return computeLayout().screenHeight; },
        thumbnailAdvanceMs: 2000,

        start(stage: Container): DemoSession {
            const layout = computeLayout();

            const model = createFlockModel({
                arenaWidth: ARENA_WIDTH,
                arenaHeight: ARENA_HEIGHT,
                boidCount: 200,
                separation: 3.0,
                alignment: 0.5,
                cohesion: 3.0,
                wander: 9.0,
                visionAngle: 4.0,
                maxSpeed: 20,
                minSpeed: 5,
                perceptionRadius: 16,
            });

            let timeScale = 1;

            let view = createBoidsView({
                model,
                simWidth: layout.simWidth,
                simHeight: layout.simHeight,
                isPortrait: layout.isPortrait,
                getTimeScale: () => timeScale,
                onTimeScaleChanged: (v) => { timeScale = v; },
            });
            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs * timeScale);
                },
                resize(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });

                    const newLayout = computeLayout();
                    view = createBoidsView({
                        model,
                        simWidth: newLayout.simWidth,
                        simHeight: newLayout.simHeight,
                        isPortrait: newLayout.isPortrait,
                        getTimeScale: () => timeScale,
                        onTimeScaleChanged: (v) => { timeScale = v; },
                    });
                    stage.addChild(view);
                },
                destroy(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Arena in metres
const ARENA_WIDTH = 100;
const ARENA_HEIGHT = 82;

// Panel layout (must stay in sync with boids-view constants)
const SLIDER_WIDTH = 320;
const PANEL_PADDING = 20;
const PANEL_TOTAL = SLIDER_WIDTH + PANEL_PADDING * 2;
const CONTROLS_HEIGHT = 460;

// Viewport sizing
const NAV_HEIGHT = 48;
const CANVAS_MARGIN = 12;
const MIN_SIM_WIDTH = 300;
const PORTRAIT_THRESHOLD = 0.67;

interface Layout {
    simWidth: number;
    simHeight: number;
    screenWidth: number;
    screenHeight: number;
    isPortrait: boolean;
}

function computeLayout(): Layout {
    const avW = typeof window !== 'undefined'
        ? window.innerWidth - CANVAS_MARGIN * 2
        : 1600;
    const avH = typeof window !== 'undefined'
        ? window.innerHeight - NAV_HEIGHT - CANVAS_MARGIN * 2
        : 1000;

    const isPortrait = avW / avH < PORTRAIT_THRESHOLD;
    const arenaAspect = ARENA_HEIGHT / ARENA_WIDTH;

    let simW: number;
    let simH: number;

    if (isPortrait) {
        // Controls go below - arena gets full width
        simW = avW;
        simH = simW * arenaAspect;

        // Shrink if arena + controls would exceed available height
        if (simH + CONTROLS_HEIGHT > avH) {
            simH = avH - CONTROLS_HEIGHT;
            simW = simH / arenaAspect;
        }

        simW = Math.max(Math.round(simW), MIN_SIM_WIDTH);
        simH = Math.max(Math.round(simH), Math.round(MIN_SIM_WIDTH * arenaAspect));

        return {
            simWidth: simW,
            simHeight: simH,
            screenWidth: simW,
            screenHeight: simH + CONTROLS_HEIGHT,
            isPortrait,
        };
    }

    // Landscape: controls beside arena
    simH = avH;
    simW = simH / arenaAspect;

    if (simW + PANEL_TOTAL > avW) {
        simW = avW - PANEL_TOTAL;
        simH = simW * arenaAspect;
    }

    simW = Math.max(Math.round(simW), MIN_SIM_WIDTH);
    simH = Math.max(Math.round(simH), Math.round(MIN_SIM_WIDTH * arenaAspect));

    return {
        simWidth: simW,
        simHeight: simH,
        screenWidth: simW + PANEL_TOTAL,
        screenHeight: simH,
        isPortrait,
    };
}
