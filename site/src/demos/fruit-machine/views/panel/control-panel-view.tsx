/** @jsxImportSource @mvtjs/html/jsx */
import { memoiseLast } from '@mvtjs/utils';
import { PAYTABLE, ROW_COUNT } from '../../data';
import type { FruitMachineModel, MachinePhase } from '../../models';
import { SYMBOL_NAMES, type SymbolArt } from '../art';
import { createLitCells, formatCredits } from '../shared';
import { PaytableView } from './paytable-view';
import { ReelsTableView } from './reels-table-view';
import { WindowGridView } from './window-grid-view';
import { WinsListView } from './wins-list-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ControlPanelViewBindings {
    readonly model: FruitMachineModel;
    readonly art: SymbolArt;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The machine as an inspector would see it: every number the model holds,
 * its guards as lights, and plain Spin and Stop buttons that the guards
 * enable. Nothing here is eased or animated: the model, as it is, each frame.
 */
export function ControlPanelView(bindings: ControlPanelViewBindings): Element {
    const { model, art } = bindings;
    const { reels, celebration } = model;
    const litCells = createLitCells({ celebration });
    const balanceText = memoiseLast(formatCredits);
    const lastWinText = memoiseLast(formatCredits);
    const spinCountText = memoiseLast((count: number) => String(count));
    const betText = formatCredits(model.bet);
    // The result is decided as a spin starts, so it changes only with the spin count
    const peekText = memoiseLast(describeResult);
    const nameFor = (kind: keyof typeof SYMBOL_NAMES) => SYMBOL_NAMES[kind];

    return (
        <section class="panel" aria-label="Control panel">
            <div class="panel-meters">
                <MeterView label="Balance" value={() => balanceText(model.balance)} />
                <MeterView label="Bet" value={() => betText} />
                <MeterView label="Last win" value={() => lastWinText(model.lastWin)} />
                <MeterView label="Spins" value={() => spinCountText(model.spinCount)} />
            </div>
            <div class="panel-status">
                <span class={() => PHASE_CLASSES[model.phase]} text={() => model.phase} />
                <FlagView name="canSpin" isOn={() => model.canSpin} />
                <FlagView name="canStop" isOn={() => model.canStop} />
                <FlagView name="isStopping" isOn={() => model.isStopping} />
            </div>
            <div class="panel-actions">
                <button type="button" class="panel-spin" text="Spin" disabled={() => !model.canSpin} onClick={spin} />
                <button type="button" class="panel-stop" text="Stop" disabled={() => !model.canStop} onClick={stop} />
                <span
                    class="panel-game-over"
                    visible={() => model.phase === 'gameOver'}
                    text="Out of credits: game over. Reload to play again."
                />
            </div>
            <div class="panel-columns">
                <ReelsTableView
                    reelCount={reels.length}
                    phaseAt={(reel) => reels[reel].phase}
                    positionAt={(reel) => reels[reel].position}
                    stopIndexAt={(reel) => reels[reel].stopIndex}
                    progressAt={(reel) => reels[reel].progress}
                />
                <WindowGridView
                    reelCount={reels.length}
                    rowCount={ROW_COUNT}
                    symbolAt={(reel, row) => reels[reel].symbolAt(Math.round(reels[reel].position) + row)}
                    isLitAt={litCells.isLitAt}
                    urlFor={art.urlFor}
                    nameFor={nameFor}
                />
            </div>
            <details class="panel-peek" visible={() => model.phase === 'spinning'}>
                <summary text="Peek: the result, decided as the spin started" />
                <p text={() => peekText(model.spinCount)} />
            </details>
            <div visible={() => model.phase !== 'spinning' && model.lastWin > 0}>
                <WinsListView
                    wins={() => model.outcome?.wins ?? NO_WINS}
                    currentWin={() => celebration.win}
                    totalWin={() => model.lastWin}
                    urlFor={art.urlFor}
                    nameFor={nameFor}
                />
            </div>
            <details class="panel-paytable">
                <summary text="Paytable" />
                <PaytableView paytable={PAYTABLE} urlFor={art.urlFor} nameFor={nameFor} />
            </details>
        </section>
    );

    function spin(): void {
        if (model.canSpin) void model.spin();
    }

    function stop(): void {
        if (model.canStop) model.stop();
    }

    function describeResult(_spinCount: number): string {
        const outcome = model.outcome;
        if (outcome === undefined) return '';
        const stops = outcome.stops.join(', ');
        const won = outcome.totalWin === 0 ? 'no win' : `${formatCredits(outcome.totalWin)} credits, ${outcome.wins.length} ways`;
        return `Stops ${stops}: ${won}.`;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_WINS: readonly [] = [];

const PHASE_CLASSES: { readonly [P in MachinePhase]: string } = {
    idle: 'phase phase-idle',
    spinning: 'phase phase-spinning',
    celebrating: 'phase phase-celebrating',
    gameOver: 'phase phase-game-over',
};

interface MeterViewBindings {
    readonly label: string;
    readonly value: () => string;
}

function MeterView(bindings: MeterViewBindings): Element {
    return (
        <div class="meter">
            <span class="meter-label" text={bindings.label} />
            <span class="meter-value" text={bindings.value} />
        </div>
    );
}

interface FlagViewBindings {
    /** The model property it shows, as written in code. */
    readonly name: string;
    readonly isOn: () => boolean;
}

/** A guard or flag as a light: lit while it is true. */
function FlagView(bindings: FlagViewBindings): Element {
    return <code class={() => (bindings.isOn() ? 'flag on' : 'flag')} text={bindings.name} />;
}
