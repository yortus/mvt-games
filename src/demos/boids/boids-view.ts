import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { createPerfmonView, type FrameStats } from '#common';
import type { FlockModel } from './flock-model';
import { PANEL_PADDING, PERFMON_GAP, SLIDER_SPACING, SLIDER_WIDTH } from './layout-constants';
import { createSliderView } from './slider-view';
import { createCheckboxView } from './checkbox-view';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating the boids demo view. */
export interface BoidsViewOptions {
    /** The flock model to visualise. */
    readonly model: FlockModel;
    /** Width of the simulation area in pixels. */
    readonly simWidth: number;
    /** Height of the simulation area in pixels. */
    readonly simHeight: number;
    /** Whether the layout is portrait (controls below sim) or landscape (controls beside sim). */
    readonly isPortrait: boolean;
    /** Return the current time-scale multiplier. */
    getTimeScale(): number;
    /** Called when the user changes the time-scale slider. */
    onTimeScaleChanged?(value: number): void;
    /** Return whether per-boid influence vectors are shown. */
    getIsShowingInfluences(): boolean;
    /** Called when the user toggles the influence-vector checkbox. */
    onShowInfluencesToggled?(isShowing: boolean): void;
    /** Frame timing to show, or undefined where there is none (e.g. rendering a thumbnail). */
    getFrameStats: () => FrameStats | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create the main boids demo view including simulation area and control panel. */
export function createBoidsView(options: BoidsViewOptions): Container {
    const { model, simWidth, simHeight, isPortrait, getTimeScale, onTimeScaleChanged, getIsShowingInfluences, onShowInfluencesToggled, getFrameStats } = options;
    const view = new Container();
    view.label = 'boids-demo';

    // ---- Simulation area ---------------------------------------------------

    const simContainer = new Container();
    view.addChild(simContainer);

    const simBg = new Graphics();
    simContainer.addChild(simBg);

    // One Graphics per boid, all sharing one triangle drawn once and pointing
    // along +x, so a frame only positions and turns them. Redrawing every boid
    // into one Graphics each frame made Pixi build new shape data each time:
    // about 270 KB of garbage per frame.
    const boidContext = new GraphicsContext();
    drawBoidTriangle(boidContext, BOID_SIZE, 0x44ccff);
    const boidLayer = new Container();
    simContainer.addChild(boidLayer);
    const boidGfxs: Graphics[] = [];
    // The shared context is not owned by any one Graphics, so none destroys it.
    view.on('destroyed', () => boidContext.destroy());

    const debugGfx = new Graphics();
    simContainer.addChild(debugGfx);
    let isDebugDrawn = false;

    // Mask so debug vectors don't bleed past the arena edges
    const simMask = new Graphics();
    simMask.rect(0, 0, simWidth, simHeight).fill({ color: 0xffffff });
    simContainer.addChild(simMask);
    simContainer.mask = simMask;

    // ---- Control panel -----------------------------------------------------

    const controlsContainer = new Container();
    const sliderW = isPortrait
        ? Math.min(SLIDER_WIDTH, simWidth - PANEL_PADDING * 2)
        : SLIDER_WIDTH;
    if (isPortrait) {
        controlsContainer.position.set(PANEL_PADDING, simHeight + PANEL_PADDING);
    }
    else {
        controlsContainer.position.set(simWidth + PANEL_PADDING, PANEL_PADDING);
    }
    view.addChild(controlsContainer);

    const countSlider = createSliderView({
        getLabel: () => 'Boid Count',
        getMin: () => 1,
        getMax: () => 5000,
        getStep: () => 1,
        getValue: () => model.boidCount,
        getScaleMode: () => 'linear',
        getWidth: () => sliderW,
        onValueChanged: (v) => { model.boidCount = v; },
    });

    const separationSlider = createSliderView({
        getLabel: () => 'Separation',
        getMin: () => 0,
        getMax: () => 5,
        getStep: () => 0.1,
        getValue: () => model.separation,
        getScaleMode: () => 'linear',
        getWidth: () => sliderW,
        onValueChanged: (v) => { model.separation = v; },
    });

    const alignmentSlider = createSliderView({
        getLabel: () => 'Alignment',
        getMin: () => 0,
        getMax: () => 5,
        getStep: () => 0.1,
        getValue: () => model.alignment,
        getScaleMode: () => 'linear',
        getWidth: () => sliderW,
        onValueChanged: (v) => { model.alignment = v; },
    });

    const cohesionSlider = createSliderView({
        getLabel: () => 'Cohesion',
        getMin: () => 0,
        getMax: () => 5,
        getStep: () => 0.1,
        getValue: () => model.cohesion,
        getScaleMode: () => 'linear',
        getWidth: () => sliderW,
        onValueChanged: (v) => { model.cohesion = v; },
    });

    const wanderSlider = createSliderView({
        getLabel: () => 'Wander',
        getMin: () => 0,
        getMax: () => 10,
        getStep: () => 0.1,
        getValue: () => model.wander,
        getScaleMode: () => 'linear',
        getWidth: () => sliderW,
        onValueChanged: (v) => { model.wander = v; },
    });

    const perceptionSlider = createSliderView({
        getLabel: () => 'Perception',
        getMin: () => 0,
        getMax: () => 100,
        getStep: () => 1,
        getValue: () => perceptionToPercent(model.perceptionRadius, model.visionAngle),
        getScaleMode: () => 'linear',
        getWidth: () => sliderW,
        onValueChanged: (v) => {
            model.perceptionRadius = percentToRadius(v);
            model.visionAngle = percentToVision(v);
        },
    });

    const timeScaleSlider = createSliderView({
        getLabel: () => 'Time Scale',
        getMin: () => 0,
        getMax: () => 50,
        getStep: () => 0.01,
        getValue: getTimeScale,
        getScaleMode: () => 'log',
        getWidth: () => sliderW,
        onValueChanged: onTimeScaleChanged,
    });

    const influenceCheckbox = createCheckboxView({
        getLabel: () => 'Show Influences',
        getIsChecked: getIsShowingInfluences,
        onToggled: onShowInfluencesToggled,
    });

    // Layout controls vertically
    let yOffset = 0;
    const controls = [countSlider, separationSlider, alignmentSlider, cohesionSlider, wanderSlider, perceptionSlider, timeScaleSlider];
    for (let i = 0; i < controls.length; i++) {
        controls[i].position.set(0, yOffset);
        controlsContainer.addChild(controls[i]);
        yOffset += SLIDER_SPACING;
    }
    influenceCheckbox.position.set(0, yOffset);
    controlsContainer.addChild(influenceCheckbox);
    yOffset += PERFMON_GAP;

    const perfmon = createPerfmonView({ getFrameStats });
    perfmon.position.set(0, yOffset);
    controlsContainer.addChild(perfmon);

    // ---- Draw static background --------------------------------------------

    simBg.clear();
    simBg.rect(0, 0, simWidth, simHeight).fill({ color: 0x111122 });
    simBg.rect(0, 0, simWidth, simHeight).stroke({ color: 0x333355, width: 1 });

    view.onRefresh = refresh;
    return view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const pxPerMetre = simWidth / model.arenaWidth;
        const boids = model.boids;
        const count = boids.length;

        refreshBoids(pxPerMetre, boids, count);

        // Debug overlay - weighted acceleration vectors with arrowheads. Redrawn
        // every frame while shown; cleared once when hidden, since even an
        // empty clear() allocates.
        const isShowingInfluences = getIsShowingInfluences();
        if (isShowingInfluences || isDebugDrawn) debugGfx.clear();
        isDebugDrawn = isShowingInfluences;
        if (isShowingInfluences) {
            for (let i = 0; i < count; i++) {
                const b = boids[i];
                const px = b.position.x * pxPerMetre;
                const py = b.position.y * pxPerMetre;

                const s = pxPerMetre * ACCEL_VIS_SCALE;

                // Separation - red
                drawArrow(debugGfx, px, py, b.separationDx * s, b.separationDy * s, 0xff4444);
                // Alignment - green
                drawArrow(debugGfx, px, py, b.alignmentDx * s, b.alignmentDy * s, 0x44ff44);
                // Cohesion - blue
                drawArrow(debugGfx, px, py, b.cohesionDx * s, b.cohesionDy * s, 0x4488ff);

                // Combined resultant - white
                const rx = (b.separationDx + b.alignmentDx + b.cohesionDx) * s;
                const ry = (b.separationDy + b.alignmentDy + b.cohesionDy) * s;
                drawArrow(debugGfx, px, py, rx, ry, 0xffffff);
            }
        }
    }

    /** Positions and turns one pooled Graphics per boid. */
    function refreshBoids(pxPerMetre: number, boids: FlockModel['boids'], count: number): void {
        // Grow the pool to the flock size; boids beyond the flock are hidden.
        while (boidGfxs.length < count) {
            const g = new Graphics(boidContext);
            boidLayer.addChild(g);
            boidGfxs.push(g);
        }
        for (let i = 0; i < boidGfxs.length; i++) {
            const g = boidGfxs[i];
            const isInFlock = i < count;
            // Written only on a change: each flip makes Pixi rebuild the render group.
            if (g.visible !== isInFlock) g.visible = isInFlock;
            if (!isInFlock) continue;

            const b = boids[i];
            g.position.set(b.position.x * pxPerMetre, b.position.y * pxPerMetre);
            // Turned by skew rather than `rotation`: skew (-a, a) with no
            // rotation is the same matrix as rotation a. Writing `rotation`
            // here allocated 16 bytes per boid per frame, even when the value
            // was unchanged, so the cost was in the call itself: likely V8 not
            // inlining the setter and boxing its argument. `skew.set`, like
            // `position.set`, goes through an ObservablePoint and allocates
            // nothing.
            g.skew.set(-b.direction, b.direction);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BOID_SIZE = 5;

/** Visual scaling for weighted acceleration vectors (m/s^2 -> pixels). */
const ACCEL_VIS_SCALE = 0.5;
const MAX_ARROW_PX = 40;
const MIN_ARROW_PX = 2;
const ARROW_HEAD_SIZE = 6;
const ARROW_HALF_ANGLE = 0.5;

// Combined perception slider ranges
const PERC_RADIUS_MIN = 1;
const PERC_RADIUS_MAX = 30;
const PERC_VISION_MIN = Math.PI / 2;    // 90 degrees
const PERC_VISION_MAX = Math.PI * 2;    // 360 degrees

function percentToRadius(pct: number): number {
    return PERC_RADIUS_MIN + (pct / 100) * (PERC_RADIUS_MAX - PERC_RADIUS_MIN);
}

function percentToVision(pct: number): number {
    return PERC_VISION_MIN + (pct / 100) * (PERC_VISION_MAX - PERC_VISION_MIN);
}

function perceptionToPercent(radius: number, vision: number): number {
    // Average the two normalised values so the slider round-trips reasonably
    const rPct = (radius - PERC_RADIUS_MIN) / (PERC_RADIUS_MAX - PERC_RADIUS_MIN) * 100;
    const vPct = (vision - PERC_VISION_MIN) / (PERC_VISION_MAX - PERC_VISION_MIN) * 100;
    return Math.round((rPct + vPct) / 2);
}

/** A small directional triangle centred on the origin, pointing along +x. */
function drawBoidTriangle(g: GraphicsContext, size: number, color: number): void {
    const tipX = size * 1.5;
    const leftX = Math.cos(2.5) * size;
    const leftY = Math.sin(2.5) * size;
    const rightX = Math.cos(-2.5) * size;
    const rightY = Math.sin(-2.5) * size;

    g.moveTo(tipX, 0).lineTo(leftX, leftY).lineTo(rightX, rightY).closePath().fill({ color });
}

function drawArrow(g: Graphics, x: number, y: number, dx: number, dy: number, color: number): void {
    let len = Math.sqrt(dx * dx + dy * dy);
    if (len < MIN_ARROW_PX) return;

    // Cap length so vectors stay readable
    if (len > MAX_ARROW_PX) {
        const ratio = MAX_ARROW_PX / len;
        dx *= ratio;
        dy *= ratio;
        len = MAX_ARROW_PX;
    }

    const ex = x + dx;
    const ey = y + dy;

    // Shaft
    g.moveTo(x, y).lineTo(ex, ey).stroke({ color, width: 1.5, alpha: 0.7 });

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const hs = Math.min(len * 0.4, ARROW_HEAD_SIZE);
    const ax1 = ex - Math.cos(angle - ARROW_HALF_ANGLE) * hs;
    const ay1 = ey - Math.sin(angle - ARROW_HALF_ANGLE) * hs;
    const ax2 = ex - Math.cos(angle + ARROW_HALF_ANGLE) * hs;
    const ay2 = ey - Math.sin(angle + ARROW_HALF_ANGLE) * hs;

    g.moveTo(ex, ey).lineTo(ax1, ay1).lineTo(ax2, ay2).closePath().fill({ color, alpha: 0.7 });
}
