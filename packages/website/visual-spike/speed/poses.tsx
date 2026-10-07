// Spike: 1000 poses of real views, by index, for the speed suite.
import { Container } from 'pixi.js';
import { updateView } from '@mvtjs/pixi';
import { PAYTABLE, REEL_STRIPS } from '../../src/entries/fruit-machine/data';
import { loadSymbolArt } from '../../src/entries/fruit-machine/views/art';
import { GameOverView } from '../../src/entries/fruit-machine/views/pixi/game-over-view';
import { type LightsMode, MarqueeLightsView } from '../../src/entries/fruit-machine/views/pixi/marquee-lights-view';
import { MetersView } from '../../src/entries/fruit-machine/views/pixi/meters-view';
import { PaytableStripView } from '../../src/entries/fruit-machine/views/pixi/paytable-strip-view';
import { ReelWindowView } from '../../src/entries/fruit-machine/views/pixi/reel-window-view';
import { type SpinButtonMode, SpinButtonView } from '../../src/entries/fruit-machine/views/pixi/spin-button-view';
import { createSymbolTextures, type SymbolTextures } from '../../src/entries/fruit-machine/views/pixi/symbol-textures';
import { WinBannerView } from '../../src/entries/fruit-machine/views/pixi/win-banner-view';
import { entryPose, entrySize } from '../entry-poses';
import type { PixiPictureOptions } from '../harness';

export interface SpeedPose {
    readonly name: string;
    readonly pose: () => Container | Promise<Container>;
    readonly options?: PixiPictureOptions;
}

let textures: Promise<SymbolTextures> | undefined;
function symbolTextures(): Promise<SymbolTextures> {
    textures ??= loadSymbolArt().then((art) => createSymbolTextures({ art }));
    return textures;
}

function advance(view: Container, totalMs: number): void {
    for (let t = 0; t < totalMs; t += 16) updateView(view, Math.min(16, totalMs - t));
}

const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];
const LIGHTS: readonly LightsMode[] = ['idle', 'busy', 'party', 'off'];
const WHOLE = ['crumb-chase', 'galaxy-raiders', 'neon-monsoon', 'dojo-duel', 'burrow-bust', 'reordering-lists', 'astrovoid', 'fuel-run', 'falling-sand', 'boids'];

export function speedPose(i: number): SpeedPose {
    const kind = i % 50;
    const n = Math.floor(i / 50); // 0..19
    // 2% whole screens (20 of 1000)
    if (kind === 49) {
        const id = WHOLE[n % WHOLE.length];
        return { name: `whole ${id} ${n}`, pose: entryPose(id, 500 + n * 100), options: entrySize(id) };
    }
    if (kind < 12) {
        const mode = MODES[kind % 3];
        const radius = 24 + ((kind + n * 12) % 48);
        return { name: `spin ${mode} r${radius} ${i}`, pose: () => SpinButtonView({ mode: () => mode, radius }) };
    }
    if (kind < 22) {
        const win = 5 * (1 + ((kind * 37 + n * 101) % 400));
        const ms = (kind - 12) * 90 + n * 7;
        return {
            name: `banner ${win} at ${ms}ms ${i}`,
            pose: () => {
                let amount = 0;
                const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => `${3 + (kind % 3)} cherries pay ${win}` });
                amount = win;
                advance(view, ms);
                return view;
            },
        };
    }
    if (kind < 30) {
        const balance = 1000 - kind * 13 - n * 7;
        return { name: `meters ${balance} ${i}`, pose: () => MetersView({ balance: () => balance, bet: 10, win: () => (kind % 2 ? 0 : kind * 5) }) };
    }
    if (kind < 38) {
        const mode = LIGHTS[kind % 4];
        const ms = n * 133 + kind * 17;
        return { name: `lights ${mode} ${ms}ms ${i}`, pose: () => { const v = MarqueeLightsView({ mode: () => mode }); advance(v, ms); return v; } };
    }
    if (kind < 46) {
        const offset = (kind * 3 + n * 0.37) % 20;
        const blurred = kind % 4 === 0;
        return {
            name: `reels ${offset.toFixed(2)} ${blurred ? 'blurred' : 'sharp'} ${i}`,
            pose: async () => {
                const t = await symbolTextures();
                return ReelWindowView({ strips: REEL_STRIPS, positionAt: (r) => offset + r * 1.5, isBlurredAt: () => blurred, textureFor: t.textureFor });
            },
        };
    }
    if (kind < 48) {
        return { name: `paytable ${i}`, pose: async () => { const t = await symbolTextures(); return PaytableStripView({ paytable: PAYTABLE, textureFor: (k) => t.textureFor(k, false), x: 0, y: 0 }); } };
    }
    return { name: `game over ${i}`, pose: () => GameOverView({ isShown: () => true }) };
}
