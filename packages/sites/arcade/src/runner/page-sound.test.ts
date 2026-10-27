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
        const entry = sound.entryChips.audio80;
        expect(() => {
            entry.stop(entry.play(EFFECT, { lengthMs: Infinity }));
            entry.play(SONG);
            entry.stop();
            sound.pageAudio80.play(EFFECT);
        }).not.toThrow();
        expect([entry.time, entry.song]).toEqual([0, undefined]);
        await expect(entry.ready).resolves.toBeUndefined();

        await sound.prepare('audio80');
        const [pageChip, chip] = fake.chips;
        expect(chip.log).toEqual([]);
        expect(pageChip.log).toEqual([]);
    });

    it('loads only the page\'s own chip when no entry chip is asked for', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        expect(fake.chips).toHaveLength(1);
        sound.pageAudio80.play(EFFECT);
        expect(listPlays(fake.chips[0].log)).toEqual([EFFECT]);

        await sound.prepare('audio80');
        expect(fake.chips).toHaveLength(2);
        expect(fake.audio90Chips).toHaveLength(0);
    });

    it('loads the Audio90 only when an entry that plays on it is prepared, with the settings and mute set before', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.settings = { musicVolume: 0.3, effectsVolume: 0.8 };
        sound.isMuted = true;
        await sound.prepare('audio80');
        expect(fake.audio90Chips).toHaveLength(0);

        await sound.prepare('audio90');
        await sound.prepare('audio90');
        expect(fake.audio90Chips).toHaveLength(1);
        const [chip] = fake.audio90Chips;
        expect([chip.musicVolume, chip.effectsVolume]).toEqual([toSliderGain(0.3), toSliderGain(0.8)]);
        expect(chip.isMuted).toBe(true);
        sound.entryChips.audio90.setTempo(120);
        expect(chip.log).toEqual([{ kind: 'set-tempo', bpm: 120, time: 0 }]);
        sound.destroy();
    });

    it('gives the chips the settings and volumes set before they loaded', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.settings = { musicVolume: 0.3, effectsVolume: 0 };
        sound.entryChips.audio80.isMuted = true;
        sound.entryChips.audio80.tempoScale = 0.5;
        sound.pageAudio80.volume = 0.4;

        await sound.prepare('audio80');
        const [pageChip, chip] = fake.chips;
        for (const loaded of [chip, pageChip]) {
            expect(loaded.musicVolume).toBe(toSliderGain(0.3));
            expect(loaded.effectsVolume).toBe(0);
        }
        expect(chip.isMuted).toBe(true);
        expect(pageChip.isMuted).toBe(false);
        expect(pageChip.volume).toBe(0.4);
        expect(chip.volume).toBe(1);
        expect([chip.tempoScale, pageChip.tempoScale]).toEqual([0.5, 1]);
    });

    it('applies settings changed after the chips load', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare('audio80');
        sound.settings = { musicVolume: 1, effectsVolume: 0.5 };
        for (const loaded of fake.chips) {
            expect(loaded.musicVolume).toBe(1);
            expect(loaded.effectsVolume).toBe(toSliderGain(0.5));
        }
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
        const [pageChip, chip] = fake.chips;
        sound.entryChips.audio80.play(EFFECT);
        sound.entryChips.audio80.play(SONG);
        sound.pageAudio80.play(EFFECT);
        sound.pageAudio80.play(EFFECT);
        expect(listPlays(chip.log)).toEqual([EFFECT]);
        expect([chip.song, sound.entryChips.audio80.song]).toEqual([SONG, SONG]);
        expect(listPlays(pageChip.log)).toEqual([EFFECT, EFFECT]);
    });

    it('pauses every chip while the page is hidden, and plays each on as it shows, but one paused itself', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare('audio80');
        const [pageChip, chip] = fake.chips;
        const entry = sound.entryChips.audio80;
        entry.pause();
        sound.isHidden = true;
        expect([pageChip.isPaused, chip.isPaused]).toEqual([true, true]);
        sound.isHidden = false;
        expect([pageChip.isPaused, chip.isPaused]).toEqual([false, true]);
        expect(entry.isPaused).toBe(true);
        entry.resume();
        expect(chip.isPaused).toBe(false);
    });

    it('pauses a chip that loads while the page is hidden, or while it is paused itself', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.isHidden = true;
        sound.entryChips.audio80.pause();
        await sound.prepare('audio80');
        const [pageChip, chip] = fake.chips;
        expect([pageChip.isPaused, chip.isPaused]).toEqual([true, true]);
        sound.isHidden = false;
        expect([pageChip.isPaused, chip.isPaused]).toEqual([false, true]);
    });

    it('loads the chips once, however often it is prepared', async () => {
        const sound = createPageSound({ isEnabled: true });
        await Promise.all([sound.prepare('audio80'), sound.prepare('audio80'), sound.prepare()]);
        await sound.prepare('audio80');
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(2);
    });

    it('makes the audio context inside `prepare`, before it waits for anything', async () => {
        const sound = createPageSound({ isEnabled: true });
        const preparing = sound.prepare('audio80');
        // A browser such as Safari starts audio only for a context made or resumed inside the gesture
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(0);
        await preparing;
        expect(fake.chips).toHaveLength(2);
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
        expect(fake.chips).toHaveLength(2);
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
        sound.entryChips.audio80.play(EFFECT);
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('loads nothing for sound that is not enabled, and stays silent', async () => {
        const sound = createPageSound({ isEnabled: false });
        await sound.prepare('audio80');
        sound.entryChips.audio80.play(EFFECT);
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EFFECT = createAudio80Sound({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 }, note: 'C-5', lengthMs: 50 });
const SONG = createAudio80Song({ bpm: 120, instruments: { s: EFFECT }, patterns: { p: '| C-4 s' }, order: ['p'] });

/** Returns the sound effects played, in order. */
function listPlays(log: readonly Audio80Write[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { sound: unknown }).sound);
}
