import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { LevelModel } from '../models';
import { BadView } from './bad-view';
import { GoodView } from './good-view';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The size of each tile, in pixels. */
const TILE_SIZE = 30;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LevelViewBindings {
    readonly model: LevelModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The level, and the model's grid shown twice: by BadView on the left, and GoodView on the right. */
export function LevelView({ model }: LevelViewBindings): Container {
    const view = new Container();

    const levelText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 20, fill: 0xffffff } });
    levelText.anchor.set(0.5, 0);
    levelText.position.set(320, 14);

    // Both views get the same bindings
    const bad = BadView({ rows: () => model.rows, cols: () => model.cols, tileSize: TILE_SIZE });
    bad.position.set(160, 60);
    const good = GoodView({ rows: () => model.rows, cols: () => model.cols, tileSize: TILE_SIZE });
    good.position.set(480, 60);

    view.addChild(
        levelText,
        bad,
        good,
        makeLabel('BadView: reads rows once', 160, 260, 0xff6655),
        makeLabel('GoodView: reads rows every frame', 480, 260, 0x44ffaa),
    );

    const levelLabel = createComputed({ watch: () => model.level, compute: (level) => `LEVEL ${level}` });

    function refresh(): void {
        levelText.text = levelLabel();
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function makeLabel(text: string, x: number, y: number, fill: number): Text {
    const label = new Text({ text, style: { fontFamily: 'monospace', fontSize: 14, fill } });
    label.anchor.set(0.5, 0);
    label.position.set(x, y);
    return label;
}
