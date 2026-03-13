import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { createWatcher } from '#utils';
import type { CabinetPhase } from './cabinet-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CabinetViewBindings {
    getPhase(): CabinetPhase;
    getGameCount(): number;
    getGameName(index: number): string;
    getGameThumbnail(index: number): Texture | undefined;
    getSelectedIndex(): number;
    onNavigate(delta: number): void;
    onLaunch(): void;
    onExit(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const MENU_WIDTH = 480;
const MENU_HEIGHT = 360;
const TITLE_Y = 10;
const GRID_Y = 52;
const GRID_COLS = 2;
const CARD_W = 200;
const CARD_H = 130;
const CARD_GAP_X = 24;
const CARD_GAP_Y = 12;
const THUMB_PAD = 6;
const NAME_H = 22;
const THUMB_W = CARD_W - THUMB_PAD * 2;
const THUMB_H = CARD_H - NAME_H - THUMB_PAD * 2;

const COLOR_SELECTED = 0xffff00;
const COLOR_CARD_BG = 0x111122;
const COLOR_BORDER_SELECTED = 0xffff00;
const COLOR_BORDER_NORMAL = 0x333344;
const COLOR_NAME_NORMAL = 0xcccccc;

interface Card {
    container: Container;
    border: Graphics;
    thumb: Sprite | undefined;
    name: Text;
}

export function createCabinetView(bindings: CabinetViewBindings): Container {
    const watcher = createWatcher({
        phase: bindings.getPhase,
        selected: bindings.getSelectedIndex,
        count: bindings.getGameCount,
    });

    // ---- Scene elements ---------------------------------------------------
    const view = new Container();

    // Menu layer
    const menuLayer = new Container();
    view.addChild(menuLayer);

    const title = new Text({
        text: '\u2726  MVT GAMES  \u2726',
        style: {
            fontFamily: 'monospace',
            fontSize: 28,
            fill: COLOR_SELECTED,
            align: 'center',
        },
    });
    title.anchor.set(0.5, 0);
    title.position.set(MENU_WIDTH / 2, TITLE_Y);
    menuLayer.addChild(title);

    const hint = new Text({
        text: '\u2190\u2191\u2193\u2192 Select   \u2502   Enter Play   \u2502   Esc Back',
        style: {
            fontFamily: 'monospace',
            fontSize: 11,
            fill: 0x666666,
            align: 'center',
        },
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(MENU_WIDTH / 2, MENU_HEIGHT - 20);
    menuLayer.addChild(hint);

    let cards: Card[] = [];
    buildCards();

    // ---- Keyboard input ---------------------------------------------------

    function onKeyDown(e: KeyboardEvent): void {
        const phase = bindings.getPhase();
        if (phase === 'menu') {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                e.preventDefault();
                bindings.onNavigate(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'd') {
                e.preventDefault();
                bindings.onNavigate(1);
            } else if (e.key === 'ArrowUp' || e.key === 'w') {
                e.preventDefault();
                bindings.onNavigate(-GRID_COLS);
            } else if (e.key === 'ArrowDown' || e.key === 's') {
                e.preventDefault();
                bindings.onNavigate(GRID_COLS);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                bindings.onLaunch();
            }
        } else if (phase === 'playing') {
            if (e.key === 'Escape') {
                e.preventDefault();
                bindings.onExit();
            }
        }
    }

    window.addEventListener('keydown', onKeyDown);

    // ---- Lifecycle --------------------------------------------------------

    view.onRender = refresh;

    const originalDestroy = view.destroy.bind(view);
    view.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        originalDestroy(options);
    };

    return view;

    // ---- Internals --------------------------------------------------------

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.phase.changed) {
            menuLayer.visible = watched.phase.value === 'menu';
        }

        if (watched.count.changed) {
            buildCards();
        }

        if (watched.selected.changed || watched.count.changed) {
            updateSelection();
        }
    }

    function cardPosition(index: number): { x: number; y: number } {
        const col = index % GRID_COLS;
        const row = (index - col) / GRID_COLS;
        const gridWidth = GRID_COLS * CARD_W + (GRID_COLS - 1) * CARD_GAP_X;
        const x = (MENU_WIDTH - gridWidth) / 2 + col * (CARD_W + CARD_GAP_X);
        const y = GRID_Y + row * (CARD_H + CARD_GAP_Y);
        return { x, y };
    }

    function buildCards(): void {
        for (let i = 0; i < cards.length; i++) {
            cards[i].container.destroy({ children: true });
        }
        cards = [];

        const count = bindings.getGameCount();
        for (let i = 0; i < count; i++) {
            const pos = cardPosition(i);
            const cardContainer = new Container();
            cardContainer.position.set(pos.x, pos.y);

            // Background
            const bg = new Graphics();
            bg.roundRect(0, 0, CARD_W, CARD_H, 4).fill(COLOR_CARD_BG);
            cardContainer.addChild(bg);

            // Thumbnail
            const tex = bindings.getGameThumbnail(i);
            let thumb: Sprite | undefined;
            if (tex) {
                thumb = new Sprite(tex);
                const scale = Math.min(THUMB_W / tex.width, THUMB_H / tex.height);
                thumb.width = tex.width * scale;
                thumb.height = tex.height * scale;
                thumb.position.set(
                    THUMB_PAD + (THUMB_W - thumb.width) / 2,
                    THUMB_PAD + (THUMB_H - thumb.height) / 2,
                );
                cardContainer.addChild(thumb);
            }

            // Game name
            const name = new Text({
                text: bindings.getGameName(i),
                style: {
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fill: COLOR_NAME_NORMAL,
                    align: 'center',
                },
            });
            name.anchor.set(0.5, 0);
            name.position.set(CARD_W / 2, CARD_H - NAME_H + 2);
            cardContainer.addChild(name);

            // Border (drawn on top)
            const border = new Graphics();
            cardContainer.addChild(border);

            menuLayer.addChild(cardContainer);
            cards.push({ container: cardContainer, border, thumb, name });
        }

        updateSelection();
    }

    function updateSelection(): void {
        const sel = bindings.getSelectedIndex();
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const selected = i === sel;

            card.border.clear();
            if (selected) {
                card.border.roundRect(0, 0, CARD_W, CARD_H, 4)
                    .stroke({ color: COLOR_BORDER_SELECTED, width: 2 });
            } else {
                card.border.roundRect(0, 0, CARD_W, CARD_H, 4)
                    .stroke({ color: COLOR_BORDER_NORMAL, width: 1 });
            }

            card.name.style.fill = selected ? COLOR_SELECTED : COLOR_NAME_NORMAL;

            if (card.thumb) {
                card.thumb.alpha = selected ? 1.0 : 0.6;
            }
        }
    }
}
