/** @jsxImportSource @mvtjs/three */
import type { Object3D } from 'three';
import { ROW_COUNT } from '../../data';
import type { FruitMachineModel } from '../../models';
import type { SymbolArt } from '../art';
import { createLitCells, easeClunk, shownReelPosition } from '../shared';
import { DRAG_THRESHOLD_PX } from './bandit-layout';
import { CabinetBodyView } from './cabinet-body-view';
import { CellFramesView } from './cell-frames-view';
import { CreditDisplayView } from './credit-display-view';
import { LeverView } from './lever-view';
import { ReelDrumsView } from './reel-drums-view';
import { createMaterialKit } from './material-kit';
import { TopBoxView } from './top-box-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BanditViewBindings {
    readonly model: FruitMachineModel;
    readonly art: SymbolArt;
    /** The element the scene is drawn in: dragging across it turns the cabinet. */
    readonly dragSurface: HTMLElement;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An old one-armed bandit, in three.js: drums behind a window, a lever, a
 * lamp on top. Its drums land with a heavy clunk, eased here from the same
 * linear settle the Pixi view eases into a bounce. It sways gently on its own,
 * and turns all the way round when dragged; both are this view's own
 * presentation state. Tapping the lever spins, stops, or skips the
 * celebration and spins again.
 */
export function BanditView(bindings: BanditViewBindings): Object3D {
    const { model, art, dragSurface } = bindings;
    const { reels, celebration } = model;
    const kit = createMaterialKit();
    const litCells = createLitCells({ celebration });
    const strips = reels.map((reel) => reel.strip);

    // Presentation state: the sway's clock, and how far dragging has turned the cabinet
    let swayMs = 0;
    let dragYaw = 0;
    let drag: Drag | undefined;
    /** True once the current press has moved far enough to turn the cabinet. */
    let isTurning = false;
    let isLeverHovered = false;
    let shownCursor = '';

    dragSurface.addEventListener('pointerdown', onPointerDown);
    dragSurface.addEventListener('pointermove', onPointerMove);
    dragSurface.addEventListener('pointerup', onPointerUp);
    dragSurface.addEventListener('pointercancel', onPointerUp);

    return (
        <group onUpdate={(deltaMs) => { swayMs += deltaMs; }} onRefresh={refreshCursor} onDestroyed={release}>
            {/* The shine comes from the scene's environment map; these add a key light and shadowed sides */}
            <ambientLight intensity={0.25} />
            <directionalLight x={5} y={9} z={8} intensity={1.6} />
            <group rotationY={() => SWAY_ANGLE * Math.sin(swayMs * SWAY_RADIANS_PER_MS) + dragYaw}>
                <CabinetBodyView kit={kit} canvasFor={art.canvasFor} />
                <ReelDrumsView
                    kit={kit}
                    strips={strips}
                    canvasFor={art.canvasFor}
                    positionAt={(reel) => shownReelPosition(reels[reel], easeClunk)}
                />
                <CellFramesView
                    kit={kit}
                    symbolsPerDrum={strips[1].length}
                    rowCount={ROW_COUNT}
                    isLitAt={litCells.isLitAt}
                    progress={() => celebration.progress}
                />
                <CreditDisplayView kit={kit} balance={() => model.balance} win={() => model.lastWin} y={1.95} />
                <TopBoxView kit={kit} isGameOver={() => model.phase === 'gameOver'} lampGlow={lampGlow} />
                <LeverView
                    kit={kit}
                    spinCount={() => model.spinCount}
                    onPulled={pullLever}
                    onHoverChanged={(isHovered) => { isLeverHovered = isHovered; }}
                />
            </group>
        </group>
    );

    /**
     * A tap: the picker sends no click at the end of a drag. Skipping a
     * celebration spins again; stopping a spin leaves nothing to spin until
     * the reels land.
     */
    function pullLever(): void {
        if (model.canStop) model.stop();
        if (model.canSpin) void model.spin();
    }

    /** Flashes through a celebration, glows steadily once the game is over, and is dark otherwise. */
    function lampGlow(): number {
        switch (model.phase) {
            case 'celebrating': return (celebration.progress * 4) % 1 < 0.5 ? 1 : 0.1;
            case 'gameOver': return 0.6;
            case 'spinning': return 0.25;
            default: return 0;
        }
    }

    function refreshCursor(): void {
        const cursor = drag !== undefined ? 'grabbing' : isLeverHovered && model.phase !== 'gameOver' ? 'pointer' : 'grab';
        if (cursor === shownCursor) return;
        shownCursor = cursor;
        dragSurface.style.cursor = cursor;
    }

    function onPointerDown(event: PointerEvent): void {
        drag = { pointerId: event.pointerId, startX: event.clientX, startYaw: dragYaw };
        isTurning = false;
        dragSurface.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent): void {
        if (drag === undefined || event.pointerId !== drag.pointerId) return;
        const dx = event.clientX - drag.startX;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX) isTurning = true;
        if (isTurning) dragYaw = drag.startYaw + dx * DRAG_RADIANS_PER_PX;
    }

    function onPointerUp(event: PointerEvent): void {
        if (drag === undefined || event.pointerId !== drag.pointerId) return;
        drag = undefined;
    }

    function release(): void {
        dragSurface.removeEventListener('pointerdown', onPointerDown);
        dragSurface.removeEventListener('pointermove', onPointerMove);
        dragSurface.removeEventListener('pointerup', onPointerUp);
        dragSurface.removeEventListener('pointercancel', onPointerUp);
        kit.release();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Drag {
    readonly pointerId: number;
    readonly startX: number;
    readonly startYaw: number;
}

/** About seven and a half degrees either way, once every eight seconds. */
const SWAY_ANGLE = 0.13;
const SWAY_RADIANS_PER_MS = (Math.PI * 2) / 8000;
const DRAG_RADIANS_PER_PX = 0.012;
