// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudio80Song, createAudio80Sound } from 'audio90';
import type { Audio80Write } from 'audio90/headless';
import { type FakeWebAudio, installFakeWebAudio, uninstallFakeWebAudio } from './fake-web-audio';
import { createPageSound } from './page-sound';
import { toSliderGain } from './slider-gain';

vi.mock('./web-chips', async () => (await import('./fake-web-audio')).importFakeWebAudio());

let fake: FakeWebAudio;

beforeEach(() => {
    fake = installFakeWebAudio();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    uninstallFakeWebAudio();
    vi.restoreAllMocks();
});

describe('createPageSound', () => {
    it('ignores writes made before the chips load, without error, and keeps none for later', async () => {
        const sound = createPageSound({ isEnabled: true });
        const { music, sfx } = sound.entryChips.audio80;
        expect(() => {
            sfx.stop(sfx.play(EFFECT, { lengthMs: Infinity }));
            music.play(SONG);
            music.stop();
            sound.pageSfx.play(EFFECT);
        }).not.toThrow();
        expect([music.time, music.song]).toEqual([0, undefined]);
        await expect(music.ready).resolves.toBeUndefined();

        await sound.prepare('audio80');
        for (const chip of fake.chips) expect(chip.log).toEqual([]);
    });

    it('loads only the page\'s own chips when no entry chip is asked for', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        expect(fake.chips).toHaveLength(PAGE_CHIPS);
        sound.pageSfx.play(EFFECT);
        sound.pageMusic.play(SONG);
        const [pageSfx, pageMusic] = fake.chips;
        expect(listPlays(pageSfx.log)).toEqual([EFFECT]);
        expect(pageMusic.song).toBe(SONG);

        await sound.prepare('audio80');
        expect(fake.chips).toHaveLength(PAGE_CHIPS + ENTRY_CHIPS);
        expect(fake.audio90Chips).toHaveLength(0);
    });

    it('loads the Audio90s only when an entry that plays on them is prepared, with the settings and mute set before', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.settings = { musicVolume: 0.3, sfxVolume: 0.8 };
        sound.isMuted = true;
        await sound.prepare('audio80');
        expect(fake.audio90Chips).toHaveLength(0);

        await sound.prepare('audio90');
        await sound.prepare('audio90');
        expect(fake.audio90Chips).toHaveLength(ENTRY_CHIPS);
        const [music, sfx] = fake.audio90Chips;
        expect([music.volume, sfx.volume]).toEqual([toSliderGain(0.3), toSliderGain(0.8)]);
        expect([music.isMuted, sfx.isMuted]).toEqual([true, true]);
        sound.entryChips.audio90.music.setTempo(120);
        expect(music.log).toEqual([{ kind: 'set-tempo', bpm: 120, time: 0 }]);
        sound.destroy();
    });

    it('gives the chips the settings, the mute and the tempo scale set before they loaded', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.settings = { musicVolume: 0.3, sfxVolume: 0 };
        sound.entryChips.audio80.sfx.isMuted = true;
        sound.entryChips.audio80.music.tempoScale = 0.5;

        await sound.prepare('audio80');
        const [pageSfx, pageMusic, music, sfx] = fake.chips;
        expect([pageMusic.volume, music.volume]).toEqual([toSliderGain(0.3), toSliderGain(0.3)]);
        expect([pageSfx.volume, sfx.volume]).toEqual([0, 0]);
        expect([sfx.isMuted, music.isMuted, pageSfx.isMuted]).toEqual([true, false, false]);
        expect([music.tempoScale, sfx.tempoScale]).toEqual([0.5, 1]);
    });

    it('sets each chip\'s volume from the settings changed after the chips load: the music\'s, or the sound effects\'', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare('audio80');
        sound.settings = { musicVolume: 1, sfxVolume: 0.5 };
        const [pageSfx, pageMusic, music, sfx] = fake.chips;
        expect([pageMusic.volume, music.volume]).toEqual([1, 1]);
        expect([pageSfx.volume, sfx.volume]).toEqual([toSliderGain(0.5), toSliderGain(0.5)]);
    });

    it('mutes every chip, loaded or not', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.isMuted = true;
        await sound.prepare('audio80');
        expect(sound.isMuted).toBe(true);
        for (const loaded of fake.chips) expect(loaded.isMuted).toBe(true);

        sound.isMuted = false;
        for (const loaded of fake.chips) expect(loaded.isMuted).toBe(false);
    });

    it('passes each chip\'s writes on once the chips load', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare('audio80');
        const [pageSfx, , music, sfx] = fake.chips;
        sound.entryChips.audio80.sfx.play(EFFECT);
        sound.entryChips.audio80.music.play(SONG);
        sound.pageSfx.play(EFFECT);
        sound.pageSfx.play(EFFECT);
        expect(listPlays(sfx.log)).toEqual([EFFECT]);
        expect([music.song, sound.entryChips.audio80.music.song]).toEqual([SONG, SONG]);
        expect(listPlays(pageSfx.log)).toEqual([EFFECT, EFFECT]);
    });

    it('passes a pause on to a chip that loads after it', async () => {
        const sound = createPageSound({ isEnabled: true });
        const { music } = sound.entryChips.audio80;
        music.pause();
        await sound.prepare('audio80');
        const [, , loadedMusic, loadedSfx] = fake.chips;
        expect([music.isPaused, loadedMusic.isPaused, loadedSfx.isPaused]).toEqual([true, true, false]);
        music.resume();
        expect(loadedMusic.isPaused).toBe(false);
    });

    it('loads the chips once, however often it is prepared', async () => {
        const sound = createPageSound({ isEnabled: true });
        await Promise.all([sound.prepare('audio80'), sound.prepare('audio80'), sound.prepare()]);
        await sound.prepare('audio80');
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(PAGE_CHIPS + ENTRY_CHIPS);
    });

    it('makes the audio context inside `prepare`, before it waits for anything', async () => {
        const sound = createPageSound({ isEnabled: true });
        const preparing = sound.prepare('audio80');
        // A browser such as Safari starts audio only for a context made or resumed inside the gesture
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(0);
        await preparing;
        expect(fake.chips).toHaveLength(PAGE_CHIPS + ENTRY_CHIPS);
    });

    it('starts a suspended context on the next gesture, which can be the end of a touch', async () => {
        fake.initialState = 'suspended';
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        const [context] = fake.contexts;
        expect(context.state).toBe('suspended');

        window.dispatchEvent(new Event('touchend'));
        await Promise.resolve();
        expect(context.state).toBe('running');
        expect(context.resumeCount).toBe(1);

        // Once it runs, gestures are no longer listened for
        window.dispatchEvent(new Event('keydown'));
        expect(context.resumeCount).toBe(1);
        sound.destroy();
    });

    it('starts a context again on the next gesture after the browser stops it', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        const [context] = fake.contexts;
        window.dispatchEvent(new Event('touchend'));
        expect(context.resumeCount).toBe(0);

        // As on a phone that takes a call
        context.setState('interrupted');
        window.dispatchEvent(new Event('touchend'));
        await Promise.resolve();
        expect(context.state).toBe('running');
        expect(context.resumeCount).toBe(1);
        sound.destroy();
    });

    it('tries the import again on the next `prepare` after a download fails', async () => {
        // The chip's code is loaded afresh, as by a page that has not loaded it yet
        vi.doMock('./web-chips', async () => (await import('./fake-web-audio')).importFakeWebAudio());
        fake.failsNextImport = true;
        const sound = createPageSound({ isEnabled: true });
        await expect(sound.prepare('audio80')).resolves.toBeUndefined();
        expect(fake.chips).toHaveLength(0);

        await sound.prepare('audio80');
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(PAGE_CHIPS + ENTRY_CHIPS);
    });

    it('makes no chips when it is destroyed while the code loads, and closes the context', async () => {
        const sound = createPageSound({ isEnabled: true });
        const preparing = sound.prepare('audio80');
        sound.destroy();
        await preparing;
        expect(fake.chips).toHaveLength(0);
        expect(fake.contexts[0].state).toBe('closed');
    });

    it('makes no context once it is destroyed', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.destroy();
        await sound.prepare('audio80');
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
    });

    it('makes no context on a page that cannot run an AudioWorklet, and warns once', async () => {
        uninstallFakeWebAudio();
        fake = installFakeWebAudio({ isSecure: false });
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare('audio80');
        await sound.prepare('audio80');
        sound.entryChips.audio80.sfx.play(EFFECT);
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('loads nothing for sound that is not enabled, and stays silent', async () => {
        const sound = createPageSound({ isEnabled: false });
        await sound.prepare('audio80');
        sound.entryChips.audio80.sfx.play(EFFECT);
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EFFECT = createAudio80Sound({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 }, note: 'C-5', lengthMs: 50 });
/** The page's own chips, one for its sounds and one for its music, which it loads first. */
const PAGE_CHIPS = 2;
/** The chips of one kind that entries play on: one for their music, then one for their sound effects. */
const ENTRY_CHIPS = 2;
const SONG = createAudio80Song({ bpm: 120, instruments: { s: EFFECT }, patterns: { p: '| C-4 s' }, order: ['p'] });

/** Returns the sound effects played, in order. */
function listPlays(log: readonly Audio80Write[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { sound: unknown }).sound);
}
