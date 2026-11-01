import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createComputed, createReaction, increased } from '@mvtjs/utils';
import type { Cell, GemKind } from '../models';
import { toCellX, toCellY } from './board-layout';
import { GemsView } from './gems-view';
import { createMatchEffectsViewModel } from './match-effects-view-model';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How big each puff of dust is, in pixels. */
const DUST_RADIUS = 26;
/** How far the popup rises, in pixels. */
const RISE_PX = 60;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    /** The board's size, read once. */
    readonly rows: number;
    readonly cols: number;
    readonly gemAt: (row: number, col: number) => GemKind;
    readonly matchedCells: () => readonly Cell[];
    readonly points: () => number;
    /** Matches made in a row in this chain, and 0 between chains. */
    readonly cascadeStep: () => number;
    readonly onCellPressed?: (row: number, col: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The board, its dust and score popup, and the combo banner. A view model
 * keeps the effects and the rules that tie them together. This view makes
 * it, sets its update as the view's update step, and writes its values in
 * `refresh`.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const matchEffects = createMatchEffectsViewModel({
        cascadeStep: bindings.cascadeStep,
    });
    // Places the dust once, as it falls due, not on every refresh
    const placeDustWhenDue = createReaction({
        watch: () => matchEffects.isDustDue,
        when: true,
        react: () => placeDustAt(bindings.matchedCells()),
    });
    // Shows the new match's points, over the middle of the match
    const showPointsOnEachMatch = createReaction({
        watch: bindings.cascadeStep,
        when: increased,
        react: () => showPointsAt(bindings.matchedCells()),
    });

    const view = new Container();

    const board = GemsView({ rows: bindings.rows, cols: bindings.cols, gemAt: bindings.gemAt, onCellPressed: bindings.onCellPressed });

    // One puff of dust for each cell a match can have, hidden until it's placed
    const dust = new Container();
    for (let i = 0; i < MAX_MATCHED; i++) {
        const puff = new Graphics().circle(0, 0, DUST_RADIUS).fill({ color: 0xffffff, alpha: 0.35 });
        puff.visible = false;
        dust.addChild(puff);
    }

    const popup = new Text({ text: '', style: POPUP_STYLE });
    popup.anchor.set(0.5);
    // Where the popup starts, before it rises
    let popupY = 0;

    const banner = new Container();
    const bannerText = new Text({ text: '', style: BANNER_STYLE });
    bannerText.anchor.set(0.5);
    banner.addChild(
        new Graphics().roundRect(-130, -24, 260, 48, 12).fill(0xd94f8a).stroke({ color: 0xffffff, width: 3 }),
        bannerText,
    );
    banner.position.set(320, 56);
    // The banner's text is made again only when the chain grows
    const bannerLabel = createComputed({ watch: bindings.cascadeStep, compute: (step) => 'COMBO x' + step });

    view.addChild(board, dust, popup, banner);

    setUpdate(view, matchEffects.update);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        placeDustWhenDue();
        showPointsOnEachMatch();
        board.x = matchEffects.shakePx;
        popup.alpha = 1 - matchEffects.popupProgress;
        popup.y = popupY - RISE_PX * matchEffects.popupProgress;
        dust.visible = matchEffects.isDustDue;
        dust.alpha = 1 - matchEffects.popupProgress;
        banner.visible = matchEffects.isBannerShown;
        bannerText.text = bannerLabel();
    }

    function placeDustAt(cells: readonly Cell[]): void {
        for (let i = 0; i < dust.children.length; i++) {
            const puff = dust.children[i];
            puff.visible = i < cells.length;
            if (i < cells.length) puff.position.set(toCellX(cells[i].col), toCellY(cells[i].row));
        }
    }

    function showPointsAt(cells: readonly Cell[]): void {
        popup.text = String(bindings.points());
        const middle = cells[Math.floor(cells.length / 2)];
        popup.x = toCellX(middle.col);
        popupY = toCellY(middle.row);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most cells a match can have. */
const MAX_MATCHED = 3;

const POPUP_STYLE = { fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x111827, width: 5 } } as const;
const BANNER_STYLE = { fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold', fill: 0xffffff } as const;
