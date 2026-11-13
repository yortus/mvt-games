import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CHEAT_SHEETS, LEFT_OUT, type ReferenceEntry } from '../cheat-sheets';
import { type MadeReferenceSheets, makeReferenceSheets } from './make-reference-sheets';

// Each run loads every library's types, which takes a few seconds
const RUN_MS = 60_000;

describe('the cheat sheets', () => {
    let made: MadeReferenceSheets;
    beforeAll(() => {
        made = makeReferenceSheets({ sheets: CHEAT_SHEETS, leftOut: LEFT_OUT });
    }, RUN_MS);

    it('name only what the libraries export, and show every export of this repo\'s libraries, or leave it out with a reason', () => {
        expect(made.problems).toEqual([]);
    });

    it('take each signature and summary from the library\'s declarations', () => {
        const setRefresh = findEntry(made, 'setRefresh');
        expect(setRefresh.summary).toMatch(/^Sets `view`'s refresh method/);
        expect(findEntry(made, 'Graphics.circle').signature).toBe('Graphics.circle(x: number, y: number, radius: number): Graphics');
        expect(findEntry(made, 'Audio80.play').summary).toMatch(/^Plays a sound or a song/);
    });

    it('import the view tick API from each renderer\'s own package', () => {
        const setRefresh = findEntry(made, 'setRefresh');
        expect(setRefresh.importLineFor).toEqual({
            pixi: "import { setRefresh } from '@mvtjs/pixi';",
            html: "import { setRefresh } from '@mvtjs/html';",
            three: "import { setRefresh } from '@mvtjs/three';",
        });
        expect(findEntry(made, 'watch').importLineFor).toBeUndefined();
    });

    it('each have a section in the book\'s Appendix G', () => {
        const appendix = readFileSync(join(import.meta.dirname, '../../docs/appendices/g-api-cheat-sheets.md'), 'utf8');
        for (const sheet of CHEAT_SHEETS) expect(appendix).toContain(`<CheatSheet id="${sheet.id}" />`);
    });

    it('name each chapter as the book cites it', () => {
        expect(findEntry(made, 'createReaction').chapter).toEqual({ path: 'chapters/09-noticing-changes', title: 'Chapter 9, Noticing Changes' });
    });
});

describe('a cheat sheet with mistakes', () => {
    it('reports a name a library doesn\'t export, a missing member, a missing chapter, and exports on no sheet', () => {
        const { problems } = makeReferenceSheets({
            sheets: [{
                id: 'broken',
                title: 'Broken',
                summary: '',
                groups: [{
                    title: 'Mistakes',
                    entries: [
                        { name: 'createNothing', from: '@mvtjs/utils', useFor: '' },
                        { name: 'Graphics.paint', from: 'pixi.js', useFor: '' },
                        { name: 'watch', from: '@mvtjs/utils', useFor: '', chapter: 'chapters/99-nowhere' },
                    ],
                }],
            }],
            leftOut: { notAnExport: 'A name that nothing exports' },
        });
        expect(problems).toContain('Broken: @mvtjs/utils doesn\'t export createNothing.');
        expect(problems).toContain('Broken: Graphics.paint: Graphics has no member paint.');
        expect(problems).toContain('Broken: the book has no page chapters/99-nowhere.');
        expect(problems.some((p) => p.startsWith('createReaction, exported by @mvtjs/utils, is on no cheat sheet.'))).toBe(true);
        expect(problems.some((p) => p.startsWith('LEFT_OUT names notAnExport'))).toBe(true);
    }, RUN_MS);
});

function findEntry(made: MadeReferenceSheets, name: string): ReferenceEntry {
    for (const sheet of made.sheets) {
        for (const group of sheet.groups) {
            const entry = group.entries.find((e) => e.name === name);
            if (entry !== undefined) return entry;
        }
    }
    throw new Error(`No sheet has ${name}`);
}
