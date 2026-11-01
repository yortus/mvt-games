import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { TestRunModel } from '../models';
import { DiggerView } from './digger-view';
import { FieldView } from './field-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TestRunViewBindings {
    readonly model: TestRunModel;
    readonly fieldRows: number;
    readonly fieldCols: number;
    /** The test's stand-in for the field, which the field is drawn from. */
    readonly isWalkableAt: (row: number, col: number) => boolean;
    /** The column the test expects the digger to stop in. */
    readonly expectedCol: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The field and the digger on the left, and the test on the right, with
 * the digger's column below it. Once the run has finished, it shows whether
 * the test's check passes.
 */
export function TestRunView(bindings: TestRunViewBindings): Container {
    const { model, fieldRows, fieldCols, isWalkableAt, expectedCol } = bindings;
    const view = new Container();

    const caption = new Text({ text: 'The field, as isWalkable says', style: { ...TEXT_STYLE, fill: 0x8890a0 } });
    caption.position.set(FIELD_X, 14);

    const field = FieldView({ rows: fieldRows, cols: fieldCols, tileSize: TILE_SIZE, isWalkableAt });
    field.position.set(FIELD_X, FIELD_Y);
    const digger = DiggerView({
        row: () => model.digger.row,
        col: () => model.digger.col,
        direction: () => model.digger.direction,
        tileSize: TILE_SIZE,
    });
    field.addChild(digger);

    const listing = new Text({ text: formatListing(expectedCol), style: { ...TEXT_STYLE, lineHeight: 19 } });
    listing.position.set(PANEL_X, 40);

    const colText = new Text({ text: '', style: { ...TEXT_STYLE, fill: 0xffcc66 } });
    colText.position.set(PANEL_X, 250);
    const passText = new Text({ text: 'PASS', style: { ...TEXT_STYLE, fontSize: 18, fill: 0x66dd77 } });
    passText.position.set(PANEL_X, 280);
    const failText = new Text({ text: '', style: { ...TEXT_STYLE, fontSize: 18, fill: 0xff5566 } });
    failText.position.set(PANEL_X, 280);

    view.addChild(caption, field, listing, colText, passText, failText);

    // The texts are made again only when the column changes, to the nearest hundredth
    const hundredths = (): number => Math.round(model.digger.col * 100);
    const colLabel = createComputed({ watch: hundredths, compute: (h) => `digger.col is ${formatHundredths(h)}` });
    const failLabel = createComputed({ watch: hundredths, compute: (h) => `FAIL: got ${formatHundredths(h)}` });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        colText.text = colLabel();
        // The test's check: expect(digger.col).toBe(expectedCol)
        const isShown = model.phase === 'asserting';
        const isPassing = model.digger.col === expectedCol;
        passText.visible = isShown && isPassing;
        failText.visible = isShown && !isPassing;
        failText.text = failLabel();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TILE_SIZE = 34;
const FIELD_X = 24;
const FIELD_Y = 44;
/** Where the test's text starts, to the right of the field. */
const PANEL_X = 330;

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: 12, fill: 0xdde4ee };

/** The test, as the chapter writes it, with the column it expects. */
function formatListing(expectedCol: number): string {
    return [
        "it('stops at a wall', () => {",
        '    const digger = createDigger({',
        '        isWalkable,',
        '    });',
        "    digger.setDirection('right');",
        '    for (let i = 0; i < 120; i++) {',
        '        digger.update(16);',
        '    }',
        `    expect(digger.col).toBe(${expectedCol});`,
        '});',
    ].join('\n');
}

function formatHundredths(hundredths: number): string {
    return (hundredths / 100).toFixed(2);
}
