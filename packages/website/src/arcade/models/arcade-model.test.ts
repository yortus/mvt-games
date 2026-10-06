import { describe, expect, it } from 'vitest';
import type { ArcadeEntry, EntryFacts, EntryStarter, EntryTags } from '../../entry-types';
import { createArcadeModel, type ArcadeModelOptions } from './arcade-model';

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

        it('shows entries whose summaries, descriptions or techniques have a word beginning with each word typed', () => {
            const model = createArcadeModel(options());
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

        it('clears the words when a chip is chosen', () => {
            const model = createArcadeModel(options());
            model.searchText = 'sim';
            choose(model, 'genre', 'simulation');
            expect(model.searchText).toBe('');
            expect(model.activeChipAt(0)).toBe(chipIndex(model, 'genre', 'simulation'));
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
        it('loads an entry, holds it ready, then plays it when told', async () => {
            const model = createArcadeModel(options());
            model.launch('maze-game');
            expect(model.phase).toBe('loading');
            expect(model.activeEntry?.id).toBe('maze-game');
            await settle();
            expect(model.phase).toBe('ready');
            expect(model.starter).toBe(STARTER);
            model.startPlaying();
            expect(model.phase).toBe('playing');
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

        it('pauses only a playing entry, and unpauses on restart and exit', async () => {
            const model = createArcadeModel(options());
            model.isPaused = true;
            expect(model.isPaused).toBe(false);
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

    describe('the info panels', () => {
        it('opens one at a time: an entry\'s, or the arcade\'s', () => {
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
    },
    { ...entry('shooter-game', 'Shooter Game', { kind: 'game', era: '1980s', genres: ['shooter'] }), techniques: ['Object pooling'] },
    { ...entry('sim-demo', 'Sim Demo', { kind: 'demo', genres: ['simulation', '3d'] }), description: 'Birds flocking, in 3D.' },
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
        ...overrides,
    };
}

function entry(id: string, name: string, tags: EntryTags): ArcadeEntry {
    return {
        id, name, tags,
        summary: '', description: '', screenWidth: 100, screenHeight: 100, thumbnail: '',
        load: () => Promise.resolve(STARTER),
    };
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

async function play(model: ReturnType<typeof createArcadeModel>, id: string): Promise<void> {
    model.launch(id);
    await settle();
    model.startPlaying();
}

/** Lets loads that have finished report back. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
