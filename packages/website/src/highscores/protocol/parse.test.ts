import { describe, expect, it } from 'vitest';
import { parseRefusalResponse, parseSubmitRequest, parseSubmitResponse, parseTablesResponse } from './parse';

const ROW = { initials: 'AAA', score: 10, at: 0 };

describe('parsing', () => {
    it('reads each shape, and keeps only the fields it knows', () => {
        expect(parseTablesResponse({ tables: { g: [{ ...ROW, extra: 1 }] } })).toEqual({ tables: { g: [ROW] } });
        expect(parseSubmitRequest({ initials: 'AAA', score: 10, extra: 1 })).toEqual({ initials: 'AAA', score: 10 });
        expect(parseSubmitResponse({ table: [ROW], rank: 1 })).toEqual({ table: [ROW], rank: 1 });
        expect(parseSubmitResponse({ table: [ROW] })).toEqual({ table: [ROW] });
        expect(parseRefusalResponse({ refused: 'bad-score', message: 'no' })).toEqual({ refused: 'bad-score', message: 'no' });
    });

    it('refuses anything else', () => {
        for (const json of [undefined, 'text', 1, [], { tables: [] }, { tables: { g: [{ initials: 'AAA', score: '10', at: 0 }] } }]) {
            expect(parseTablesResponse(json)).toBeUndefined();
        }
        for (const json of [undefined, {}, { initials: 'AAA' }, { initials: 3, score: 10 }, { initials: 'AAA', score: '10' }]) {
            expect(parseSubmitRequest(json)).toBeUndefined();
        }
        for (const json of [{}, { table: [ROW], rank: 1.5 }, { table: [ROW], rank: '1' }]) {
            expect(parseSubmitResponse(json)).toBeUndefined();
        }
        for (const json of [{}, { refused: 'nonsense' }, { refused: 'toString' }]) {
            expect(parseRefusalResponse(json)).toBeUndefined();
        }
    });
});
