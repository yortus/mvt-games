import { Container, type Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshScene } from '../pixi-mvt';
import { countPropReads } from './prop-reads';
import { jsx } from './jsx-runtime';
import { Match, Switch } from './switch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Boss { hp: number; isEnraged: boolean }

/** The motivating case: branches whose bindings are only valid when they apply. */
function setup(options: { withDefault: boolean }) {
    const model: { boss?: Boss } = {};
    let whenCalls = 0;

    const enraged = jsx('text', { text: () => `ENRAGED ${model.boss!.hp}` });
    const normal = jsx('text', { text: () => `HP ${model.boss!.hp}` });
    const noBoss = jsx('text', { text: 'No boss' });

    const sw = Switch({
        children: [
            Match({
                when: () => {
                    whenCalls++;
                    return model.boss?.isEnraged === true;
                },
                children: enraged,
            }),
            Match({
                when: () => {
                    whenCalls++;
                    return model.boss !== undefined;
                },
                children: normal,
            }),
            ...(options.withDefault ? [Match({ else: true, children: noBoss })] : []),
        ],
    });

    return {
        sw,
        model,
        whenCalls: () => whenCalls,
        resetWhenCalls: () => { whenCalls = 0; },
        text: (t: Container) => (t as Text).text,
        enraged,
        normal,
        noBoss,
        /** Which branches are visible, in order: enraged, normal, then the default if any. */
        shown: () => sw.children.map((c) => c.visible),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Switch', () => {
    it('is inert until its first refresh: no `when` is called at construction', () => {
        const t = setup({ withDefault: true });

        expect(t.whenCalls()).toBe(0);
        expect(t.shown()).toEqual([false, false, false]);
    });

    it('shows the default when no match holds, without running other branches\' bindings', () => {
        const t = setup({ withDefault: true });

        // With no boss, `model.boss!.hp` would throw if either branch refreshed
        expect(() => refreshScene(t.sw)).not.toThrow();
        expect(t.shown()).toEqual([false, false, true]);
    });

    it('shows nothing when no match holds and there is no default', () => {
        const t = setup({ withDefault: false });

        refreshScene(t.sw);

        expect(t.shown()).toEqual([false, false]);
    });

    it('picks the first match that holds', () => {
        const t = setup({ withDefault: true });

        t.model.boss = { hp: 9, isEnraged: false };
        refreshScene(t.sw);
        expect(t.shown()).toEqual([false, true, false]);
        expect(t.text(t.normal)).toBe('HP 9');

        // Both now hold; the first one wins
        t.model.boss.isEnraged = true;
        refreshScene(t.sw);
        expect(t.shown()).toEqual([true, false, false]);
        expect(t.text(t.enraged)).toBe('ENRAGED 9');
    });

    it('refreshes a newly selected branch on the same frame', () => {
        const t = setup({ withDefault: true });
        refreshScene(t.sw);

        t.model.boss = { hp: 3, isEnraged: false };
        refreshScene(t.sw);

        expect(t.text(t.normal)).toBe('HP 3');
    });

    it('stops calling `when` at the first that holds', () => {
        const t = setup({ withDefault: true });
        t.model.boss = { hp: 1, isEnraged: true };
        t.resetWhenCalls();

        refreshScene(t.sw);

        expect(t.whenCalls()).toBe(1);
    });

    it('counts each `when` it calls as a prop read; selecting the default reads nothing', () => {
        let isFirst = false;
        let isSecond = true;
        const sw = Switch({
            children: [
                Match({ when: () => isFirst, children: jsx('container', { x: () => 1 }) }),
                Match({ when: () => isSecond, children: jsx('container', { x: () => 2 }) }),
                Match({ else: true, children: jsx('container', { x: () => 3 }) }),
            ],
        });
        refreshScene(sw);

        // Two conditions, then the second branch's one binding
        expect(countPropReads(() => refreshScene(sw))).toBe(3);

        // Both conditions, then the default, which has no condition, and its one binding
        isSecond = false;
        expect(countPropReads(() => refreshScene(sw))).toBe(3);

        // The first condition holds: one condition, one binding
        isFirst = true;
        expect(countPropReads(() => refreshScene(sw))).toBe(2);
    });

    it('never restructures: switching only changes visibility', () => {
        const t = setup({ withDefault: true });
        refreshScene(t.sw);
        const before = t.sw.children.slice();

        t.model.boss = { hp: 1, isEnraged: false };
        refreshScene(t.sw);
        t.model.boss = undefined;
        refreshScene(t.sw);

        expect(t.sw.children).toEqual(before);
    });

    it('builds a function child on first selection only, and refreshes it that frame', () => {
        let isOn = false;
        let builds = 0;
        const label = 'built';
        const sw = Switch({
            children: Match({
                when: () => isOn,
                children: () => {
                    builds++;
                    return jsx('container', { label: () => label });
                },
            }),
        });

        refreshScene(sw);
        expect(builds).toBe(0);

        isOn = true;
        refreshScene(sw);
        expect(builds).toBe(1);
        expect(sw.children[0].children[0].label).toBe('built');

        isOn = false;
        refreshScene(sw);
        isOn = true;
        refreshScene(sw);
        expect(builds).toBe(1);
    });

    it('rejects a child that is not a <Match>', () => {
        expect(() => Switch({ children: new Container() })).toThrow(/<Match>/);
    });

    it('rejects a <Match> outside a <Switch> on its first refresh', () => {
        const orphan = Match({ when: () => true, children: new Container() });

        expect(() => refreshScene(orphan)).toThrow(/<Switch>/);
    });

    describe('<Match else>', () => {
        it('must be the last <Match>, since any after it could never be shown', () => {
            expect(() => Switch({
                children: [
                    Match({ else: true, children: new Container() }),
                    Match({ when: () => true, children: new Container() }),
                ],
            })).toThrow(/last/);
        });

        it('may appear only once', () => {
            expect(() => Switch({
                children: [
                    Match({ else: true, children: new Container() }),
                    Match({ else: true, children: new Container() }),
                ],
            })).toThrow(/last/);
        });

        it('can make an unhandled case an error, via a child that throws', () => {
            let kind: 'asteroid' | 'ufo' | 'comet' = 'asteroid';
            const sw = Switch({
                children: [
                    Match({ when: () => kind === 'asteroid', children: new Container() }),
                    Match({ when: () => kind === 'ufo', children: new Container() }),
                    Match({
                        else: true,
                        children: () => {
                            throw new Error(`Unhandled kind: ${kind}`);
                        },
                    }),
                ],
            });

            // Handled cases never select the default, so it never throws
            expect(() => refreshScene(sw)).not.toThrow();
            kind = 'ufo';
            expect(() => refreshScene(sw)).not.toThrow();

            kind = 'comet';
            expect(() => refreshScene(sw)).toThrow('Unhandled kind: comet');
        });

        it('is typed as exclusive with `when`, so neither or both does not compile', () => {
            // The assertions here are the @ts-expect-error lines: type-checking
            // fails if either of these ever compiles
            // @ts-expect-error neither `when` nor `else`
            const neither = () => Match({ children: new Container() });
            // @ts-expect-error both `when` and `else`
            const both = () => Match({ when: () => true, else: true });
            expect(neither).toBeTypeOf('function');
            expect(both).toBeTypeOf('function');
        });
    });
});
