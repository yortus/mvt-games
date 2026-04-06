import { Container } from 'pixi.js';
import { createSequence, type StepDef, type StatefulPixiView, watch } from '#common';
import type { BoardPhase, CupcakeCell } from '../../models';
import { createBoardPiecesView } from './board-pieces-view';
import { createMatchEffectsView } from './match-effects-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    getPhase(): BoardPhase;
    getCells(): readonly Readonly<CupcakeCell>[];
    getSwapPos1(): { col: number; row: number };
    getSwapPos2(): { col: number; row: number };
    getSwapProgress(): number;
    getSettleOrigins(): readonly number[];
    getSettleProgress(): number;
    getMatchedIndices(): readonly number[];
    getCascadeStep(): number;
    onSwapRequested(origin: { col: number; row: number }, target: { col: number; row: number }): boolean;
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

    const pieces = createBoardPiecesView({
        getPhase: bindings.getPhase,
        getCells: bindings.getCells,
        getSwapPos1: bindings.getSwapPos1,
        getSwapPos2: bindings.getSwapPos2,
        getSwapProgress: bindings.getSwapProgress,
        getSettleOrigins: bindings.getSettleOrigins,
        getSettleProgress: bindings.getSettleProgress,
        getMatchedIndices: bindings.getMatchedIndices,
        getCascadeStep: bindings.getCascadeStep,
        getMatchSequence: () => matchSequence,
        onSwapRequested: bindings.onSwapRequested,
    });

    const effects = createMatchEffectsView({
        getCells: bindings.getCells,
        getMatchedIndices: bindings.getMatchedIndices,
        getCascadeStep: bindings.getCascadeStep,
        getMatchSequence: () => matchSequence,
    });

    const view = new Container();
    view.addChild(pieces);
    view.addChild(effects);

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
