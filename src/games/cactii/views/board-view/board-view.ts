import { Container } from 'pixi.js';
import { createSequence, type StepDef, type StatefulPixiView, watch, type DeepReadonly } from '#common';
import type { BoardPhase, CactusCell } from '../../models';
import { createBackgroundView } from './background-view';
import { createMatchEffectsView } from './match-effects-view';
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
    onSwapRequested(origin: CactusCell, target: CactusCell): boolean;
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

    const matchEffects = createMatchEffectsView({
        getMatchedCells: bindings.getMatchedCells,
        getCascadeStep: bindings.getCascadeStep,
        getMatchSequence: () => matchSequence,
    });

    const view = new Container();
    view.addChild(shakeContainer);
    shakeContainer.content.addChild(background, pieces);
    view.addChild(matchEffects); // Match effects sit outside the shake container (dust/popup don't shake).

    return Object.assign(view, {
        update(deltaMs: number): void {
            const { phase } = phaseWatcher.poll();
            if (phase.changed && phase.value === 'matching') matchSequence.start();
            matchSequence.update(deltaMs);
            pieces.update(deltaMs);
        },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Overlapping effect steps that play during a match sequence.
 *
 * ```
 * Time (ms):  0        100       200       250       350       500
 *             |---------|---------|---------|---------|---------|-----|
 *  fade:      [=====================]                              0-250ms
 *  shake:        [=================]                               50-250ms
 *  dust:            [==========================]                   100-350ms
 *  popup:               [================================]         150-500ms
 * ```
 */
const MATCH_EFFECT_STEPS = [
    { name: 'fade',  startMs: 0,   durationMs: 250 },
    { name: 'shake', startMs: 50,  durationMs: 200 },
    { name: 'dust',  startMs: 100, durationMs: 250 },
    { name: 'popup', startMs: 150, durationMs: 350 },
] as const satisfies readonly StepDef[];
