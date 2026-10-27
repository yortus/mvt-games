// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createHeadlessAudio80 } from 'audio90/headless';
import { createMemoryHighscoreStore } from '../../highscores';
import { advanceTime, destroyElement, refreshView } from '@mvtjs/html';
import type { ArcadeEntry, EntryStarter } from '../../entry-types';
import { LAUNCH_MS, REVEAL_MS } from '../data';
import { type ArcadeModel, createArcadeModel, DEFAULT_SOUND_SETTINGS } from '../models';
import { ArcadeView } from './arcade-view';
import { createPerformanceMeter, PerfmonFloatView } from './perfmon-float-view';
import { NO_RECT } from './rect';

describe('ArcadeView', () => {
    describe('the search', () => {
        it('opens from the magnifier in the nav, and closes from it again while empty', () => {
            const { navTools, tick, view } = setUp();
            const slot = view.querySelector<HTMLElement>('.search-slot')!;
            const magnifier = navTools.querySelector<HTMLElement>('.nav-search')!;
            expect(slot.classList.contains('is-open')).toBe(false);
            expect(slot.inert).toBe(true);
            magnifier.click();
            tick();
            expect(slot.classList.contains('is-open')).toBe(true);
            expect(slot.inert).toBe(false);
            expect(magnifier.getAttribute('aria-pressed')).toBe('true');
            magnifier.click();
            tick();
            expect(slot.classList.contains('is-open')).toBe(false);
            destroyElement(view);
        });

        it('stays open while it holds something, even as the focus leaves it', () => {
            const { model, navTools, tick, view } = setUp();
            navTools.querySelector<HTMLElement>('.nav-search')!.click();
            tick();
            model.searchText = 'game';
            view.querySelector<HTMLInputElement>('.search-input')!.dispatchEvent(new Event('blur'));
            tick();
            expect(view.querySelector('.search-slot')!.classList.contains('is-open')).toBe(true);
            model.searchText = '';
            tick();
            expect(view.querySelector('.search-slot')!.classList.contains('is-open')).toBe(false);
            destroyElement(view);
        });

        it('puts a tag chosen from the suggestions in place of the words typed to find it', () => {
            const { model, tick, view } = setUp();
            const maze = model.chips.findIndex((chip) => chip.group === 'genre' && chip.value === 'maze');
            model.searchText = 'ma';
            tick();
            view.querySelector<HTMLElement>(`#search-tag-${maze}`)!.click();
            expect(model.activeChipCount).toBe(1);
            expect(model.activeChipAt(0)).toBe(maze);
            expect(model.searchText).toBe('');
            destroyElement(view);
        });
    });

    describe('the Perfmon', () => {
        it('opens and closes with the gauge in the nav, starting closed', () => {
            const { model, navTools, tick, view } = setUp();
            const gauge = navTools.querySelector<HTMLElement>('.nav-perfmon')!;
            const panel = view.querySelector<HTMLElement>('.perfmon-float')!;
            expect(model.isPerfmonOpen).toBe(false);
            expect(panel.hidden).toBe(true);
            gauge.click();
            tick();
            expect(model.isPerfmonOpen).toBe(true);
            expect(panel.hidden).toBe(false);
            expect(gauge.getAttribute('aria-pressed')).toBe('true');
            gauge.click();
            tick();
            expect(panel.hidden).toBe(true);
            destroyElement(view);
        });
    });

    describe('the nav\'s links to the Arcade', () => {
        it('scroll back to the top, closing a panel, rather than loading the page again', () => {
            const home = document.createElement('a');
            const { model, view } = setUp({ homeLinks: [home] });
            model.openAbout();
            const click = new MouseEvent('click', { button: 0, cancelable: true });
            home.dispatchEvent(click);
            expect(click.defaultPrevented).toBe(true);
            expect(model.isAboutOpen).toBe(false);
            destroyElement(view);
        });

        it('leave a click that opens a new tab alone', () => {
            const home = document.createElement('a');
            const { view } = setUp({ homeLinks: [home] });
            const click = new MouseEvent('click', { button: 0, ctrlKey: true, cancelable: true });
            home.dispatchEvent(click);
            expect(click.defaultPrevented).toBe(false);
            destroyElement(view);
        });
    });

    describe('the info panel over an entry', () => {
        it('pauses the entry as it opens from the bar, and resumes it as it closes', async () => {
            const { model, tick, view } = setUp();
            await playPaused(model);
            model.isPaused = false;
            tick();
            view.querySelector<HTMLElement>('.runner-info')!.click();
            tick();
            expect(model.infoEntry?.id).toBe(ENTRY.id);
            expect(model.isPaused).toBe(true);
            view.querySelector<HTMLElement>('.info-close')!.click();
            tick();
            expect(model.infoEntry).toBeUndefined();
            expect(model.isPaused).toBe(false);
            destroyElement(view);
        });

        it('leaves an entry the visitor paused paused as it closes', async () => {
            const { model, tick, view } = setUp();
            await playPaused(model);
            tick();
            view.querySelector<HTMLElement>('.runner-info')!.click();
            tick();
            view.querySelector<HTMLElement>('.info-play')!.click();
            tick();
            expect(model.infoEntry).toBeUndefined();
            expect(model.isPaused).toBe(true);
            destroyElement(view);
        });
    });

    describe('the note about the Arcade', () => {
        it('opens from the (i) in the nav', () => {
            const { model, navTools, tick, view } = setUp();
            navTools.querySelector<HTMLElement>('.about-button')!.click();
            tick();
            expect(model.isAboutOpen).toBe(true);
            expect(navTools.querySelector<HTMLElement>('.about-note')!.hidden).toBe(false);
            destroyElement(view);
        });
    });

    describe('the sound', () => {
        it('mutes all the sound with the nav\'s speaker, and unmutes it with each sound at the level it had', () => {
            const { model, navTools, tick, view } = setUp();
            const sfxVolume = 0.7;
            model.musicVolume = 0;
            model.sfxVolume = sfxVolume;
            const speaker = navTools.querySelector<HTMLElement>('.nav-sound')!;
            speaker.click();
            tick();
            expect(model.isSoundMuted).toBe(true);
            expect(speaker.classList.contains('is-off')).toBe(true);
            speaker.click();
            tick();
            expect(model.isSoundMuted).toBe(false);
            expect(model.musicVolume).toBe(0);
            expect(model.sfxVolume).toBe(sfxVolume);
            expect(speaker.classList.contains('is-off')).toBe(false);
            destroyElement(view);
        });

        it('brings sound back when the speaker is pressed with both sounds off, each at the level it had', () => {
            const { model, navTools, tick, view } = setUp();
            const musicVolume = 0.3;
            const sfxVolume = 0.6;
            model.musicVolume = musicVolume;
            model.sfxVolume = sfxVolume;
            model.turnMusicOff();
            model.turnSfxOff();
            tick();
            const speaker = navTools.querySelector<HTMLElement>('.nav-sound')!;
            expect(speaker.classList.contains('is-off')).toBe(true);
            speaker.click();
            tick();
            expect(model.musicVolume).toBe(musicVolume);
            expect(model.sfxVolume).toBe(sfxVolume);
            expect(speaker.classList.contains('is-off')).toBe(false);
            destroyElement(view);
        });

        it('brings sound back at the default volumes when the speaker is pressed with both sounds slid to 0', () => {
            const { model, navTools, tick, view } = setUp();
            model.musicVolume = 0;
            model.sfxVolume = 0;
            navTools.querySelector<HTMLElement>('.nav-sound')!.click();
            tick();
            expect(model.isSoundMuted).toBe(false);
            expect(model.musicVolume).toBe(DEFAULT_SOUND_SETTINGS.musicVolume);
            expect(model.sfxVolume).toBe(DEFAULT_SOUND_SETTINGS.sfxVolume);
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
    loadDetails: () => Promise.resolve({ description: '' }),
    screenWidth: 100,
    screenHeight: 100,
    thumbnail: '',
    load: () => Promise.resolve(STARTER),
};

const PERFMON = { PerfmonFloatView, createPerformanceMeter };

function setUp(options: { homeLinks?: readonly HTMLElement[] } = {}): { model: ArcadeModel; navTools: HTMLElement; view: Element; tick: () => void } {
    const model = createArcadeModel({
        entries: [ENTRY],
        factsFor: () => undefined,
        loadEntry: () => Promise.resolve(STARTER),
        highscoreStore: createMemoryHighscoreStore(),
    });
    const navTools = document.createElement('div');
    const audio80 = createHeadlessAudio80();
    const view = ArcadeView({
        model,
        stage: document.createElement('div'),
        playRectFor: () => NO_RECT,
        exitFrame: () => undefined,
        isMotionReduced: () => false,
        liveEntry: () => undefined,
        isLiveShowing: () => false,
        navTools,
        pageSfx: audio80,
        pageMusic: audio80,
        audioViews: () => undefined,
        isSoundOffByDefault: () => false,
        isTurned: () => false,
        entryHref: (entry) => `/arcade/${entry.id}/`,
        docsHref: '/docs/',
        performance: () => undefined,
        unmeasuredMetrics: () => [],
        // As loaded, so the panel is built
        perfmon: () => PERFMON,
        homeLinks: options.homeLinks,
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
    await advanceTime(LAUNCH_MS + REVEAL_MS, model);
    model.isPaused = true;
}

function notStarted(): never {
    throw new Error('not started in these tests');
}
