// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRefresh } from '@mvtjs/html';
import { type Audio80, createAudio80Instrument, createAudio80SoundEffect } from '@mvtjs/chiptune';
import type { Audio80Write } from '@mvtjs/chiptune/headless';
import type { Audio90 } from '@mvtjs/chiptune';
import type { ElementEntryStarter } from '../entry-types';
import { createEntryHost, type EntryHost } from './entry-host';
import { type FakeChip, type FakeWebAudio, installFakeWebAudio, uninstallFakeWebAudio } from './fake-web-audio';
import { createPageSound, type PageSound } from './page-sound';

vi.mock('@mvtjs/chiptune/web', async () => (await import('./fake-web-audio')).importFakeWebAudio());

let fake: FakeWebAudio;

beforeEach(() => {
    fake = installFakeWebAudio();
});

afterEach(() => {
    uninstallFakeWebAudio();
});

describe('createEntryHost', () => {
    it('starts a game only once the chips have loaded, so the game plays on the real chip', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();

        await host.prepare(game.starter);
        expect(fake.chips).toHaveLength(2);
        host.start(game.starter);
        host.tick(0, TICK_MS);

        const chip = entryChip();
        expect(listPlays(chip.audio80.log)).toEqual([EFFECT]);
        // The game's chip is the Audio80 for entries, which the host advances with the game
        expect(game.sound()?.time).toBe(TICK_MS);
        destroyAll(host, sound);
    });

    it('sends the chip\'s writes after the views refresh', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        host.start(game.starter);
        const chip = entryChip();

        host.tick(0, TICK_MS);
        expect(game.flushCountsAtRefresh()).toEqual([0]);
        expect(chip.flushCount).toBe(1);
        destroyAll(host, sound);
    });

    it('stops the chip\'s clock while paused, and still sends its writes', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        host.start(game.starter);
        const chip = entryChip();
        host.tick(0, TICK_MS);

        host.isPaused = true;
        host.tick(TICK_MS, TICK_MS);
        host.tick(2 * TICK_MS, TICK_MS);
        expect(chip.audio80.time).toBe(TICK_MS);
        expect(chip.flushCount).toBe(3);

        host.isPaused = false;
        host.tick(3 * TICK_MS, TICK_MS);
        expect(chip.audio80.time).toBe(2 * TICK_MS);
        destroyAll(host, sound);
    });

    it('resets the chip when a session starts and when it stops', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        const chip = entryChip();

        host.start(game.starter);
        expect(chip.resetCount).toBe(1);
        host.stop();
        expect(chip.resetCount).toBe(2);
        host.start(game.starter);
        host.restart();
        // A restart stops the session and starts another
        expect(chip.resetCount).toBe(5);
        destroyAll(host, sound);
    });

    it('gives an entry that makes no sound no chip, and loads none for it', async () => {
        const { sound, host } = createHostWithSound();
        const demo = createFakeSilentDemo();

        await host.prepare(demo.starter);
        // Only the page's own chip
        expect(fake.chips).toHaveLength(1);
        host.start(demo.starter);
        host.tick(0, TICK_MS);
        expect(demo.wasGivenSound()).toBe(false);
        expect(fake.chips[0].flushCount).toBe(0);
        host.stop();
        destroyAll(host, sound);
    });

    it('loads the entries\' chip for the first entry that plays on it, after one that makes no sound', async () => {
        const { sound, host } = createHostWithSound();
        const demo = createFakeSilentDemo();
        const game = createFakeGame();
        await host.prepare(demo.starter);
        host.start(demo.starter);

        await host.prepare(game.starter);
        expect(fake.chips).toHaveLength(2);
        host.start(game.starter);
        host.tick(0, TICK_MS);
        expect(listPlays(entryChip().audio80.log)).toEqual([EFFECT]);
        destroyAll(host, sound);
    });

    it('gives an entry that plays on the Audio90 an Audio90, and advances and flushes it, loading no entry Audio80', async () => {
        const { sound, host } = createHostWithSound();
        let given: Audio90 | undefined;
        const starter: ElementEntryStarter<'audio90'> = {
            kind: 'element',
            soundChip: 'audio90',
            start: (options) => {
                given = options.sound;
                const view = document.createElement('div');
                setRefresh(view, () => options.sound.setTempo(120));
                return { views: [view], update: () => {}, render: () => {}, destroy: () => {} };
            },
        };
        await host.prepare(starter);
        expect(fake.chips).toHaveLength(1);
        expect(fake.audio90Chips).toHaveLength(1);
        host.start(starter);
        host.tick(0, TICK_MS);
        const [chip] = fake.audio90Chips;
        expect(given?.time).toBe(TICK_MS);
        expect(chip.audio90.log).toEqual([{ kind: 'set-tempo', bpm: 120, time: TICK_MS }]);
        expect(chip.flushCount).toBe(1);
        host.stop();
        expect(chip.resetCount).toBeGreaterThan(0);
        destroyAll(host, sound);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 60;
const INSTRUMENT = createAudio80Instrument({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 } });
const EFFECT = createAudio80SoundEffect({ instrument: INSTRUMENT, note: 'C-5', lengthMs: 50 });

/** Creates an entry host that plays on the page's sound. */
function createHostWithSound(): { sound: PageSound; host: EntryHost } {
    const sound = createPageSound({ isEnabled: true });
    const host = createEntryHost({ element: document.createElement('div'), isTouch: false, sound });
    return { sound, host };
}

function destroyAll(host: EntryHost, sound: PageSound): void {
    host.destroy();
    sound.destroy();
}

/**
 * Returns the fake browser chip that entries play on. The page's own chip is
 * made first, when the sound is first prepared, and the entries' chip after
 * it, when an entry that plays on it is prepared.
 */
function entryChip(): FakeChip {
    return fake.chips[1];
}

/**
 * Creates an element entry with one view, which plays an effect each time it
 * refreshes. The entry keeps the chip it was given, and the chip's flush
 * count at each refresh.
 */
function createFakeGame() {
    let sound: Audio80 | undefined;
    const flushCountsAtRefresh: number[] = [];
    const starter: ElementEntryStarter<'audio80'> = {
        kind: 'element',
        soundChip: 'audio80',
        start: (options) => {
            sound = options.sound;
            const view = document.createElement('div');
            setRefresh(view, () => {
                flushCountsAtRefresh.push(entryChip().flushCount);
                options.sound.play(EFFECT);
            });
            return {
                views: [view],
                update: () => {},
                render: () => {},
                destroy: () => {},
            };
        },
    };
    return { starter, sound: () => sound, flushCountsAtRefresh: () => flushCountsAtRefresh };
}

/** Creates an element entry that makes no sound. It keeps whether it was given a chip anyway. */
function createFakeSilentDemo() {
    let wasGivenSound = false;
    const starter: ElementEntryStarter = {
        kind: 'element',
        start: (options) => {
            wasGivenSound = 'sound' in options;
            return { views: [], update: () => {}, render: () => {}, destroy: () => {} };
        },
    };
    return { starter, wasGivenSound: () => wasGivenSound };
}

/** Returns the sound effects played, in order. */
function listPlays(log: readonly Audio80Write[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { effect: unknown }).effect);
}
