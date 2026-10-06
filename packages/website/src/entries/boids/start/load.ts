import { PERFMON_HEIGHT } from '#shared';
import { createPerformanceMetrics } from '@mvtjs/pixi';
import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createFlockModel } from '../models';
import { BoidsView, PANEL_PADDING, PERFMON_GAP, SLIDER_SPACING, SLIDER_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start the boids demo, which has no assets to load. It lays
 * itself out for the area it plays in: the arena with the controls beside it,
 * or below it in a tall, narrow area.
 */
export async function load(): Promise<PixiEntryStarter> {
    let layout = computeLayout(DESIGN_WIDTH, DESIGN_HEIGHT);
    return {
        kind: 'pixi',
        get screenWidth() { return layout.screenWidth; },
        get screenHeight() { return layout.screenHeight; },
        fitTo(width, height) {
            layout = computeLayout(width, height);
        },
        thumbnailAdvanceMs: 2000,

        start({ stage, host }): EntrySession {
            const performanceMetrics = host === undefined ? undefined : createPerformanceMetrics(host);

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
            let isShowingInfluences = false;

            let view = BoidsView({
                model,
                simWidth: layout.simWidth,
                simHeight: layout.simHeight,
                isPortrait: layout.isPortrait,
                timeScale: () => timeScale,
                onTimeScaleChanged: (v) => { timeScale = v; },
                isShowingInfluences: () => isShowingInfluences,
                onShowInfluencesToggled: (v) => { isShowingInfluences = v; },
                performanceMetrics: () => performanceMetrics,
            });
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    model.update(deltaMs * timeScale);
                },
                resize(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });

                    view = BoidsView({
                        model,
                        simWidth: layout.simWidth,
                        simHeight: layout.simHeight,
                        isPortrait: layout.isPortrait,
                        timeScale: () => timeScale,
                        onTimeScaleChanged: (v) => { timeScale = v; },
                        isShowingInfluences: () => isShowingInfluences,
                        onShowInfluencesToggled: (v) => { isShowingInfluences = v; },
                        performanceMetrics: () => performanceMetrics,
                    });
                    stage.addChild(view);
                },
                destroy(): void {
                    performanceMetrics?.destroy();
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

const PANEL_TOTAL = SLIDER_WIDTH + PANEL_PADDING * 2;
/** Seven sliders, the influence checkbox and the perfmon panel, with padding. */
const CONTROLS_HEIGHT = 7 * SLIDER_SPACING + PERFMON_GAP + PERFMON_HEIGHT + PANEL_PADDING * 2;

/**
 * The area the demo is designed around, before it is fitted to one: its
 * entry lists the play area this lays out to, the arena with the controls
 * beside it, filling it exactly.
 */
const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 605;

const MIN_SIM_WIDTH = 300;
const PORTRAIT_THRESHOLD = 0.67;

interface Layout {
    simWidth: number;
    simHeight: number;
    screenWidth: number;
    screenHeight: number;
    isPortrait: boolean;
}

/** The layout for an area of this size, in CSS pixels. */
function computeLayout(availableWidth: number, availableHeight: number): Layout {
    const avW = availableWidth;
    const avH = availableHeight;

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
        // A short arena would otherwise cut the controls off.
        screenHeight: Math.max(simH, CONTROLS_HEIGHT),
        isPortrait,
    };
}
