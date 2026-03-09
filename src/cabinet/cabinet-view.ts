import { Container, Text } from 'pixi.js';
import { createWatch } from '#utils';
import type { CabinetPhase } from './cabinet-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CabinetViewBindings {
    getPhase(): CabinetPhase;
    getGameCount(): number;
    getGameName(index: number): string;
    getSelectedIndex(): number;
    onSelectNext(): void;
    onSelectPrev(): void;
    onLaunch(): void;
    onExit(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const MENU_WIDTH = 480;
const TITLE_Y = 60;
const LIST_START_Y = 140;
const LIST_ITEM_HEIGHT = 40;

export function createCabinetView(bindings: CabinetViewBindings): Container {
    const watchPhase = createWatch(bindings.getPhase);
    const watchSelected = createWatch(bindings.getSelectedIndex);
    const watchCount = createWatch(bindings.getGameCount);

    // ---- Scene elements ---------------------------------------------------
    const container = new Container();

    // Menu layer
    const menuLayer = new Container();
    container.addChild(menuLayer);

    const title = new Text({
        text: 'MVT Games',
        style: {
            fontFamily: 'monospace',
            fontSize: 36,
            fill: 0xffff00,
            align: 'center',
        },
    });
    title.anchor.set(0.5, 0);
    title.position.set(MENU_WIDTH / 2, TITLE_Y);
    menuLayer.addChild(title);

    const subtitle = new Text({
        text: 'Select a game and press Enter',
        style: {
            fontFamily: 'monospace',
            fontSize: 14,
            fill: 0x888888,
            align: 'center',
        },
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.position.set(MENU_WIDTH / 2, TITLE_Y + 46);
    menuLayer.addChild(subtitle);

    let itemTexts: Text[] = [];
    const arrow = new Text({
        text: '\u25b6',
        style: {
            fontFamily: 'monospace',
            fontSize: 22,
            fill: 0xffff00,
        },
    });
    arrow.anchor.set(1, 0);
    menuLayer.addChild(arrow);
    buildMenuItems();

    // ---- Keyboard input ---------------------------------------------------

    function onKeyDown(e: KeyboardEvent): void {
        const phase = bindings.getPhase();
        if (phase === 'menu') {
            if (e.key === 'ArrowUp' || e.key === 'w') {
                e.preventDefault();
                bindings.onSelectPrev();
            } else if (e.key === 'ArrowDown' || e.key === 's') {
                e.preventDefault();
                bindings.onSelectNext();
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

    container.onRender = refresh;

    const originalDestroy = container.destroy.bind(container);
    container.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        originalDestroy(options);
    };

    return container;

    // ---- Internals --------------------------------------------------------

    function refresh(): void {
        const phaseChanged = watchPhase.changed();
        const selChanged = watchSelected.changed();
        const countChanged = watchCount.changed();

        if (phaseChanged) {
            const phase = watchPhase.value;
            menuLayer.visible = phase === 'menu';
        }

        if (countChanged) {
            buildMenuItems();
        }

        if (selChanged || countChanged) {
            updateSelection();
        }
    }

    function buildMenuItems(): void {
        for (let i = 0; i < itemTexts.length; i++) {
            itemTexts[i].destroy();
        }
        itemTexts = [];

        const count = bindings.getGameCount();
        for (let i = 0; i < count; i++) {
            const text = new Text({
                text: bindings.getGameName(i),
                style: {
                    fontFamily: 'monospace',
                    fontSize: 22,
                    fill: 0xffffff,
                    align: 'center',
                },
            });
            text.anchor.set(0.5, 0);
            text.position.set(MENU_WIDTH / 2, LIST_START_Y + i * LIST_ITEM_HEIGHT);
            menuLayer.addChild(text);
            itemTexts.push(text);
        }
        updateSelection();
    }

    function updateSelection(): void {
        const sel = bindings.getSelectedIndex();
        for (let i = 0; i < itemTexts.length; i++) {
            const item = itemTexts[i];
            if (i === sel) {
                item.style.fill = 0xffff00;
                arrow.position.set(item.x - item.width / 2 - 8, item.y);
            } else {
                item.style.fill = 0xffffff;
            }
        }
    }
}
