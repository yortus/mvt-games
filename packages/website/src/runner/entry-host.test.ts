// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRefresh } from '@mvtjs/html';
import { type Audio80, createInstrument, createSoundEffect } from '@mvtjs/audio';
import type { ChipWrite } from '@mvtjs/audio/headless';
import type { ElementEntryStarter } from '../entry-types';
import { createEntryHost, type EntryHost } from './entry-host';
import { type FakeWebAudio, installFakeWebAudio, uninstallFakeWebAudio } from './fake-web-audio';
import { createPageSound, type PageSound } from './page-sound';

vi.mock('@mvtjs/audio/web', async () => (await import('./fake-web-audio')).importFakeWebAudio());

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

        const [chip] = fake.chips;
        expect(listPlays(chip.audio80.log)).toEqual([EFFECT]);
        // The game's chip is the entries' chip, which the host advances with the game
        expect(game.sound()?.time).toBe(TICK_MS);
        destroyAll(host, sound);
    });

    it('sends the chip\'s writes after the views refresh', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        host.start(game.starter);
        const [chip] = fake.chips;

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
        const [chip] = fake.chips;
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
        const [chip] = fake.chips;

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
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 60;
const INSTRUMENT = createInstrument({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 } });
const EFFECT = createSoundEffect({ instrument: INSTRUMENT, note: 'C-5', lengthMs: 50 });

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
 * Creates an element entry with one view, which plays an effect each time it
 * refreshes. The entry keeps the chip it was given, and the chip's flush
 * count at each refresh.
 */
function createFakeGame() {
    let sound: Audio80 | undefined;
    const flushCountsAtRefresh: number[] = [];
    const starter: ElementEntryStarter = {
        kind: 'element',
        start: (options) => {
            sound = options.sound;
            const view = document.createElement('div');
            setRefresh(view, () => {
                flushCountsAtRefresh.push(fake.chips[0].flushCount);
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

/** Returns the sound effects played, in order. */
function listPlays(log: readonly ChipWrite[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { effect: unknown }).effect);
}
