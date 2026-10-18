import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import { createMemoryHighscoreStore, type HighscoreStore } from '../../highscores';
import type { ArcadeEntry, EntryDetails, EntryFacts, EntryStarter, EntryTags } from '../../entry-types';
import { LAUNCH_MS, REVEAL_MS } from '../data';
import { createArcadeModel, type ArcadeModelOptions } from './arcade-model';
import { DEFAULT_SOUND_SETTINGS } from './sound-settings';

describe('ArcadeModel', () => {
    describe('picking entries', () => {
        it('shows every entry, by name, with nothing searched for', () => {
            const model = createArcadeModel(options());
            expect(shownIds(model)).toEqual(['maze-game', 'old-shooter', 'shooter-game', 'sim-demo']);
        });

        it('offers a chip for each tag some entry has, and none for the rest', () => {
            const model = createArcadeModel(options());
            const chips = model.chips.map((c) => `${c.group}:${c.value}`);
            expect(chips).toContain('kind:game');
            expect(chips).toContain('kind:demo');
            expect(chips).not.toContain('kind:art');
            expect(chips).toContain('renderer:three');
        });

        it('shows only entries with every tag chosen, in a group or across groups', () => {
            const model = createArcadeModel(options());
            choose(model, 'genre', 'simulation');
            choose(model, 'genre', '3d');
            expect(shownIds(model)).toEqual(['sim-demo']);
            choose(model, 'genre', 'maze');
            expect(shownIds(model)).toEqual([]);
        });

        it('narrows with each group\'s tags', () => {
            const model = createArcadeModel(options());
            choose(model, 'kind', 'game');
            choose(model, 'era', '1980s');
            expect(shownIds(model)).toEqual(['maze-game', 'shooter-game']);
        });

        it('filters by the renderers measured from the source', () => {
            const model = createArcadeModel(options());
            choose(model, 'renderer', 'three');
            expect(shownIds(model)).toEqual(['sim-demo']);
        });

        it('counts what each chip would show, given the tags chosen, and no words', () => {
            const model = createArcadeModel(options());
            choose(model, 'kind', 'game');
            model.searchText = 'maze';
            // Games in the 1980s: two. In the 1970s: one. Simulations, or demos, among games: none
            expect(countOf(model, 'era', '1980s')).toBe(2);
            expect(countOf(model, 'era', '1970s')).toBe(1);
            expect(countOf(model, 'genre', 'simulation')).toBe(0);
            expect(countOf(model, 'kind', 'demo')).toBe(0);
        });

        it('offers only chips that would narrow the search', () => {
            const model = createArcadeModel(options());
            choose(model, 'kind', 'game');
            // Some games are from the 1980s, and some not
            expect(isOffered(model, 'era', '1980s')).toBe(true);
            // No game is a simulation, every game draws with Pixi, and games are chosen already
            expect(isOffered(model, 'genre', 'simulation')).toBe(false);
            expect(isOffered(model, 'renderer', 'pixi')).toBe(false);
            expect(isOffered(model, 'kind', 'game')).toBe(false);
        });

        it('shows entries whose names hold each word typed, or whose tags begin with it', () => {
            const model = createArcadeModel(options());
            model.searchText = 'SHOOTER';
            expect(shownIds(model)).toEqual(['old-shooter', 'shooter-game']);
            model.searchText = 'old shoot';
            expect(shownIds(model)).toEqual(['old-shooter']);
            // 'sim' begins a genre, and 'thr' a renderer: both find the demo
            model.searchText = 'sim';
            expect(shownIds(model)).toEqual(['sim-demo']);
            model.searchText = 'thr';
            expect(shownIds(model)).toEqual(['sim-demo']);
            // Inside a tag is not enough: 'ulation' is in no name
            model.searchText = 'ulation';
            expect(shownIds(model)).toEqual([]);
        });

        it('shows entries whose summaries, descriptions or techniques have a word beginning with each word typed', async () => {
            const model = createArcadeModel(options());
            model.loadDetails();
            await settle();
            model.searchText = 'flock';
            expect(shownIds(model)).toEqual(['sim-demo']);
            model.searchText = 'asteroids';
            expect(shownIds(model)).toEqual(['old-shooter']);
            model.searchText = 'pool';
            expect(shownIds(model)).toEqual(['shooter-game']);
            // The start of a word, not the inside of one: 'ocking' begins none
            model.searchText = 'ocking';
            expect(shownIds(model)).toEqual([]);
        });

        it('searches an entry\'s description and techniques once they have loaded, and its summary from the start', async () => {
            const model = createArcadeModel(options());
            model.searchText = 'flock';
            expect(shownIds(model)).toEqual([]);
            model.searchText = 'asteroids';
            expect(shownIds(model)).toEqual(['old-shooter']);
            model.loadDetails();
            await settle();
            expect(shownIds(model)).toEqual(['old-shooter']);
            model.searchText = 'flock';
            expect(shownIds(model)).toEqual(['sim-demo']);
        });

        it('shows the entries a search finds as their long text arrives, with no change of query', async () => {
            const model = createArcadeModel(options({ search: '?q=flock' }));
            const revision = model.queryRevision;
            expect(shownIds(model)).toEqual([]);
            model.loadDetails();
            await settle();
            expect(shownIds(model)).toEqual(['sim-demo']);
            expect(model.queryRevision).toBe(revision);
        });

        it('shows entries inspired by a game whose title has a word beginning with each word typed', () => {
            const model = createArcadeModel(options());
            model.searchText = 'grid run';
            expect(shownIds(model)).toEqual(['maze-game']);
        });

        it('applies the words and the tags together', () => {
            const model = createArcadeModel(options());
            choose(model, 'era', '1980s');
            model.searchText = 'game';
            expect(shownIds(model)).toEqual(['maze-game', 'shooter-game']);
        });

        it('leaves the words as they are when a chip is chosen', () => {
            const model = createArcadeModel(options());
            model.searchText = 'sim';
            choose(model, 'genre', 'simulation');
            expect(model.searchText).toBe('sim');
            expect(model.activeChipAt(0)).toBe(chipIndex(model, 'genre', 'simulation'));
            expect(shownIds(model)).toEqual(['sim-demo']);
        });

        it('keeps the active chips in the order they were chosen', () => {
            const model = createArcadeModel(options());
            choose(model, 'genre', 'shooter');
            choose(model, 'kind', 'game');
            choose(model, 'era', '1980s');
            model.removeChipAt(chipIndex(model, 'kind', 'game'));
            choose(model, 'kind', 'game');
            const chosen = [];
            for (let p = 0; p < model.activeChipCount; p++) chosen.push(model.chips[model.activeChipAt(p)].value);
            expect(chosen).toEqual(['shooter', '1980s', 'game']);
        });

        it('removes a chip', () => {
            const model = createArcadeModel(options());
            choose(model, 'kind', 'demo');
            model.removeChipAt(chipIndex(model, 'kind', 'demo'));
            expect(model.activeChipCount).toBe(0);
            expect(model.shownCount).toBe(ENTRIES.length);
        });

        it('clears the tags and the words', () => {
            const model = createArcadeModel(options());
            choose(model, 'kind', 'game');
            choose(model, 'era', '1980s');
            model.searchText = 'maze';
            expect(model.activeChipCount).toBe(2);
            model.clearSearch();
            expect(model.activeChipCount).toBe(0);
            expect(model.searchText).toBe('');
            expect(model.shownCount).toBe(ENTRIES.length);
        });

        it('starts with the search in the page\'s query', () => {
            const model = createArcadeModel(options({ search: '?kind=game&q=shoot' }));
            expect(shownIds(model)).toEqual(['old-shooter', 'shooter-game']);
            expect(model.searchText).toBe('shoot');
        });

        it('counts each change of tags or words', () => {
            const model = createArcadeModel(options());
            const before = model.queryRevision;
            choose(model, 'kind', 'game');
            model.searchText = 'maze';
            model.searchText = 'maze';
            model.removeChipAt(chipIndex(model, 'kind', 'demo'));
            expect(model.queryRevision).toBe(before + 2);
            expect(model.query.active.kind.has('game')).toBe(true);
            expect(model.query.text).toBe('maze');
        });
    });

    describe('running an entry', () => {
        it('loads an entry, starts it once the way in has had its time, and lets it run once it is revealed', async () => {
            const model = createArcadeModel(options());
            model.launch('maze-game');
            expect(model.phase).toBe('launching');
            expect(model.activeEntry?.id).toBe('maze-game');
            await settle();
            expect(model.starter).toBe(STARTER);
            // Loaded already, but the way out of the wall takes its time
            await advanceTime(LAUNCH_MS - 1, model);
            expect(model.phase).toBe('launching');
            expect(model.isEntryStarted).toBe(false);
            await advanceTime(1, model);
            expect(model.phase).toBe('revealing');
            expect(model.isEntryStarted).toBe(true);
            expect(model.isEntryFrozen).toBe(true);
            await advanceTime(REVEAL_MS - 1, model);
            expect(model.phase).toBe('revealing');
            await advanceTime(1, model);
            expect(model.phase).toBe('playing');
            expect(model.isEntryFrozen).toBe(false);
        });

        it('counts how long each phase has lasted', async () => {
            const model = createArcadeModel(options());
            model.launch('maze-game');
            expect(model.elapsedMs).toBe(0);
            await advanceTime(100, model);
            expect(model.elapsedMs).toBe(100);
            await advanceTime(LAUNCH_MS - 100 + 40, model);
            expect(model.phase).toBe('revealing');
            expect(model.elapsedMs).toBeLessThan(40);
        });

        it('waits in launching for a slow load, for as long as it takes', async () => {
            let finishLoad: (starter: EntryStarter) => void = () => undefined;
            const model = createArcadeModel(options({
                loadEntry: () => new Promise((resolve) => {
                    finishLoad = resolve;
                }),
            }));
            model.launch('maze-game');
            await advanceTime(LAUNCH_MS * 3, model);
            expect(model.phase).toBe('launching');
            finishLoad(STARTER);
            await settle();
            await advanceTime(16, model);
            expect(model.phase).toBe('revealing');
        });

        it('starts an entry launched directly as soon as it has loaded, with no wall to leave', async () => {
            const model = createArcadeModel(options());
            model.launch('maze-game', { isDirect: true });
            await settle();
            await advanceTime(16, model);
            expect(model.phase).toBe('revealing');
            // The next launch from the wall takes its time again
            model.exit();
            model.launch('maze-game');
            await settle();
            await advanceTime(16, model);
            expect(model.phase).toBe('launching');
        });

        it('leaves an entry from any phase, and the next launch starts afresh', async () => {
            const model = createArcadeModel(options());
            await start(model, 'maze-game');
            model.exit();
            expect(model.phase).toBe('browsing');
            expect(model.isEntryStarted).toBe(false);
            expect(model.isEntryFrozen).toBe(false);
            await advanceTime(REVEAL_MS, model);
            expect(model.phase).toBe('browsing');
            model.launch('maze-game');
            expect(model.elapsedMs).toBe(0);
        });

        it('launches only from the wall, and only entries it lists', () => {
            const model = createArcadeModel(options());
            model.launch('no-such-entry');
            expect(model.phase).toBe('browsing');
            model.launch('maze-game');
            model.launch('sim-demo');
            expect(model.activeEntry?.id).toBe('maze-game');
        });

        it('ignores a load that finishes after the visitor has left', async () => {
            const model = createArcadeModel(options());
            model.launch('maze-game');
            model.exit();
            await settle();
            expect(model.phase).toBe('browsing');
            expect(model.starter).toBeUndefined();
            // The entry left stays active, for the page to go back to its card
            expect(model.activeEntry?.id).toBe('maze-game');
        });

        it('goes back to the wall, saying why, when a load fails', async () => {
            const model = createArcadeModel(options({ loadEntry: () => Promise.reject(new Error('offline')) }));
            model.launch('sim-demo');
            await settle();
            expect(model.phase).toBe('browsing');
            expect(model.loadFailure).toContain('Sim Demo');
            expect(model.loadFailure).toContain('offline');
            model.dismissLoadFailure();
            expect(model.loadFailure).toBeUndefined();
        });

        it('pauses only an entry started, and one paused as it is revealed stays paused as it plays', async () => {
            const model = createArcadeModel(options());
            model.isPaused = true;
            expect(model.isPaused).toBe(false);
            model.launch('maze-game');
            model.isPaused = true;
            expect(model.isPaused).toBe(false);
            model.exit();
            await start(model, 'maze-game');
            model.isPaused = true;
            expect(model.isPaused).toBe(true);
            await advanceTime(REVEAL_MS, model);
            expect(model.phase).toBe('playing');
            expect(model.isPaused).toBe(true);
            expect(model.isEntryFrozen).toBe(true);
            model.isPaused = false;
            expect(model.isEntryFrozen).toBe(false);
        });

        it('unpauses on restart and exit', async () => {
            const model = createArcadeModel(options());
            await play(model, 'maze-game');
            model.isPaused = true;
            expect(model.isPaused).toBe(true);
            model.restart();
            expect(model.isPaused).toBe(false);
            expect(model.restartCount).toBe(1);
            model.isPaused = true;
            model.exit();
            expect(model.isPaused).toBe(false);
            expect(model.phase).toBe('browsing');
        });

        it('closes the info panels on launch', () => {
            const model = createArcadeModel(options());
            model.openInfo('sim-demo');
            expect(model.infoEntry?.id).toBe('sim-demo');
            model.launch('sim-demo');
            expect(model.infoEntry).toBeUndefined();
            model.exit();
            model.openAbout();
            model.launch('sim-demo');
            expect(model.isAboutOpen).toBe(false);
        });
    });

    describe('highscores', () => {
        it('freezes the entry while a score of its places, and lets it run when the placing closes', async () => {
            const model = createArcadeModel(options());
            await start(model, 'maze-game');
            // Still as it is revealed, then running
            expect(model.isEntryFrozen).toBe(true);
            await advanceTime(REVEAL_MS, model);
            expect(model.isEntryFrozen).toBe(false);
            model.runEnded(10);
            expect(model.highscores.placing).toBe('asking');
            expect(model.highscores.placingEntryId).toBe('maze-game');
            expect(model.isEntryFrozen).toBe(true);
            // The pause menu does not open over it
            model.isPaused = true;
            expect(model.isPaused).toBe(false);
            model.highscores.close();
            expect(model.isEntryFrozen).toBe(false);
            model.isPaused = true;
            expect(model.isEntryFrozen).toBe(true);
        });

        it('takes over from the pause menu if the visitor paused as the run ended', async () => {
            const model = createArcadeModel(options());
            await play(model, 'maze-game');
            model.isPaused = true;
            model.runEnded(10);
            expect(model.isPaused).toBe(false);
            expect(model.highscores.placing).toBe('asking');
        });

        it('ignores the end of a run of an entry without a table, or not playing', async () => {
            const model = createArcadeModel(options());
            model.runEnded(10);
            await play(model, 'shooter-game');
            model.runEnded(10);
            expect(model.highscores.placing).toBe('none');
        });

        it('drops a score placing when the entry restarts or is left', async () => {
            const model = createArcadeModel(options());
            await play(model, 'maze-game');
            model.runEnded(10);
            model.restart();
            expect(model.highscores.placing).toBe('none');
            model.runEnded(10);
            model.exit();
            expect(model.highscores.placing).toBe('none');
        });

        it('asks for the tables again as a game with one starts, and as its info panel opens', async () => {
            const { store, loads } = countingStore();
            const model = createArcadeModel(options({ highscoreStore: store }));
            expect(loads()).toBe(1);
            await play(model, 'shooter-game');
            model.exit();
            model.openInfo('sim-demo');
            expect(loads()).toBe(1);
            await play(model, 'maze-game');
            expect(loads()).toBe(2);
            model.exit();
            model.openInfo('maze-game');
            expect(loads()).toBe(3);
        });
    });

    describe('sound', () => {
        it('starts with the settings it is given, or the defaults', () => {
            expect(createArcadeModel(options()).soundSettings).toEqual(DEFAULT_SOUND_SETTINGS);
            const kept = { ...DEFAULT_SOUND_SETTINGS, musicVolume: 0.1, effectsVolume: 0 };
            expect(createArcadeModel({ ...options(), soundSettings: kept }).soundSettings).toEqual(kept);
        });

        it('replaces its settings with a new object on each change, and only on a change', () => {
            const model = createArcadeModel(options());
            const before = model.soundSettings;
            model.musicVolume = before.musicVolume;
            expect(model.soundSettings).toBe(before);
            const quieter = before.musicVolume / 2;
            model.musicVolume = quieter;
            expect(model.soundSettings).not.toBe(before);
            expect(model.soundSettings).toEqual({ ...before, musicVolume: quieter });
        });

        it('turns a sound off and on again at the volume it had', () => {
            const model = createArcadeModel(options());
            const quieter = DEFAULT_SOUND_SETTINGS.musicVolume / 2;
            model.musicVolume = quieter;
            model.turnMusicOff();
            expect(model.musicVolume).toBe(0);
            model.turnMusicOn();
            expect(model.musicVolume).toBe(quieter);
        });

        it('turns a sound that was slid to 0 on again at the default volume', () => {
            const model = createArcadeModel(options());
            model.effectsVolume = DEFAULT_SOUND_SETTINGS.effectsVolume / 2;
            model.turnEffectsOff();
            model.turnEffectsOn();
            model.effectsVolume = 0;
            model.turnEffectsOn();
            expect(model.effectsVolume).toBe(DEFAULT_SOUND_SETTINGS.effectsVolume);
        });

        it('turns nothing off that is off, and nothing on that is on', () => {
            const model = createArcadeModel(options());
            const before = model.soundSettings;
            model.turnMusicOn();
            expect(model.soundSettings).toBe(before);
            model.turnMusicOff();
            const off = model.soundSettings;
            model.turnMusicOff();
            expect(model.soundSettings).toBe(off);
            expect(model.soundSettings.musicVolumeBeforeOff).toBe(before.musicVolume);
        });

        it('mutes and unmutes all the sound, and leaves a sound slid to 0 off', () => {
            const model = createArcadeModel(options());
            const effectsVolume = 0.7;
            model.musicVolume = 0;
            model.effectsVolume = effectsVolume;
            model.isSoundMuted = true;
            expect(model.soundSettings.isMuted).toBe(true);
            model.isSoundMuted = false;
            expect(model.musicVolume).toBe(0);
            expect(model.effectsVolume).toBe(effectsVolume);
            model.turnMusicOn();
            expect(model.musicVolume).toBe(DEFAULT_SOUND_SETTINGS.musicVolume);
        });

        it('mutes and unmutes all the sound, and leaves a sound turned off still off, with its level kept', () => {
            const model = createArcadeModel(options());
            const musicVolume = 0.3;
            const effectsVolume = 0.7;
            model.musicVolume = musicVolume;
            model.turnMusicOff();
            model.effectsVolume = effectsVolume;
            model.isSoundMuted = true;
            model.isSoundMuted = false;
            expect(model.musicVolume).toBe(0);
            expect(model.effectsVolume).toBe(effectsVolume);
            model.turnMusicOn();
            expect(model.musicVolume).toBe(musicVolume);
        });

        it('leaves its settings object alone when muted twice', () => {
            const model = createArcadeModel(options());
            model.isSoundMuted = true;
            const muted = model.soundSettings;
            model.isSoundMuted = true;
            expect(model.soundSettings).toBe(muted);
        });

        it('keeps volumes between 0 and 1, and turns NaN into 0', () => {
            const model = createArcadeModel(options());
            model.effectsVolume = 1.7;
            expect(model.effectsVolume).toBe(1);
            model.musicVolume = -0.2;
            expect(model.musicVolume).toBe(0);
            model.effectsVolume = Number.NaN;
            expect(model.effectsVolume).toBe(0);
        });
    });

    describe('the info panels', () => {
        it('opens one panel at a time, an entry\'s or the Arcade\'s', () => {
            const model = createArcadeModel(options());
            model.openAbout();
            model.openInfo('sim-demo');
            expect(model.isAboutOpen).toBe(false);
            expect(model.infoEntry?.id).toBe('sim-demo');
            model.openAbout();
            expect(model.infoEntry).toBeUndefined();
        });

        it('opens no panel for an entry it does not list', () => {
            const model = createArcadeModel(options());
            model.openAbout();
            model.openInfo('no-such-entry');
            expect(model.infoEntry).toBeUndefined();
            expect(model.isAboutOpen).toBe(true);
        });

        it('closes only the kind of panel asked', () => {
            const model = createArcadeModel(options());
            model.openAbout();
            model.closeInfo();
            expect(model.isAboutOpen).toBe(true);
            model.closeAbout();
            expect(model.isAboutOpen).toBe(false);
            model.openInfo('sim-demo');
            model.closeAbout();
            expect(model.infoEntry?.id).toBe('sim-demo');
            model.closeInfo();
            expect(model.infoEntry).toBeUndefined();
        });
    });

    describe('the entries\' long text', () => {
        it('has none until it is loaded', () => {
            const model = createArcadeModel(options());
            expect(model.detailsFor('sim-demo')).toBeUndefined();
        });

        it('loads every entry\'s text when asked, each once', async () => {
            const { entries, loadsOf } = countingEntries();
            const model = createArcadeModel(options({ entries }));
            model.loadDetails();
            model.loadDetails();
            await settle();
            expect(model.detailsFor('sim-demo')?.howToPlay?.intro).toBe('Watch.');
            expect(model.detailsFor('no-such-entry')).toBeUndefined();
            for (const e of entries) expect(loadsOf(e.id), e.id).toBe(1);
        });

        it('loads an entry\'s text as its info panel opens, and no other\'s', async () => {
            const { entries, loadsOf } = countingEntries();
            const model = createArcadeModel(options({ entries }));
            model.openInfo('sim-demo');
            await settle();
            expect(model.detailsFor('sim-demo')?.description).toBe('Birds flocking, in 3D.');
            expect(loadsOf('maze-game')).toBe(0);
        });

        it('loads an entry\'s text as it launches, for the pause menu', async () => {
            const model = createArcadeModel(options());
            model.launch('sim-demo');
            await settle();
            expect(model.detailsFor('sim-demo')?.howToPlay?.intro).toBe('Watch.');
        });

        it('asks again for text that failed to load', async () => {
            let fails = 1;
            const flaky: ArcadeEntry = {
                ...ENTRIES[2],
                loadDetails: () => (fails-- > 0 ? Promise.reject(new Error('offline')) : Promise.resolve({ description: 'Back.' })),
            };
            const model = createArcadeModel(options({ entries: [flaky] }));
            model.loadDetails();
            await settle();
            expect(model.detailsFor('sim-demo')).toBeUndefined();
            model.loadDetails();
            await settle();
            expect(model.detailsFor('sim-demo')?.description).toBe('Back.');
        });
    });

    describe('favourites', () => {
        it('shows the favourites first, then the rest, each in order of name', () => {
            const model = createArcadeModel(options());
            model.toggleFavourite('sim-demo');
            model.toggleFavourite('old-shooter');
            expect(shownIds(model)).toEqual(['old-shooter', 'sim-demo', 'maze-game', 'shooter-game']);
            model.toggleFavourite('sim-demo');
            expect(shownIds(model)).toEqual(['old-shooter', 'maze-game', 'shooter-game', 'sim-demo']);
        });

        it('starts with the favourites it is given, dropping any it does not list', () => {
            const model = createArcadeModel(options({ favouriteIds: ['shooter-game', 'no-such-entry'] }));
            expect(model.favouriteIds).toEqual(['shooter-game']);
            expect(model.isFavourite('shooter-game')).toBe(true);
            expect(shownIds(model)[0]).toBe('shooter-game');
        });

        it('replaces its ids as they change, and only then, for the page to save', () => {
            const model = createArcadeModel(options());
            const before = model.favouriteIds;
            model.toggleFavourite('no-such-entry');
            expect(model.favouriteIds).toBe(before);
            model.toggleFavourite('maze-game');
            expect(model.favouriteIds).not.toBe(before);
            expect(model.favouriteIds).toEqual(['maze-game']);
        });

        it('keeps to the search', () => {
            const model = createArcadeModel(options());
            model.toggleFavourite('sim-demo');
            choose(model, 'kind', 'game');
            expect(shownIds(model)).toEqual(['maze-game', 'old-shooter', 'shooter-game']);
        });
    });

    describe('saved games', () => {
        it('offers to resume an entry with a saved game, and holds it still meanwhile', async () => {
            const model = createArcadeModel(options({ hasSavedGame: (id) => id === 'maze-game' }));
            await play(model, 'maze-game');
            expect(model.isResumeOffered).toBe(true);
            expect(model.isEntryFrozen).toBe(true);
            model.isPaused = true;
            expect(model.isPaused).toBe(false);
            model.resume();
            expect(model.isResumeOffered).toBe(false);
            expect(model.isEntryFrozen).toBe(false);
            expect(model.restartCount).toBe(0);
        });

        it('starts afresh when asked, as a restart does, even as the entry is revealed', async () => {
            const model = createArcadeModel(options({ hasSavedGame: () => true }));
            await start(model, 'maze-game');
            expect(model.isResumeOffered).toBe(true);
            model.startAfresh();
            expect(model.isResumeOffered).toBe(false);
            expect(model.restartCount).toBe(1);
            // Once the offer is closed, there is nothing to start afresh from
            model.startAfresh();
            expect(model.restartCount).toBe(1);
        });

        it('offers nothing for an entry without a saved game, or once it is left', async () => {
            const model = createArcadeModel(options({ hasSavedGame: (id) => id === 'maze-game' }));
            await play(model, 'shooter-game');
            expect(model.isResumeOffered).toBe(false);
            model.exit();
            await play(model, 'maze-game');
            model.exit();
            expect(model.isResumeOffered).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STARTER: EntryStarter = { kind: 'element', start: notStarted };

function notStarted(): never {
    throw new Error('not started in these tests');
}

const ENTRIES: readonly ArcadeEntry[] = [
    {
        ...entry('maze-game', 'Maze Game', { kind: 'game', era: '1980s', genres: ['maze'] }),
        inspiredBy: { title: 'Grid Runner', maker: 'Someone', year: 1980 },
        hasHighscores: true,
    },
    entry('shooter-game', 'Shooter Game', { kind: 'game', era: '1980s', genres: ['shooter'] }, { description: '', techniques: ['Object pooling'] }),
    entry('sim-demo', 'Sim Demo', { kind: 'demo', genres: ['simulation', '3d'] }, { description: 'Birds flocking, in 3D.', howToPlay: { intro: 'Watch.' } }),
    { ...entry('old-shooter', 'Old Shooter', { kind: 'game', era: '1970s', genres: ['shooter'] }), summary: 'Rocks and asteroids.' },
];

const FACTS: Record<string, EntryFacts> = {
    'maze-game': facts(['pixi']),
    'shooter-game': facts(['pixi']),
    'sim-demo': facts(['three', 'html']),
    'old-shooter': facts(['pixi']),
};

function options(overrides: Partial<ArcadeModelOptions> = {}): ArcadeModelOptions {
    return {
        entries: ENTRIES,
        factsFor: (id) => FACTS[id],
        loadEntry: () => Promise.resolve(STARTER),
        highscoreStore: createMemoryHighscoreStore(),
        ...overrides,
    };
}

/** An in-memory store that counts the times its tables are asked for. */
function countingStore(): { store: HighscoreStore; loads: () => number } {
    const memory = createMemoryHighscoreStore();
    let loads = 0;
    return {
        store: { ...memory, loadAll: () => (loads++, memory.loadAll()) },
        loads: () => loads,
    };
}

function entry(id: string, name: string, tags: EntryTags, details: EntryDetails = { description: '' }): ArcadeEntry {
    return {
        id, name, tags,
        summary: '', screenWidth: 100, screenHeight: 100, thumbnail: '',
        loadDetails: () => Promise.resolve(details),
        load: () => Promise.resolve(STARTER),
    };
}

/** The test's entries, each counting the times its long text is loaded. */
function countingEntries(): { entries: ArcadeEntry[]; loadsOf: (id: string) => number } {
    const loads = new Map<string, number>();
    const entries = ENTRIES.map((e): ArcadeEntry => ({
        ...e,
        loadDetails: () => {
            loads.set(e.id, (loads.get(e.id) ?? 0) + 1);
            return e.loadDetails();
        },
    }));
    return { entries, loadsOf: (id) => loads.get(id) ?? 0 };
}

function facts(renderers: EntryFacts['renderers']): EntryFacts {
    return { lines: 100, files: 2, renderers, sourcePath: '' };
}

function shownIds(model: ReturnType<typeof createArcadeModel>): string[] {
    const ids: string[] = [];
    for (let i = 0; i < model.shownCount; i++) ids.push(model.entries[model.shownIndexAt(i)].id);
    return ids;
}

function chipIndex(model: ReturnType<typeof createArcadeModel>, group: string, value: string): number {
    const index = model.chips.findIndex((c) => c.group === group && c.value === value);
    if (index < 0) throw new Error(`no chip ${group}:${value}`);
    return index;
}

function choose(model: ReturnType<typeof createArcadeModel>, group: string, value: string): void {
    model.chooseChipAt(chipIndex(model, group, value));
}

function countOf(model: ReturnType<typeof createArcadeModel>, group: string, value: string): number {
    return model.chipCountAt(chipIndex(model, group, value));
}

function isOffered(model: ReturnType<typeof createArcadeModel>, group: string, value: string): boolean {
    return model.isChipOfferedAt(chipIndex(model, group, value));
}

/** Launches the entry with `id`, and steps the model until the entry has started, and is being revealed. */
async function start(model: ReturnType<typeof createArcadeModel>, id: string): Promise<void> {
    model.launch(id);
    await settle();
    await advanceTime(LAUNCH_MS, model);
}

/** Launches the entry with `id`, and steps the model until the entry is playing. */
async function play(model: ReturnType<typeof createArcadeModel>, id: string): Promise<void> {
    await start(model, id);
    await advanceTime(REVEAL_MS, model);
}

/** Lets loads that have finished report back. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
