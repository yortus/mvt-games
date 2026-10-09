// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { destroyElement, refreshView } from '@mvtjs/html';
import type { ArcadeEntry, EntryStarter } from '../../entry-types';
import { type ArcadeModel, createArcadeModel, DEFAULT_SOUND_SETTINGS } from '../models';
import { ArcadeView } from './arcade-view';
import { NO_RECT } from './rect';

describe('ArcadeView', () => {
    describe('the sound', () => {
        it('mutes all the sound with the nav\'s speaker, and unmutes it with each sound at the level it had', () => {
            const { model, navTools, tick, view } = setUp();
            const effectsVolume = 0.7;
            model.musicVolume = 0;
            model.effectsVolume = effectsVolume;
            const speaker = navTools.querySelector<HTMLElement>('.nav-sound')!;
            speaker.click();
            tick();
            expect(model.isSoundMuted).toBe(true);
            expect(speaker.classList.contains('is-off')).toBe(true);
            speaker.click();
            tick();
            expect(model.isSoundMuted).toBe(false);
            expect(model.musicVolume).toBe(0);
            expect(model.effectsVolume).toBe(effectsVolume);
            expect(speaker.classList.contains('is-off')).toBe(false);
            destroyElement(view);
        });

        it('brings sound back when the speaker is pressed with both sounds off, each at the level it had', () => {
            const { model, navTools, tick, view } = setUp();
            const musicVolume = 0.3;
            const effectsVolume = 0.6;
            model.musicVolume = musicVolume;
            model.effectsVolume = effectsVolume;
            model.turnMusicOff();
            model.turnEffectsOff();
            tick();
            const speaker = navTools.querySelector<HTMLElement>('.nav-sound')!;
            expect(speaker.classList.contains('is-off')).toBe(true);
            speaker.click();
            tick();
            expect(model.musicVolume).toBe(musicVolume);
            expect(model.effectsVolume).toBe(effectsVolume);
            expect(speaker.classList.contains('is-off')).toBe(false);
            destroyElement(view);
        });

        it('brings sound back at the default volumes when the speaker is pressed with both sounds slid to 0', () => {
            const { model, navTools, tick, view } = setUp();
            model.musicVolume = 0;
            model.effectsVolume = 0;
            navTools.querySelector<HTMLElement>('.nav-sound')!.click();
            tick();
            expect(model.isSoundMuted).toBe(false);
            expect(model.musicVolume).toBe(DEFAULT_SOUND_SETTINGS.musicVolume);
            expect(model.effectsVolume).toBe(DEFAULT_SOUND_SETTINGS.effectsVolume);
            destroyElement(view);
        });

        it('shows each sound as off in the pause menu while muted, and unmutes as a slider moves', async () => {
            const { model, tick, view } = setUp();
            await playPaused(model);
            model.isSoundMuted = true;
            tick();
            const music = view.querySelector<HTMLInputElement>('#pause-music-volume')!;
            expect(music.valueAsNumber).toBe(0);
            const step = 3;
            music.valueAsNumber = step;
            music.dispatchEvent(new Event('input'));
            expect(model.isSoundMuted).toBe(false);
            expect(model.musicVolume).toBeCloseTo(step / Number(music.max), 9);
            destroyElement(view);
        });

        it('unmutes the sound, and leaves the music on, as the music\'s icon is pressed while muted', () => {
            const { model, tick, view } = setUp();
            const before = model.soundSettings;
            model.isSoundMuted = true;
            tick();
            view.querySelector<HTMLElement>('.sound-control-toggle')!.click();
            expect(model.soundSettings).toEqual(before);
            destroyElement(view);
        });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STARTER: EntryStarter = { kind: 'element', start: notStarted };

const ENTRY: ArcadeEntry = {
    id: 'a-game',
    name: 'A Game',
    tags: { kind: 'game', era: '1980s', genres: ['maze'] },
    summary: '',
    description: '',
    screenWidth: 100,
    screenHeight: 100,
    thumbnail: '',
    load: () => Promise.resolve(STARTER),
};

function setUp(): { model: ArcadeModel; navTools: HTMLElement; view: Element; tick: () => void } {
    const model = createArcadeModel({
        entries: [ENTRY],
        factsFor: () => undefined,
        loadEntry: () => Promise.resolve(STARTER),
    });
    const navTools = document.createElement('div');
    const { audio80 } = createHeadlessAudio80();
    const view = ArcadeView({
        model,
        stage: document.createElement('div'),
        playRectFor: () => NO_RECT,
        exitFrame: () => undefined,
        isMotionReduced: () => false,
        liveEntry: () => undefined,
        isLiveShowing: () => false,
        navTools,
        pageSound: audio80,
        audioViews: () => undefined,
        isSoundOffByDefault: () => false,
    });
    document.body.replaceChildren(view, navTools);
    const tick = (): void => {
        refreshView(view);
        refreshView(navTools);
    };
    tick();
    return { model, navTools, view, tick };
}

/** Plays the entry and pauses it, so the pause menu is open. */
async function playPaused(model: ArcadeModel): Promise<void> {
    model.launch(ENTRY.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    model.startPlaying();
    model.isPaused = true;
}

function notStarted(): never {
    throw new Error('not started in these tests');
}
