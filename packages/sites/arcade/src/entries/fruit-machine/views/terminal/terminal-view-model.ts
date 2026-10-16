import { watch } from '@mvtjs/utils';
import { PAYTABLE, ROW_COUNT, type SymbolKind } from '../../data';
import type { FruitMachineModel } from '../../models';
import { SYMBOL_LABELS } from '../art';
import { createLitCells, formatCredits, formatRows } from '../shared';
import { drawBanner, drawPaytable, drawWindowBox } from './ascii-art';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The terminal's logic, apart from the DOM: the commands, the transcript and
 * the live picture of the reels. It runs commands against the model, and
 * logs what the model does, whichever view made it happen.
 *
 * Its own state (the transcript, the command history, whether a command is
 * running) is the terminal's, not the machine's; nothing else needs it.
 */
export interface TerminalViewModel {
    /** Everything printed so far, oldest first, as one string. The same string until something is printed. */
    readonly transcript: string;
    /** The reels as text while a spin or celebration runs; empty otherwise. */
    readonly liveText: string;
    /** True while a command this terminal ran is still going: the prompt waits for it. */
    readonly isBusy: boolean;

    /** Run a line the user typed. An empty line repeats the last command. */
    submit: (line: string) => void;
    /** Ctrl+C: stop the machine if it can be stopped. */
    interrupt: () => void;
    /** The command `step` places back (-1) or forward (+1) in the history, from where recall last left off. */
    recall: (step: -1 | 1) => string;
    /** Log what changed in the model since the last update. */
    update: (deltaMs: number) => void;
}

export interface TerminalViewModelOptions {
    readonly model: FruitMachineModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTerminalViewModel(options: TerminalViewModelOptions): TerminalViewModel {
    const { model } = options;
    const { reels, celebration } = model;
    const litCells = createLitCells({ celebration });
    const watcher = watch({
        spinCount: () => model.spinCount,
        phase: () => model.phase,
        isStopping: () => model.isStopping,
        step: () => celebration.stepIndex,
    });

    const lines: string[] = [];
    let transcript = '';
    let isTranscriptStale = false;
    const history: string[] = [];
    let recallIndex = 0;
    let isBusy = false;
    /** The spin count of the last spin this terminal started, to tell its spins from other views'. */
    let ownSpinCount = -1;

    let liveKey = -1;
    let liveText = '';

    print(drawBanner());
    print('Type help for commands. Enter on an empty line repeats the last one.');
    // Start the watcher from the model as it is, so the first update logs only changes
    watcher.poll();

    const viewModel: TerminalViewModel = {
        get transcript() {
            if (isTranscriptStale) {
                transcript = lines.join('\n');
                isTranscriptStale = false;
            }
            return transcript;
        },
        get liveText() {
            if (model.phase !== 'spinning' && model.phase !== 'celebrating') return '';
            const key = liveKeyNow();
            if (key !== liveKey) {
                liveKey = key;
                liveText = drawWindowBox({ reelCount: reels.length, rowCount: ROW_COUNT, symbolAt: shownSymbolAt, isLitAt: litCells.isLitAt });
            }
            return liveText;
        },
        get isBusy() { return isBusy; },

        submit(line) {
            let command = line.trim().toLowerCase();
            if (command === '') command = history[history.length - 1] ?? '';
            if (command === '') return;
            print(`${isBusy ? '' : '> '}${command}`);
            if (history[history.length - 1] !== command) history.push(command);
            recallIndex = history.length;
            if (isBusy && command !== 'stop') {
                print('A spin is running. Type stop, or press Ctrl+C.');
                return;
            }
            run(command);
        },

        interrupt() {
            print('^C');
            if (model.canStop) model.stop();
        },

        recall(step) {
            recallIndex = Math.max(0, Math.min(history.length, recallIndex + step));
            return history[recallIndex] ?? '';
        },

        update(_deltaMs) {
            const changes = watcher.poll();
            if (changes.spinCount.changed) logSpinStart();
            if (changes.isStopping.changed && changes.isStopping.value) print('Stopping...');
            if (changes.phase.changed) {
                const { previous, value } = changes.phase;
                if (previous === 'spinning') logLanding();
                // The last step's index is the number of ways: anything less was cut short
                if (previous === 'celebrating') print(changes.step.previous === model.outcome!.wins.length ? 'Celebration over.' : 'Celebration skipped.');
                if (value === 'gameOver') print('Out of credits. GAME OVER. Reload the page to play again.');
            }
            if (changes.step.changed && celebration.win !== undefined) logWay();
        },
    };

    return viewModel;

    // --- Commands -------------------------------------------------------

    function run(command: string): void {
        switch (command) {
            case 'help':
                print([
                    'Commands:',
                    '  spin       spin the reels (or press Enter again)',
                    '  stop       land the reels now, or skip the celebration (Ctrl+C too)',
                    '  balance    show your credits',
                    '  paytable   show what each fruit pays',
                    '  clear      clear the screen',
                ].join('\n'));
                return;
            case 'spin':
                spin();
                return;
            case 'stop':
                if (model.canStop) model.stop();
                else print('Nothing to stop.');
                return;
            case 'balance':
                print(`Balance ${formatCredits(model.balance)} credits: ${Math.floor(model.balance / model.bet)} spins at ${model.bet}.`);
                return;
            case 'paytable':
                print(drawPaytable(PAYTABLE));
                return;
            case 'clear':
                lines.length = 0;
                isTranscriptStale = true;
                return;
            default:
                print(`Unknown command: ${command}. Type help.`);
        }
    }

    function spin(): void {
        if (!model.canSpin) {
            print(whyNotSpin());
            return;
        }
        isBusy = true;
        // The spin's promise resolves once the machine is idle: then the prompt comes back
        void model.spin().then(() => {
            isBusy = false;
        });
        ownSpinCount = model.spinCount;
    }

    function whyNotSpin(): string {
        switch (model.phase) {
            case 'spinning': return "Can't spin: the reels are turning. Type stop.";
            case 'celebrating': return "Can't spin: still celebrating. Type stop to skip it.";
            case 'gameOver': return "Can't spin: out of credits. Game over.";
            default: return "Can't spin.";
        }
    }

    // --- Logging what the model did ------------------------------------

    function logSpinStart(): void {
        const where = model.spinCount === ownSpinCount ? '' : ' (from another view)';
        print(`Spin ${model.spinCount}${where}: bet ${model.bet}, balance ${formatCredits(model.balance)}.`);
    }

    function logLanding(): void {
        const outcome = model.outcome!;
        print(drawWindowBox({
            reelCount: reels.length,
            rowCount: ROW_COUNT,
            symbolAt: (reel, row) => outcome.window[reel][row],
            isLitAt: () => false,
        }));
        if (outcome.totalWin === 0) {
            print('No win.');
        }
        else {
            const ways = outcome.wins.length === 1 ? '1 way' : `${outcome.wins.length} ways`;
            print(`WIN ${formatCredits(outcome.totalWin)} credits on ${ways}. Balance ${formatCredits(model.balance)}.`);
        }
    }

    function logWay(): void {
        const win = celebration.win!;
        const label = SYMBOL_LABELS[win.symbol].trim();
        print(`  ${label} x${win.rows.length}   rows ${formatRows(win.rows)}   +${formatCredits(win.payout)}`);
    }

    // --- Helpers --------------------------------------------------------

    function print(text: string): void {
        lines.push(text);
        if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
        isTranscriptStale = true;
    }

    /** The reels snap to whole positions: a terminal can't draw half a symbol. */
    function shownSymbolAt(reel: number, row: number): SymbolKind {
        return reels[reel].symbolAt(Math.round(reels[reel].position) + row);
    }

    /** Changes exactly when the live text would: each reel's whole position, and the lit cells. */
    function liveKeyNow(): number {
        let key = 0;
        for (let reel = 0; reel < reels.length; reel++) key = key * 64 + Math.round(reels[reel].position) % 64;
        let lit = 0;
        for (let reel = 0; reel < reels.length; reel++) {
            for (let row = 0; row < ROW_COUNT; row++) lit = lit * 2 + (litCells.isLitAt(reel, row) ? 1 : 0);
        }
        return key * 32768 + lit;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Transcript entries kept; older ones scroll away for good. */
const MAX_LINES = 200;
