import { Container } from 'pixi.js';
import { createSequence, type StatefulPixiView, watch, type DeepReadonly } from '#common';
import type { BoardPhase, CactusCell } from '../../models';
import { createBackgroundView } from './background-view';
import { createBannerView } from './banner-view';
import { createFireworkView } from './firework-view';
import { createFlashOverlayView } from './flash-overlay-view';
import { createMatchEffectsView } from './match-effects-view';
import { MATCH_EFFECT_STEPS } from './match-sequence-defs';
import { createPiecesView } from './pieces-view';
import { createShakeContainerView } from './shake-container-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    getPhase(): BoardPhase;
    getCells(): DeepReadonly<CactusCell[][]>;
    getSwapCell1(): CactusCell | undefined;
    getSwapCell2(): CactusCell | undefined;
    getSwapProgress(): number;
    getSettleProgress(): number;
    getSettleOriginRows(): DeepReadonly<number[][]>;
    getMatchedCells(): readonly CactusCell[];
    getCascadeStep(): number;
    onSwapRequested?(origin: CactusCell, target: CactusCell): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardView(bindings: BoardViewBindings): StatefulPixiView {
    // The match sequence is shared presentation state. It is created here and
    // distributed as structural subsets via bindings to the child layers that
    // need it. No child holds a reference to another child.
    const matchSequence = createSequence(MATCH_EFFECT_STEPS);
    const phaseWatcher = watch({ phase: bindings.getPhase });

    // Shake container wraps background and pieces so they displace together.
    const shakeContainer = createShakeContainerView({
        getMatchSequence: () => matchSequence,
        getCascadeStep: bindings.getCascadeStep,
    });

    const background = createBackgroundView();

    const pieces = createPiecesView({
        getPhase: bindings.getPhase,
        getCells: bindings.getCells,
        getSwapCell1: bindings.getSwapCell1,
        getSwapCell2: bindings.getSwapCell2,
        getSwapProgress: bindings.getSwapProgress,
        getSettleProgress: bindings.getSettleProgress,
        getSettleOriginRows: bindings.getSettleOriginRows,
        getMatchedCells: bindings.getMatchedCells,
        getMatchSequence: () => matchSequence,
        onSwapRequested: bindings.onSwapRequested,
    });

    const flashOverlay = createFlashOverlayView({
        getMatchSequence: () => matchSequence,
        getCascadeStep: bindings.getCascadeStep,
    });

    const matchEffects = createMatchEffectsView({
        getMatchedCells: bindings.getMatchedCells,
        getCascadeStep: bindings.getCascadeStep,
        getMatchSequence: () => matchSequence,
    });

    const fireworks = createFireworkView({
        getMatchedCells: bindings.getMatchedCells,
        getMatchSequence: () => matchSequence,
        getCascadeStep: bindings.getCascadeStep,
    });

    const banner = createBannerView({
        getMatchSequence: () => matchSequence,
        getCascadeStep: bindings.getCascadeStep,
    });

    const view = new Container();
    view.addChild(shakeContainer);
    shakeContainer.content.addChild(background, pieces);
    // Effects sit outside the shake container (they don't displace with the board).
    // Add order determines z-order: flash < dust/stars/popup < fireworks < banner.
    view.addChild(flashOverlay);
    view.addChild(matchEffects);
    view.addChild(fireworks);
    view.addChild(banner);

    return Object.assign(view, {
        update(deltaMs: number): void {
            const { phase } = phaseWatcher.poll();
            if (phase.changed && phase.value === 'matching') matchSequence.start();
            matchSequence.update(deltaMs);
            pieces.update(deltaMs);
        },
    });
}
