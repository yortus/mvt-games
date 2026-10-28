// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRefresh } from '@mvtjs/html';
import { createAudio80Sound } from 'audio90';
import type { MusicChip } from '#shared';
import type { ElementEntryStarter } from '../entry-types';
import { createEntryHost, type EntryHost } from './entry-host';
import { type FakeChip, type FakeWebAudio, installFakeWebAudio, uninstallFakeWebAudio } from './fake-web-audio';
import { createPageSound, type PageSound } from './page-sound';

vi.mock('./web-chips', async () => (await import('./fake-web-audio')).importFakeWebAudio());

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
        expect(fake.chips).toHaveLength(PAGE_CHIPS + ENTRY_CHIPS);
        host.start(game.starter);
        host.tick(0, TICK_MS);

        expect(entryChips().sfx.played).toEqual([EFFECT]);
        destroyAll(host, sound);
    });

    it('pauses the chips as the game pauses, and plays them on as the game resumes', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        host.start(game.starter);
        const { music, sfx } = entryChips();

        host.isPaused = true;
        expect([music.isPaused, sfx.isPaused]).toEqual([true, true]);
        host.isPaused = false;
        expect([music.isPaused, sfx.isPaused]).toEqual([false, false]);
        destroyAll(host, sound);
    });

    it('plays the chips again for a new session, after one left paused', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        host.start(game.starter);
        host.isPaused = true;
        host.start(game.starter);
        expect([host.isPaused, entryChips().music.isPaused, entryChips().sfx.isPaused]).toEqual([false, false, false]);
        destroyAll(host, sound);
    });

    it('stops everything on the chips when a session starts and when it stops', async () => {
        const { sound, host } = createHostWithSound();
        const game = createFakeGame();
        await host.prepare(game.starter);
        const { music, sfx } = entryChips();

        host.start(game.starter);
        expect([music.stopAllCount, sfx.stopAllCount]).toEqual([1, 1]);
        host.stop();
        expect([music.stopAllCount, sfx.stopAllCount]).toEqual([2, 2]);
        host.start(game.starter);
        host.restart();
        // A restart stops the session and starts another
        expect([music.stopAllCount, sfx.stopAllCount]).toEqual([5, 5]);
        destroyAll(host, sound);
    });

    it('gives an entry that makes no sound no chips, and loads none for it', async () => {
        const { sound, host } = createHostWithSound();
        const demo = createFakeSilentDemo();

        await host.prepare(demo.starter);
        // Only the page's own chips
        expect(fake.chips).toHaveLength(PAGE_CHIPS);
        host.start(demo.starter);
        host.tick(0, TICK_MS);
        expect(demo.wasGivenSound()).toBe(false);
        host.stop();
        destroyAll(host, sound);
    });

    it('loads the entries\' chips for the first entry that plays on them, after one that makes no sound', async () => {
        const { sound, host } = createHostWithSound();
        const demo = createFakeSilentDemo();
        const game = createFakeGame();
        await host.prepare(demo.starter);
        host.start(demo.starter);

        await host.prepare(game.starter);
        expect(fake.chips).toHaveLength(PAGE_CHIPS + ENTRY_CHIPS);
        host.start(game.starter);
        host.tick(0, TICK_MS);
        expect(entryChips().sfx.played).toEqual([EFFECT]);
        destroyAll(host, sound);
    });

    it('gives an entry that plays on the Audio90 two Audio90s, loading no entry Audio80', async () => {
        const { sound, host } = createHostWithSound();
        let given: MusicChip<'audio90'> | undefined;
        const starter: ElementEntryStarter<'audio90'> = {
            kind: 'element',
            soundChip: 'audio90',
            start: (options) => {
                given = options.music;
                const view = document.createElement('div');
                setRefresh(view, () => {
                    options.music.tempoScale = 0.5;
                });
                return { views: [view], update: () => {}, render: () => {}, destroy: () => {} };
            },
        };
        await host.prepare(starter);
        expect(fake.chips).toHaveLength(PAGE_CHIPS);
        expect(fake.audio90Chips).toHaveLength(ENTRY_CHIPS);
        host.start(starter);
        host.tick(0, TICK_MS);
        const [music, sfx] = fake.audio90Chips;
        expect(given).toBeDefined();
        expect(music.tempoScale).toBe(0.5);
        host.stop();
        expect([music.stopAllCount, sfx.stopAllCount]).toEqual([2, 2]);
        destroyAll(host, sound);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 60;
const EFFECT = createAudio80Sound({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 }, note: 'C-5', lengthMs: 50 });

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

/** The page's own chips, one for its sounds and one for its music, which it makes first, when the sound is first prepared. */
const PAGE_CHIPS = 2;
/** The chips of one kind that entries play on, which the page makes when an entry that plays on them is prepared. */
const ENTRY_CHIPS = 2;

/** Returns the fake browser chips that entries play on, after the page's own. */
function entryChips(): { readonly music: FakeChip; readonly sfx: FakeChip } {
    return { music: fake.chips[PAGE_CHIPS], sfx: fake.chips[PAGE_CHIPS + 1] };
}

/** Creates an element entry with one view, which plays an effect each time it refreshes. */
function createFakeGame() {
    const starter: ElementEntryStarter<'audio80'> = {
        kind: 'element',
        soundChip: 'audio80',
        start: (options) => {
            const view = document.createElement('div');
            setRefresh(view, () => {
                options.sfx.play(EFFECT);
            });
            return {
                views: [view],
                update: () => {},
                render: () => {},
                destroy: () => {},
            };
        },
    };
    return { starter };
}

/** Creates an element entry that makes no sound. It keeps whether it was given chips anyway. */
function createFakeSilentDemo() {
    let wasGivenSound = false;
    const starter: ElementEntryStarter = {
        kind: 'element',
        start: (options) => {
            wasGivenSound = 'music' in options || 'sfx' in options;
            return { views: [], update: () => {}, render: () => {}, destroy: () => {} };
        },
    };
    return { starter, wasGivenSound: () => wasGivenSound };
}

/** Returns the sound effects played, in order. */
