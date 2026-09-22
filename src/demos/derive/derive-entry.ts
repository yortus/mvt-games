import type { Container } from 'pixi.js';
import type { DemoEntry, DemoSession } from '../demo-entry';
import { createWorldModel } from './models';
import { createDeriveDemoView, type DeriveDemoLayout } from './views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create the demo entry descriptor for the derive structure-transforms demo. */
export function createDeriveEntry(): DemoEntry {
    return {
        id: 'derive',
        name: 'Derive - Structure Transforms',
        description:
            'One churning world model feeds three derived structures - a dense '
            + 'occupancy grid (sparse to dense reshape), an ordered list of active '
            + 'entities (filter and sort), and a per-kind histogram (aggregate). '
            + 'Each is built with the `derive` helper and recomputes only when its '
            + 'own change-triggers fire, shown live by per-panel recompute tallies.',
        techniques: [
            'Change-gated derivation (derive)',
            'Revision-counter triggers',
            'Sparse to dense reshape',
            'Filter + sort',
            'Aggregate / reduce',
            'Memoisation vs per-frame rendering',
        ],
        get screenWidth() { return computeLayout().screenWidth; },
        get screenHeight() { return computeLayout().screenHeight; },
        thumbnailAdvanceMs: 1500,

        start(stage: Container): DemoSession {
            const model = createWorldModel();
            let view = createDeriveDemoView({ model, layout: computeLayout() });
            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs);
                    view.update(deltaMs);
                },
                resize(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                    view = createDeriveDemoView({ model, layout: computeLayout() });
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

const MARGIN = 16;
const HEADER_HEIGHT = 46;
const CONTROLS_HEIGHT = 46;
const GRID_FRACTION = 0.55;
const ORDER_FRACTION = 0.62;

const NAV_HEIGHT = 48;
const CANVAS_MARGIN = 12;
const MIN_W = 360;
const MAX_W = 1040;
const MIN_H = 560;
const MAX_H = 720;
const DEFAULT_W = 940;
const DEFAULT_H = 660;

function computeLayout(): DeriveDemoLayout {
    const hasWindow = typeof window !== 'undefined';
    const screenWidth = hasWindow
        ? clamp(window.innerWidth - CANVAS_MARGIN * 2, MIN_W, MAX_W)
        : DEFAULT_W;
    const screenHeight = hasWindow
        ? clamp(window.innerHeight - NAV_HEIGHT - CANVAS_MARGIN * 2, MIN_H, MAX_H)
        : DEFAULT_H;

    const midY = MARGIN + HEADER_HEIGHT + MARGIN;
    const midW = screenWidth - MARGIN * 2;
    const midH = screenHeight - midY - CONTROLS_HEIGHT - MARGIN * 2;

    const gridW = Math.round(midW * GRID_FRACTION);
    const rightX = MARGIN + gridW + MARGIN;
    const rightW = screenWidth - MARGIN - rightX;
    const orderH = Math.round((midH - MARGIN) * ORDER_FRACTION);
    const histH = midH - MARGIN - orderH;

    return {
        screenWidth,
        screenHeight,
        header: { x: MARGIN, y: MARGIN, width: midW, height: HEADER_HEIGHT },
        grid: { x: MARGIN, y: midY, width: gridW, height: midH },
        order: { x: rightX, y: midY, width: rightW, height: orderH },
        histogram: { x: rightX, y: midY + orderH + MARGIN, width: rightW, height: histH },
        controls: { x: MARGIN, y: midY + midH + MARGIN, width: midW, height: CONTROLS_HEIGHT },
    };
}

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
