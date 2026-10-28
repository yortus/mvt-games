// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/html';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    BET, BIG_WIN, CELEBRATION_OPENER_MS, CELEBRATION_STEP_MS, COIN, FIRST_SETTLE_MS, GAME_OVER, LEVER, NO_WIN, REEL_CLICK,
    REEL_STOP, SETTLE_MS, SETTLE_STAGGER_MS, STOPPING_SETTLE_MS, type SymbolKind, WAY_OF_3, WAY_OF_5, WIN,
} from '../../data';
import { createFruitMachineModel, type FruitMachineModelOptions } from '../../models';
import { MachineAudioView } from './machine-audio-view';

// The view is tested by what it asks of its chips: which songs and sounds it plays, and when it stops the music. How
// a chip plays a song is the chip's own concern, tested with it.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('MachineAudioView', () => {
    it('pulls the lever, clicks while the reels turn, and thunks as each lands, one after another', () => {
        const t = setUp({ strips: NO_WIN_STRIPS });
        void t.model.spin();
        t.advance(TICK_MS);
        expect(countPlayed(t.sfx, LEVER)).toBe(1);

        // The first reel thunks as it starts to settle, not once it is at rest
        t.advance(FIRST_SETTLE_MS);
        expect(countPlayed(t.sfx, REEL_STOP)).toBe(1);
        // And each of the others in turn, as it starts to settle
        for (let i = 1; i < t.model.reels.length; i++) {
            t.advance(SETTLE_STAGGER_MS);
            expect(countPlayed(t.sfx, REEL_STOP), `reel ${i}`).toBe(i + 1);
        }

        t.advance(LANDED_MS);
        const clicks = countPlayed(t.sfx, REEL_CLICK);
        expect(clicks).toBeGreaterThan(10);
        expect(countPlayed(t.sfx, REEL_STOP)).toBe(t.model.reels.length);

        t.advance(1000);
        expect(countPlayed(t.sfx, REEL_CLICK)).toBe(clicks);
    });

    it('thunks once, not once for each reel, when a stop lands every reel at once', () => {
        const t = setUp({ strips: NO_WIN_STRIPS });
        void t.model.spin();
        t.advance(TICK_MS);
        t.model.stop();
        t.advance(TICK_MS);
        expect(countPlayed(t.sfx, REEL_STOP)).toBe(1);

        t.advance(STOPPING_SETTLE_MS + TICK_MS);
        expect(countPlayed(t.sfx, REEL_STOP)).toBe(1);
    });

    it('sighs at a spin that wins nothing, with no jingle', () => {
        const t = setUp({ strips: NO_WIN_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + 1000);
        expect(countPlayed(t.sfx, NO_WIN)).toBe(1);
        expect(t.music.play).not.toHaveBeenCalled();
    });

    it('plays a jingle and a shower of coins for a win, then a chime for its way', () => {
        const t = setUp({ strips: WAY_OF_3_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + CELEBRATION_OPENER_MS);
        expect(listPlayed(t.music)).toEqual([WIN]);
        expect(countPlayed(t.sfx, COIN)).toBeGreaterThan(5);
        const coins = countPlayed(t.sfx, COIN);

        t.advance(CELEBRATION_STEP_MS);
        expect(countPlayed(t.sfx, WAY_OF_3)).toBe(1);
        expect(countPlayed(t.sfx, COIN)).toBe(coins);
        expect(countPlayed(t.sfx, NO_WIN)).toBe(0);
    });

    it('plays the longer jingle for a big win, and a higher chime for a longer way', () => {
        const t = setUp({ strips: WAY_OF_5_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + BIG_WIN.durationMs);
        expect(listPlayed(t.music)).toEqual([BIG_WIN]);
        expect(countPlayed(t.sfx, WAY_OF_5)).toBe(1);
    });

    it('plays the slow tune as the credits run out, instead of the sigh', () => {
        const t = setUp({ strips: NO_WIN_STRIPS, startingBalance: BET });
        void t.model.spin();
        t.advance(LANDED_MS + GAME_OVER.durationMs);
        expect(listPlayed(t.music)).toEqual([GAME_OVER]);
        expect(countPlayed(t.sfx, NO_WIN)).toBe(0);
    });

    it('cuts a jingle short when the next spin starts', () => {
        const t = setUp({ strips: WAY_OF_3_STRIPS });
        void t.model.spin();
        t.advance(LANDED_MS + TICK_MS);
        t.model.stop();
        t.advance(TICK_MS);
        void t.model.spin();
        vi.clearAllMocks();
        t.advance(TICK_MS);
        expect(t.music.stop).toHaveBeenCalledOnce();
        t.advance(FIRST_SETTLE_MS);
        expect(t.music.play).not.toHaveBeenCalled();
    });

    it('plays nothing for a machine at rest, nor for one already over', () => {
        const atRest = setUp({ strips: NO_WIN_STRIPS });
        const over = setUp({ strips: NO_WIN_STRIPS, startingBalance: 0 });
        atRest.advance(1000);
        over.advance(1000);
        for (const chip of [atRest.music, atRest.sfx, over.music, over.sfx]) {
            expect(chip.play).not.toHaveBeenCalled();
            expect(chip.queue).not.toHaveBeenCalled();
            expect(chip.stop).not.toHaveBeenCalled();
        }
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every reel shows its whole strip. The second reel shares no picture with the first, so no way wins. */
const NO_WIN_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
];

/** One way wins. It is the first picture, on the first three reels. */
const WAY_OF_3_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic2', 'pic3', 'pic4'],
    ['pic5', 'pic6', 'pic2'],
];

/** One way wins. It is the first picture, on all five reels, and it pays a big win. */
const WAY_OF_5_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic1', 'pic5', 'pic4'],
    ['pic5', 'pic1', 'pic6'],
];

/** How long the last reel takes to land, from the start of a spin, and one tick more. */
const LANDED_MS = FIRST_SETTLE_MS + (NO_WIN_STRIPS.length - 1) * SETTLE_STAGGER_MS + SETTLE_MS + TICK_MS;

function setUp(options: FruitMachineModelOptions) {
    const model = createFruitMachineModel({ seed: 5, ...options });
    const music = createSpiedChip();
    const sfx = createSpiedChip();
    const view = MachineAudioView({ model, music, sfx });
    /** Runs ticks as the host does. It advances the chips' clocks and the model, then updates and refreshes the view. */
    const advance = (totalMs: number): void => {
        for (let elapsed = 0; elapsed < totalMs; elapsed += TICK_MS) {
            music.update(TICK_MS);
            sfx.update(TICK_MS);
            model.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    return { model, music, sfx, advance };
}

/** Creates a headless chip whose `play`, `queue` and `stop` are spied on, so a test can read what a view asked of it. */
function createSpiedChip(): HeadlessAudio80 {
    const chip = createHeadlessAudio80();
    vi.spyOn(chip, 'play');
    vi.spyOn(chip, 'queue');
    vi.spyOn(chip, 'stop');
    return chip;
}

/** The songs and sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio80): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

/** How many times `sound` has played on `chip`. */
function countPlayed(chip: HeadlessAudio80, sound: unknown): number {
    return listPlayed(chip).filter((played) => played === sound).length;
}
