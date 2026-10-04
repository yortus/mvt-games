import { Container } from 'pixi.js';
import { createSequence, type DeepReadonly, watch } from '@mvtjs/utils';
import type { BoardPhase, CactusCell } from '../../models';
import { BackgroundView } from './background-view';
import { BannerView } from './banner-view';
import { FireworkView } from './firework-view';
import { FlashOverlayView } from './flash-overlay-view';
import { MatchEffectsView } from './match-effects-view';
import { MATCH_EFFECT_STEPS } from './match-sequence-defs';
import { PiecesView } from './pieces-view';
import { ShakeContainerView } from './shake-container-view';
import { setUpdate } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    phase: () => BoardPhase;
    cells: () => DeepReadonly<CactusCell[][]>;
    swapCell1: () => CactusCell | undefined;
    swapCell2: () => CactusCell | undefined;
    swapProgress: () => number;
    settleProgress: () => number;
    settleOriginRows: () => DeepReadonly<number[][]>;
    matchedCells: () => readonly CactusCell[];
    cascadeStep: () => number;
    onSwapRequested?: (origin: CactusCell, target: CactusCell) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function BoardView(bindings: BoardViewBindings): Container {
    // The match sequence is shared presentation state. It is created here and
    // distributed as structural subsets via bindings to the child layers that
    // need it. No child holds a reference to another child.
    const matchSequence = createSequence(MATCH_EFFECT_STEPS);
    const phaseWatcher = watch({ phase: bindings.phase });

    // Shake container wraps background and pieces so they displace together.
    const shakeContainer = ShakeContainerView({
        matchSequence,
        cascadeStep: bindings.cascadeStep,
    });

    const background = BackgroundView();

    const pieces = PiecesView({
        phase: bindings.phase,
        cells: bindings.cells,
        swapCell1: bindings.swapCell1,
        swapCell2: bindings.swapCell2,
        swapProgress: bindings.swapProgress,
        settleProgress: bindings.settleProgress,
        settleOriginRows: bindings.settleOriginRows,
        matchedCells: bindings.matchedCells,
        matchSequence: () => matchSequence,
        onSwapRequested: bindings.onSwapRequested,
    });

    const flashOverlay = FlashOverlayView({
        matchSequence,
        cascadeStep: bindings.cascadeStep,
    });

    const matchEffects = MatchEffectsView({
        matchedCells: bindings.matchedCells,
        cascadeStep: bindings.cascadeStep,
        matchSequence,
    });

    const fireworks = FireworkView({
        matchedCells: bindings.matchedCells,
        matchSequence,
        cascadeStep: bindings.cascadeStep,
    });

    const banner = BannerView({
        matchSequence,
        cascadeStep: bindings.cascadeStep,
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

    // Runs before the child views' own update and refresh, so every layer sees
    // this frame's match sequence.
    setUpdate(view, update);
    return view;

    function update(deltaMs: number): void {
        const { phase } = phaseWatcher.poll();
        if (phase.changed && phase.value === 'matching') matchSequence.start();
        matchSequence.update(deltaMs);
    }
}
