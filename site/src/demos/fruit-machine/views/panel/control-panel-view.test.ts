// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/html';
import {
    BET, CELEBRATION_OPENER_MS, FIRST_SETTLE_MS, PAYTABLE, SETTLE_MS, SETTLE_STAGGER_MS, STARTING_BALANCE, type SymbolKind,
} from '../../data';
import { createFruitMachineModel, type FruitMachineModelOptions } from '../../models';
import type { SymbolArt } from '../art';
import { formatCredits } from '../shared';
import { ControlPanelView } from './control-panel-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANDED_MS = FIRST_SETTLE_MS + 4 * SETTLE_STAGGER_MS + SETTLE_MS;

/** Every spin wins one way: melon on the first three reels. */
const ONE_WAY_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic2', 'pic3', 'pic4'],
    ['pic5', 'pic6', 'pic2'],
];

/** The panel uses only the pictures' URLs; the canvases are for the Pixi and three.js views. */
const ART: SymbolArt = {
    canvasFor: () => { throw new Error('the panel draws no canvases'); },
    blurredCanvasFor: () => { throw new Error('the panel draws no canvases'); },
    urlFor: (kind) => `data:,${kind}`,
};

function setup(options: FruitMachineModelOptions = {}) {
    const model = createFruitMachineModel({ seed: 5, ...options });
    const panel = ControlPanelView({ model, art: ART });
    document.body.replaceChildren(panel);
    const frame = (deltaMs: number): void => {
        model.update(deltaMs);
        updateView(panel, deltaMs);
        refreshView(panel);
    };
    const advance = (totalMs: number): void => {
        for (let elapsed = 0; elapsed < totalMs; elapsed += 10) frame(10);
    };
    frame(0);
    const button = (name: 'spin' | 'stop'): HTMLButtonElement => panel.querySelector(`.panel-${name}`) as HTMLButtonElement;
    const meter = (label: string): string => {
        const meters = [...panel.querySelectorAll('.meter')];
        const found = meters.find((m) => m.querySelector('.meter-label')?.textContent === label);
        return found?.querySelector('.meter-value')?.textContent ?? '';
    };
    const isFlagOn = (name: string): boolean => [...panel.querySelectorAll('.flag')].some((f) => f.textContent === name && f.classList.contains('on'));
    return { model, panel, advance, button, meter, isFlagOn };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ControlPanelView', () => {
    it('shows the meters and the guards of a machine at rest', () => {
        const t = setup();

        expect(t.meter('Balance')).toBe(formatCredits(STARTING_BALANCE));
        expect(t.meter('Bet')).toBe(formatCredits(BET));
        expect(t.meter('Spins')).toBe('0');
        expect(t.isFlagOn('canSpin')).toBe(true);
        expect(t.isFlagOn('canStop')).toBe(false);
        expect(t.button('spin').disabled).toBe(false);
        expect(t.button('stop').disabled).toBe(true);
    });

    it('spins when Spin is clicked, and enables Stop instead', () => {
        const t = setup();

        t.button('spin').click();
        t.advance(10);

        expect(t.model.phase).toBe('spinning');
        expect(t.meter('Balance')).toBe(formatCredits(STARTING_BALANCE - BET));
        expect(t.button('spin').disabled).toBe(true);
        expect(t.button('stop').disabled).toBe(false);
        expect(t.panel.querySelector('.phase')?.textContent).toBe('spinning');
    });

    it('stops when Stop is clicked', () => {
        const t = setup();
        t.button('spin').click();
        t.advance(100);

        t.button('stop').click();
        t.advance(10);

        expect(t.isFlagOn('isStopping')).toBe(true);
    });

    it('follows a spin started elsewhere', () => {
        const t = setup();

        void t.model.spin();
        t.advance(10);

        expect(t.meter('Spins')).toBe('1');
        expect(t.panel.querySelectorAll('.reel-spinning')).toHaveLength(5);
    });

    it('lists the winning ways, and lights the cells being celebrated', () => {
        const t = setup({ strips: ONE_WAY_STRIPS });
        t.button('spin').click();
        t.advance(LANDED_MS + CELEBRATION_OPENER_MS);

        const rows = t.panel.querySelectorAll('.win');
        expect(rows).toHaveLength(1);
        expect(rows[0].classList.contains('current')).toBe(true);
        expect(rows[0].querySelector('.win-name')?.textContent).toBe('Watermelon');
        expect(t.panel.querySelectorAll('.window-grid .cell.lit')).toHaveLength(3);
        expect(t.meter('Last win')).toBe(formatCredits(PAYTABLE.pic1[3]));
    });
});
