import { describe, expect, it } from 'vitest';
import {
    BET, CELEBRATION_OPENER_MS, CELEBRATION_STEP_MS, FIRST_SETTLE_MS, PAYTABLE, SETTLE_MS, SETTLE_STAGGER_MS, STARTING_BALANCE,
    type SymbolKind,
} from '../../data';
import { createFruitMachineModel, type FruitMachineModel, type FruitMachineModelOptions } from '../../models';
import { formatCredits } from '../shared';
import { createTerminalViewModel, type TerminalViewModel } from './terminal-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANDED_MS = FIRST_SETTLE_MS + 4 * SETTLE_STAGGER_MS + SETTLE_MS;

/** Three-symbol strips always show the whole strip: every spin wins one way, melon on the first three reels. */
const ONE_WAY_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic2', 'pic3', 'pic4'],
    ['pic5', 'pic6', 'pic2'],
];

/** Strips that never win. */
const LOSING_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
];

interface Setup {
    readonly model: FruitMachineModel;
    readonly terminal: TerminalViewModel;
    /** Advance the model and the terminal together, as the page does. */
    readonly advance: (totalMs: number) => void;
}

function setup(options: FruitMachineModelOptions = {}): Setup {
    const model = createFruitMachineModel({ seed: 3, ...options });
    const terminal = createTerminalViewModel({ model });
    const advance = (totalMs: number): void => {
        for (let elapsed = 0; elapsed < totalMs; elapsed += 10) {
            model.update(10);
            terminal.update(10);
        }
    };
    return { model, terminal, advance };
}

async function flushPromises(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('terminal view model', () => {
    it('greets the user with a banner and a hint', () => {
        const { terminal } = setup();

        expect(terminal.transcript).toContain('F R U I T   M A C H I N E');
        expect(terminal.transcript).toContain('Type help');
        expect(terminal.isBusy).toBe(false);
    });

    it('keeps the same transcript string until something is printed', () => {
        const { terminal, advance } = setup();
        const before = terminal.transcript;

        advance(100);

        expect(terminal.transcript).toBe(before);
    });

    it('lists its commands', () => {
        const { terminal } = setup();

        terminal.submit('help');

        for (const command of ['spin', 'stop', 'balance', 'paytable', 'clear']) expect(terminal.transcript).toContain(command);
    });

    it('says when it does not know a command', () => {
        const { terminal } = setup();

        terminal.submit('jackpot');

        expect(terminal.transcript).toContain('Unknown command: jackpot');
    });

    it('shows the balance, and the paytable', () => {
        const { terminal } = setup();

        terminal.submit('balance');
        terminal.submit('paytable');

        const spins = Math.floor(STARTING_BALANCE / BET);
        expect(terminal.transcript).toContain(`Balance ${formatCredits(STARTING_BALANCE)} credits: ${spins} spins at ${BET}.`);
        expect(terminal.transcript).toContain('Pays per way');
    });

    it('clears the screen', () => {
        const { terminal } = setup();

        terminal.submit('clear');

        expect(terminal.transcript).toBe('');
    });

    describe('spinning', () => {
        it('spins, holding the prompt until the spin resolves', async () => {
            const { model, terminal, advance } = setup({ strips: LOSING_STRIPS });

            terminal.submit('spin');
            expect(model.phase).toBe('spinning');
            expect(terminal.isBusy).toBe(true);

            advance(LANDED_MS);
            await flushPromises();
            expect(terminal.isBusy).toBe(false);
        });

        it('logs the spin, the window it lands on, and the result', () => {
            const { terminal, advance } = setup({ strips: LOSING_STRIPS });

            terminal.submit('spin');
            advance(LANDED_MS);

            expect(terminal.transcript).toContain('> spin');
            expect(terminal.transcript).toContain(`Spin 1: bet ${BET}, balance ${formatCredits(STARTING_BALANCE - BET)}.`);
            expect(terminal.transcript).toContain('+--------+');
            expect(terminal.transcript).toContain('No win.');
        });

        it('logs each winning way as it is celebrated', () => {
            const { terminal, advance } = setup({ strips: ONE_WAY_STRIPS });

            terminal.submit('spin');
            advance(LANDED_MS + CELEBRATION_OPENER_MS + CELEBRATION_STEP_MS);

            const payout = formatCredits(PAYTABLE.pic1[3]);
            expect(terminal.transcript).toContain(`WIN ${payout} credits on 1 way.`);
            expect(terminal.transcript).toMatch(new RegExp(`MELON x3 {3}rows \\d-\\d-\\d {3}\\+${payout}`));
            expect(terminal.transcript).toContain('Celebration over.');
        });

        it('repeats the last command on an empty line', async () => {
            const { model, terminal, advance } = setup({ strips: LOSING_STRIPS });
            terminal.submit('spin');
            advance(LANDED_MS);
            await flushPromises();

            terminal.submit('');

            expect(model.spinCount).toBe(2);
        });

        it('says why it cannot spin', () => {
            const { model, terminal } = setup();
            void model.spin();

            terminal.submit('stop');
            terminal.submit('spin');

            expect(terminal.transcript).toContain("Can't spin: the reels are turning.");
        });

        it('logs spins started from another view as such', () => {
            const { model, terminal, advance } = setup();

            void model.spin();
            advance(10);

            expect(terminal.transcript).toContain('Spin 1 (from another view)');
        });

        it('draws the turning reels live, and nothing once the machine is idle', () => {
            const { terminal, advance } = setup({ strips: LOSING_STRIPS });
            expect(terminal.liveText).toBe('');

            terminal.submit('spin');
            advance(100);
            expect(terminal.liveText).toContain('+--------+');

            advance(LANDED_MS);
            expect(terminal.liveText).toBe('');
        });
    });

    describe('stopping', () => {
        it('stops a spin on Ctrl+C', () => {
            const { model, terminal } = setup();
            terminal.submit('spin');

            terminal.interrupt();

            expect(terminal.transcript).toContain('^C');
            expect(model.isStopping).toBe(true);
        });

        it('takes only stop while a spin it started is running', () => {
            const { model, terminal } = setup();
            terminal.submit('spin');

            terminal.submit('balance');
            expect(terminal.transcript).toContain('A spin is running.');

            terminal.submit('stop');
            expect(model.isStopping).toBe(true);
        });

        it('says when a celebration is cut short', () => {
            const { model, terminal, advance } = setup({ strips: ONE_WAY_STRIPS });
            terminal.submit('spin');
            advance(LANDED_MS);

            model.stop();
            advance(10);

            expect(terminal.transcript).toContain('Celebration skipped.');
        });
    });

    it('announces game over', () => {
        const { terminal, advance } = setup({ strips: LOSING_STRIPS, startingBalance: BET });

        terminal.submit('spin');
        advance(LANDED_MS);

        expect(terminal.transcript).toContain('GAME OVER');
    });

    it('recalls earlier commands, back and forward', () => {
        const { terminal } = setup();
        terminal.submit('help');
        terminal.submit('balance');

        expect(terminal.recall(-1)).toBe('balance');
        expect(terminal.recall(-1)).toBe('help');
        expect(terminal.recall(-1)).toBe('help');
        expect(terminal.recall(1)).toBe('balance');
        expect(terminal.recall(1)).toBe('');
    });
});
