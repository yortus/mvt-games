// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstrument, createSoundEffect } from '@mvtjs/audio';
import type { ChipWrite } from '@mvtjs/audio/headless';
import { type FakeWebAudio, installFakeWebAudio, uninstallFakeWebAudio } from './fake-web-audio';
import { createPageSound } from './page-sound';
import { toSliderGain } from './slider-gain';

vi.mock('@mvtjs/audio/web', async () => (await import('./fake-web-audio')).importFakeWebAudio());

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
        expect(() => {
            sound.entryAudio80.play(EFFECT);
            sound.entryAudio80.noteOn(0, INSTRUMENT, 60, 1);
            sound.entryAudio80.releaseAll();
            sound.entryControls.update(TICK_MS);
            sound.entryControls.flush();
            sound.entryControls.reset();
            sound.pageAudio80.play(EFFECT);
            sound.pageControls.update(TICK_MS);
            sound.pageControls.flush();
        }).not.toThrow();
        expect(sound.entryAudio80.time).toBe(0);
        await expect(sound.entryControls.ready).resolves.toBeUndefined();

        await sound.prepare();
        const [chip, pageChip] = fake.chips;
        expect(chip.audio80.log).toEqual([]);
        expect(pageChip.audio80.log).toEqual([]);
    });

    it('gives the chips the settings and volumes set before they loaded', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.settings = { musicVolume: 0.3, effectsVolume: 0 };
        sound.entryControls.isMuted = true;
        sound.pageControls.volume = 0.4;

        await sound.prepare();
        const [chip, pageChip] = fake.chips;
        for (const loaded of [chip, pageChip]) {
            expect(loaded.controls.musicVolume).toBe(toSliderGain(0.3));
            expect(loaded.controls.effectsVolume).toBe(0);
        }
        expect(chip.controls.isMuted).toBe(true);
        expect(pageChip.controls.isMuted).toBe(false);
        expect(pageChip.controls.volume).toBe(0.4);
        expect(chip.controls.volume).toBe(1);
    });

    it('applies settings changed after the chips load', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        sound.settings = { musicVolume: 1, effectsVolume: 0.5 };
        for (const loaded of fake.chips) {
            expect(loaded.controls.musicVolume).toBe(1);
            expect(loaded.controls.effectsVolume).toBe(toSliderGain(0.5));
        }
    });

    it('passes each chip\'s writes and clock on once the chips load', async () => {
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        const [chip, pageChip] = fake.chips;
        sound.entryControls.update(TICK_MS);
        sound.entryAudio80.play(EFFECT);
        sound.pageAudio80.play(EFFECT);
        sound.pageAudio80.play(EFFECT);
        expect(sound.entryAudio80.time).toBe(TICK_MS);
        expect(sound.pageAudio80.time).toBe(0);
        expect(listPlays(chip.audio80.log)).toEqual([EFFECT]);
        expect(listPlays(pageChip.audio80.log)).toEqual([EFFECT, EFFECT]);
    });

    it('loads the chips once, however often it is prepared', async () => {
        const sound = createPageSound({ isEnabled: true });
        await Promise.all([sound.prepare(), sound.prepare()]);
        await sound.prepare();
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(2);
    });

    it('makes the audio context inside `prepare`, before it waits for anything', async () => {
        const sound = createPageSound({ isEnabled: true });
        const preparing = sound.prepare();
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
        vi.doMock('@mvtjs/audio/web', async () => (await import('./fake-web-audio')).importFakeWebAudio());
        fake.failsNextImport = true;
        const sound = createPageSound({ isEnabled: true });
        await expect(sound.prepare()).resolves.toBeUndefined();
        expect(fake.chips).toHaveLength(0);

        await sound.prepare();
        expect(fake.contexts).toHaveLength(1);
        expect(fake.chips).toHaveLength(2);
    });

    it('makes no chips when it is destroyed while the code loads, and closes the context', async () => {
        const sound = createPageSound({ isEnabled: true });
        const preparing = sound.prepare();
        sound.destroy();
        await preparing;
        expect(fake.chips).toHaveLength(0);
        expect(fake.contexts[0].state).toBe('closed');
    });

    it('makes no context once it is destroyed', async () => {
        const sound = createPageSound({ isEnabled: true });
        sound.destroy();
        await sound.prepare();
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
    });

    it('makes no context on a page that cannot run an AudioWorklet, and warns once', async () => {
        uninstallFakeWebAudio();
        fake = installFakeWebAudio({ isSecure: false });
        const sound = createPageSound({ isEnabled: true });
        await sound.prepare();
        await sound.prepare();
        sound.entryAudio80.play(EFFECT);
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('loads nothing for sound that is not enabled, and stays silent', async () => {
        const sound = createPageSound({ isEnabled: false });
        await sound.prepare();
        sound.entryAudio80.play(EFFECT);
        expect(fake.contexts).toHaveLength(0);
        expect(fake.chips).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 60;
const INSTRUMENT = createInstrument({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 } });
const EFFECT = createSoundEffect({ instrument: INSTRUMENT, note: 'C-5', lengthMs: 50 });

/** Returns the sound effects played, in order. */
function listPlays(log: readonly ChipWrite[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { effect: unknown }).effect);
}
