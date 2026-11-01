import { describe, expect, it } from 'vitest';
import type { ReferenceEntry, ReferenceSheet } from '../../cheat-sheets';
import { createReferenceModel, MAX_MATCHES, USED_ID } from './reference-model';

describe('a reference model', () => {
    it('shows nothing until the sheets load, then the first sheet that suits the renderer', () => {
        const model = createReferenceModel({ renderer: 'html' });
        expect(model.rows).toEqual([]);
        model.sheets = SHEETS;
        expect(model.shownSheets.map((s) => s.id)).toEqual(['tick', 'html-jsx', 'helpers']);
        expect(model.chosenId).toBe('tick');
        expect(model.rows[0]).toEqual({ kind: 'sheet', sheet: TICK });
        expect(model.rows[1]).toEqual({ kind: 'group', title: 'Views' });
        expect(model.rows[2]).toEqual({ kind: 'entry', entry: SET_REFRESH });
    });

    it('shows every sheet when asked, whatever the renderer', () => {
        const model = createReferenceModel({ renderer: 'html', sheets: SHEETS });
        model.isShowingAll = true;
        expect(model.shownSheets).toEqual(SHEETS);
    });

    it('shows the first sheet in place of one chosen that the renderer hides', () => {
        const model = createReferenceModel({ renderer: 'pixi', sheets: SHEETS, chosenId: 'pixi-jsx' });
        expect(model.chosenId).toBe('pixi-jsx');
        model.renderer = 'html';
        expect(model.chosenId).toBe('tick');
    });

    it('makes its rows again only when they change', () => {
        const model = createReferenceModel({ renderer: 'pixi', sheets: SHEETS });
        const rows = model.rows;
        model.renderer = 'pixi';
        model.toggleEntry(SET_REFRESH);
        expect(model.rows).toBe(rows);
        model.chosenId = 'helpers';
        expect(model.rows).not.toBe(rows);
    });

    it('lists the entries that match a search, by name before description, across the sheets shown', () => {
        const model = createReferenceModel({ renderer: 'pixi', sheets: SHEETS });
        model.query = 'Refresh';
        expect(model.rows).toEqual([
            { kind: 'group', title: 'The tick' },
            { kind: 'entry', entry: SET_REFRESH },
            { kind: 'group', title: 'Helpers' },
            { kind: 'entry', entry: WATCH },
        ]);
        model.query = 'zzz';
        expect(model.rows).toEqual([{ kind: 'note', text: 'Nothing on the cheat sheets matches "zzz".' }]);
    });

    it('lists no more than its most matches', () => {
        const many: ReferenceEntry[] = Array.from({ length: MAX_MATCHES + 5 }, (_, i) => ({ ...WATCH, name: `watch${i}` }));
        const model = createReferenceModel({ renderer: 'pixi', sheets: [{ ...HELPERS, groups: [{ title: 'Many', entries: many }] }] });
        model.query = 'watch';
        expect(model.rows.filter((row) => row.kind === 'entry')).toHaveLength(MAX_MATCHES);
    });

    it('lists what the project imports, and the view tick API from any renderer\'s package', () => {
        const model = createReferenceModel({
            renderer: 'html',
            sheets: SHEETS,
            usedNames: [{ name: 'setRefresh', from: '@mvtjs/html' }, { name: 'watch', from: '@mvtjs/utils' }, { name: 'watch', from: 'gsap' }],
            chosenId: USED_ID,
        });
        expect(model.hasUsed).toBe(true);
        expect(model.chosenId).toBe(USED_ID);
        expect(model.rows.filter((row) => row.kind === 'entry')).toEqual([
            { kind: 'entry', entry: SET_REFRESH },
            { kind: 'entry', entry: WATCH },
        ]);
    });

    it('shows the first sheet in place of the list of what the project uses, while it uses nothing on the sheets', () => {
        const model = createReferenceModel({ renderer: 'pixi', sheets: SHEETS, chosenId: USED_ID });
        expect(model.hasUsed).toBe(false);
        expect(model.chosenId).toBe('tick');
    });

    it('opens an entry, and closes it again', () => {
        const model = createReferenceModel({ renderer: 'pixi', sheets: SHEETS });
        model.toggleEntry(WATCH);
        expect(model.openEntry).toBe(WATCH);
        model.toggleEntry(SET_REFRESH);
        expect(model.openEntry).toBe(SET_REFRESH);
        model.toggleEntry(SET_REFRESH);
        expect(model.openEntry).toBeUndefined();
    });

    it('imports the view tick API from the renderer\'s own package', () => {
        const model = createReferenceModel({ renderer: 'three', sheets: SHEETS });
        expect(model.importLineOf(SET_REFRESH)).toBe("import { setRefresh } from '@mvtjs/three';");
        expect(model.importLineOf(WATCH)).toBe("import { watch } from '@mvtjs/utils';");
        expect(model.importLineOf(VISIBLE)).toBeUndefined();
    });
});

const SET_REFRESH: ReferenceEntry = {
    name: 'setRefresh',
    from: '@mvtjs/pixi',
    importLine: "import { setRefresh } from '@mvtjs/pixi';",
    importLineFor: {
        pixi: "import { setRefresh } from '@mvtjs/pixi';",
        html: "import { setRefresh } from '@mvtjs/html';",
        three: "import { setRefresh } from '@mvtjs/three';",
    },
    signature: 'setRefresh(view: View, refresh: RefreshMethod | undefined): void',
    summary: "Sets `view`'s refresh method.",
    useFor: 'Write the model to the view.',
};

const WATCH: ReferenceEntry = {
    name: 'watch',
    from: '@mvtjs/utils',
    importLine: "import { watch } from '@mvtjs/utils';",
    signature: 'watch(getters): Watcher',
    summary: 'Creates a watcher.',
    useFor: 'Poll several values at once, in a refresh step.',
};

const VISIBLE: ReferenceEntry = { name: 'visible', signature: 'visible={() => boolean}', summary: '', useFor: 'Hide an element.' };

const TICK: ReferenceSheet = { id: 'tick', title: 'The tick', summary: '', moreAt: [], groups: [{ title: 'Views', entries: [SET_REFRESH] }] };
const PIXI_JSX: ReferenceSheet = { id: 'pixi-jsx', title: 'JSX', summary: '', renderers: ['pixi'], moreAt: [], groups: [{ title: 'Attributes', entries: [VISIBLE] }] };
const HTML_JSX: ReferenceSheet = { ...PIXI_JSX, id: 'html-jsx', renderers: ['html'] };
const HELPERS: ReferenceSheet = { id: 'helpers', title: 'Helpers', summary: '', moreAt: [], groups: [{ title: 'Watching', entries: [WATCH] }] };
const SHEETS: readonly ReferenceSheet[] = [TICK, PIXI_JSX, HTML_JSX, HELPERS];
