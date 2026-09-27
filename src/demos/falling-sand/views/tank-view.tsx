/** @jsxImportSource #pixi-jsx */

import { type Container, type FederatedPointerEvent, type Graphics, Point, Rectangle } from 'pixi.js';
import type { Grains } from '../models';
import { GrainPixelsView } from './grain-pixels-view';
import { GrainSpritesView } from './grain-sprites-view';
import { TANK_HEIGHT, TANK_WIDTH, TANK_X, TANK_Y } from './view-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * How the grains are drawn:
 *
 * - `'sprites'`: a sprite per grain, each with its own bindings.
 * - `'pixels'`: one texture with a pixel per cell, rewritten every frame.
 */
export type GrainsViewKind = 'sprites' | 'pixels';

export interface TankViewProps {
    /**
     * The tank's size in cells. Read once, when the view is built. The tank
     * is always drawn `TANK_WIDTH` x `TANK_HEIGHT` pixels, so more cells are
     * drawn smaller.
     */
    cols: number;
    rows: number;
    /** Every grain, addressed by id. */
    grains: () => Grains;
    /** Which view draws the grains. Read once, when the view is built. */
    grainsView: GrainsViewKind;
    /** How far through a flip the tank is, from 0 to 1. 0 when upright. */
    flipProgress: () => number;
    /** Whether the tank is flipping. The brush ring hides while it does. */
    isFlipping: () => boolean;
    /** Whether a pour is under way, so the brush ring shows even without hover (touch). */
    isPouring: () => boolean;
    /** Radius of the brush ring, in cells. */
    brushRadius: () => number;
    /** The pointer went down on the tank, at this point in cells. */
    onPressed?: (col: number, row: number) => void;
    /** The pointer moved, anywhere on the canvas, to this point in cells (possibly outside the tank). */
    onMoved?: (col: number, row: number) => void;
    /** The pointer went up, or the browser cancelled it. */
    onReleased?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The tank itself: its glass, its grains, and the pointer input over it.
 * Pointer gestures are relayed in cells, through the tank's rotation; what
 * they do is up to whoever handles them.
 *
 * The grains are drawn by one of two views, chosen by `grainsView` when the
 * tank view is built: a sprite per grain (`GrainSpritesView`), or one texture
 * with a pixel per cell (`GrainPixelsView`). Both draw in cells, inside a
 * container that scales cells to pixels, so neither knows the tank's size on
 * screen. Only the chosen one is built; changing it means building a new
 * tank view.
 *
 * During a flip the whole tank turns half a turn as `flipProgress` runs
 * from 0 to 1, easing in and out, and shrinking as it
 * turns so its corners stay inside its upright footprint.
 *
 * The tank is its own render group. Pixi rebuilds a render group's draw
 * batches whenever any text or graphics in it change, and the toolbar's
 * counts and timings change most frames; kept apart, they no longer force a
 * rebuild of every grain's batch. A render group's own transform is also
 * applied on the GPU, so turning the tank does not re-transform every grain.
 */
export function TankView(props: TankViewProps): Container {
    const width = TANK_WIDTH;
    const height = TANK_HEIGHT;
    // Pixels per cell, the same both ways: every tank size divides the tank's pixel size evenly.
    const cellSize = width / props.cols;

    // Presentation state: where the pointer is over the tank, in pixels, for the brush ring.
    let pointerX = 0;
    let pointerY = 0;
    let isPointerOver = false;

    let content: Container | undefined;
    const pointer = new Point();

    return (
        <container
            label="tank"
            isRenderGroup
            x={TANK_X + width / 2}
            y={TANK_Y + height / 2}
            rotation={getTankAngle}
            scale={() => scaleToFitRotated(width, height, getTankAngle())}
        >
            <container
                ref={(el) => { content = el; }}
                x={-width / 2}
                y={-height / 2}
                hitArea={new Rectangle(0, 0, width, height)}
                cursor="crosshair"
                onPointerDown={onPointerDown}
                onGlobalPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerUpOutside={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerOver={() => { isPointerOver = true; }}
                onPointerOut={() => { isPointerOver = false; }}
            >
                <graphics ref={(g) => drawWater(g, width, height)} />
                <container label="grains" scale={cellSize}>
                    {props.grainsView === 'sprites'
                        ? <GrainSpritesView grains={props.grains} />
                        : <GrainPixelsView cols={props.cols} rows={props.rows} grains={props.grains} />}
                </container>
                <graphics
                    visible={() => (isPointerOver || props.isPouring()) && !props.isFlipping()}
                    x={() => pointerX}
                    y={() => pointerY}
                    ref={setUpBrushRing}
                />
                <graphics ref={(g) => drawGlass(g, width, height)} />
            </container>
        </container>
    );

    /** Upright at 0, upside down at pi; slow to start and slow to land. */
    function getTankAngle(): number {
        const t = props.flipProgress();
        return Math.PI * t * t * (3 - 2 * t);
    }

    // --- Input --------------------------------------------------------------

    function onPointerDown(e: FederatedPointerEvent): void {
        trackPointer(e);
        props.onPressed?.(pointerX / cellSize, pointerY / cellSize);
    }

    function onPointerMove(e: FederatedPointerEvent): void {
        trackPointer(e);
        props.onMoved?.(pointerX / cellSize, pointerY / cellSize);
    }

    function onPointerUp(): void {
        props.onReleased?.();
    }

    /** Pointer position in the upright tank's pixels, through the tank's rotation and scale. */
    function trackPointer(e: FederatedPointerEvent): void {
        if (content === undefined) return;
        e.getLocalPosition(content, pointer);
        pointerX = pointer.x;
        pointerY = pointer.y;
    }

    // --- Brush ring ---------------------------------------------------------

    /** Redrawn only when the tool, and so the brush radius, changes. */
    function setUpBrushRing(g: Graphics): void {
        let drawnRadius = -1;
        const ownRefresh = g.onRefresh;
        g.onRefresh = () => {
            const result = ownRefresh?.();
            const radius = props.brushRadius() * cellSize;
            if (radius !== drawnRadius) {
                drawnRadius = radius;
                g.clear()
                    .circle(0, 0, radius)
                    .stroke({ color: 0xffffff, width: 1.5, alpha: 0.7 });
            }
            return result;
        };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The scale at which a `width` x `height` rectangle turned by `angle` fits
 * inside the same rectangle upright: 1 upright or upside down, less between.
 */
function scaleToFitRotated(width: number, height: number, angle: number): number {
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    return Math.min(width / (width * cos + height * sin), height / (width * sin + height * cos));
}

function drawWater(g: Graphics, width: number, height: number): void {
    g.rect(0, 0, width, height).fill(0x0f1b2d);
}

/** The frame, and a faint highlight down one side of the glass. */
function drawGlass(g: Graphics, width: number, height: number): void {
    g.rect(6, 6, 3, height - 12).fill({ color: 0xffffff, alpha: 0.06 });
    g.roundRect(-4, -4, width + 8, height + 8, 6).stroke({ color: 0x9fb4c8, width: 4, alpha: 0.9 });
}
