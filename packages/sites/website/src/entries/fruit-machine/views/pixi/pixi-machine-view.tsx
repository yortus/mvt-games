/** @jsxImportSource @mvtjs/pixi */
import type { Container } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { PAYTABLE } from '../../data';
import type { FruitMachineModel, WayWin } from '../../models';
import { SYMBOL_COLORS, SYMBOL_NAMES, type SymbolArt } from '../art';
import { createLitCells, easeOutBack, formatCredits, lastFor, shownReelPosition } from '../shared';
import { BackdropView } from './backdrop-view';
import { GameOverView } from './game-over-view';
import { JuiceBurstView } from './juice-burst-view';
import { type LightsMode, MarqueeLightsView } from './marquee-lights-view';
import { MetersView } from './meters-view';
import { PaytableStripView } from './paytable-strip-view';
import { BUTTON_RADIUS, BUTTON_X, BUTTON_Y, WINDOW_Y } from './pixi-layout';
import { ReelWindowView } from './reel-window-view';
import { type SpinButtonMode, SpinButtonView } from './spin-button-view';
import { createSymbolTextures } from './symbol-textures';
import { WinBannerView } from './win-banner-view';
import { WinPathView } from './win-path-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PixiMachineViewBindings {
    readonly model: FruitMachineModel;
    readonly art: SymbolArt;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The modern machine, in Pixi.js: layers from the backdrop up, each a view of
 * one thing. The reels land with a springy overshoot, eased here from the
 * model's linear settle; the lights, the juice and the counting win are this
 * view's own presentation state. One button spins or stops, whichever the
 * model allows; during a celebration it spins, cutting the celebration short.
 */
export function PixiMachineView(bindings: PixiMachineViewBindings): Container {
    const { model, art } = bindings;
    const { reels, celebration } = model;
    const textures = createSymbolTextures({ art });
    const litCells = createLitCells({ celebration });
    const strips = reels.map((reel) => reel.strip);
    const wayCaption = lastFor((win: WayWin) => `${SYMBOL_NAMES[win.symbol].toUpperCase()} x${win.rows.length}   +${formatCredits(win.payout)}`);
    const openerCaption = memoiseLast((ways: number) => (ways === 1 ? '1 WINNING WAY' : `${ways} WINNING WAYS`));

    return (
        <container onDestroyed={textures.release}>
            <BackdropView />
            <PaytableStripView paytable={PAYTABLE} textureFor={(kind) => textures.textureFor(kind, false)} x={12} y={WINDOW_Y} />
            <MarqueeLightsView mode={lightsMode} />
            <ReelWindowView
                strips={strips}
                positionAt={(reel) => shownReelPosition(reels[reel], easeOutBack)}
                isBlurredAt={(reel) => reels[reel].phase === 'spinning'}
                textureFor={textures.textureFor}
            />
            <WinPathView
                isCelebrating={() => celebration.isActive}
                isLitAt={litCells.isLitAt}
                pathRows={() => celebration.win?.rows}
                pathColor={() => SYMBOL_COLORS[celebration.win?.symbol ?? 'wild']}
                progress={() => celebration.progress}
            />
            <JuiceBurstView stepIndex={() => celebration.stepIndex} isLitAt={litCells.isLitAt} colorAt={juiceColorAt} />
            <MetersView balance={() => model.balance} bet={model.bet} win={() => model.lastWin} />
            <WinBannerView isShown={() => celebration.isActive} amount={() => model.lastWin} caption={caption} />
            <container x={BUTTON_X} y={BUTTON_Y}>
                <SpinButtonView mode={buttonMode} radius={BUTTON_RADIUS} onPressed={pressButton} />
            </container>
            <GameOverView isShown={() => model.phase === 'gameOver'} />
        </container>
    );

    function lightsMode(): LightsMode {
        switch (model.phase) {
            case 'spinning': return 'busy';
            case 'celebrating': return 'party';
            case 'gameOver': return 'off';
            default: return 'idle';
        }
    }

    /**
     * The button does whichever the model allows: stopping comes first, since a
     * spin can't start while one runs. A celebration can be stopped too, but a
     * press then spins again, so the button says so.
     */
    function buttonMode(): SpinButtonMode {
        if (model.phase === 'celebrating') return 'spin';
        if (model.canStop) return 'stop';
        return model.canSpin ? 'spin' : 'disabled';
    }

    /** Skipping a celebration spins again; stopping a spin leaves nothing to spin until the reels land. */
    function pressButton(): void {
        if (model.canStop) model.stop();
        if (model.canSpin) void model.spin();
    }

    function caption(): string {
        const win = celebration.win;
        return win === undefined ? openerCaption(celebration.wins.length) : wayCaption(win);
    }

    /** A way's juice is its fruit's; the opener splashes each cell's own. */
    function juiceColorAt(reel: number, row: number): string {
        const symbol = celebration.win?.symbol ?? model.outcome?.window[reel][row] ?? 'wild';
        return SYMBOL_COLORS[symbol];
    }
}
