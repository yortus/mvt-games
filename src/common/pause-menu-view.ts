import { Container, Graphics, Text } from 'pixi.js';
import { watch } from './watch';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PauseMenuViewBindings {
    getCanvasWidth(): number;
    getCanvasHeight(): number;
    getGameX(): number;
    getGameY(): number;
    getGameWidth(): number;
    getGameHeight(): number;
    getScale(): number;
    getVisible(): boolean;
    getHowToPlayText?(): string;
    onResumePressed(): void;
    onRestartPressed(): void;
    onExitPressed(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPauseMenuView(
    bindings: PauseMenuViewBindings,
): Container {
    const view = new Container();
    view.label = 'pause-menu';

    // Inner container toggles visibility; outer stays visible so onRender fires
    const content = new Container();
    content.visible = false;
    view.addChild(content);

    // Backdrop - redrawn only when canvas dims change
    const backdrop = new Graphics();
    backdrop.eventMode = 'static';
    backdrop.cursor = 'default';
    content.addChild(backdrop);

    // Title - drawn at CSS-pixel size, positioned and scaled in refresh
    const title = new Text({
        text: 'PAUSED',
        resolution: TEXT_RESOLUTION,
        style: {
            fontFamily: 'monospace',
            fontSize: TITLE_CSS_SIZE,
            fill: 0xffffff,
            align: 'center',
        },
    });
    title.anchor.set(0.5, 0.5);
    content.addChild(title);

    // "How to Play" panel - shown when the user taps the button
    let showingHowToPlay = false;

    const howToPlayPanel = new Container();
    howToPlayPanel.visible = false;
    content.addChild(howToPlayPanel);

    const howToPlayBackdrop = new Graphics();
    howToPlayPanel.addChild(howToPlayBackdrop);

    const howToPlayBody = new Text({
        text: '',
        resolution: TEXT_RESOLUTION,
        style: {
            fontFamily: 'monospace',
            fontSize: HOW_TO_PLAY_CSS_FONT,
            fill: 0xdddddd,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: HOW_TO_PLAY_WRAP_WIDTH,
        },
    });
    howToPlayBody.anchor.set(0.5, 0);
    howToPlayPanel.addChild(howToPlayBody);

    const howToPlayBackBtn = createButton('Back', () => {
        showingHowToPlay = false;
        howToPlayPanel.visible = false;
        selectedIndex = 0;
        highlightButtons(buttons, selectedIndex);
    });
    drawButtonBg(howToPlayBackBtn.bg, false);
    howToPlayPanel.addChild(howToPlayBackBtn.container);

    // Buttons - drawn at CSS-pixel size, positioned and scaled in refresh.
    // "How to Play" is always in the list but hidden when no instructions.
    const HOW_TO_PLAY_INDEX = 1;
    let hasHowToPlay = false;
    const actions: (() => void)[] = [];
    const labels: string[] = [];
    actions.push(bindings.onResumePressed);
    labels.push('Resume');
    actions.push(() => {
        showingHowToPlay = true;
        howToPlayPanel.visible = true;
    });
    labels.push('How to Play');
    actions.push(bindings.onRestartPressed);
    labels.push('Restart');
    actions.push(bindings.onExitPressed);
    labels.push('Exit to Cabinet');
    const buttons: ButtonEntry[] = [];
    for (let i = 0; i < labels.length; i++) {
        const entry = createButton(labels[i], actions[i]);
        content.addChild(entry.container);
        buttons.push(entry);
    }

    let selectedIndex = 0;
    highlightButtons(buttons, selectedIndex);

    const watcher = watch({
        visible: bindings.getVisible,
        canvasWidth: bindings.getCanvasWidth,
        canvasHeight: bindings.getCanvasHeight,
    });

    window.addEventListener('keydown', onKeyDown);

    const originalDestroy = view.destroy.bind(view);
    view.destroy = (opts) => {
        window.removeEventListener('keydown', onKeyDown);
        originalDestroy(opts);
    };

    view.onRender = refresh;
    return view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const { visible, canvasWidth, canvasHeight } = watcher.poll();
        content.visible = visible.value;
        if (!visible.value) return;

        // Reset selection and hide how-to-play on fresh open
        if (visible.changed) {
            selectedIndex = 0;
            showingHowToPlay = false;
            howToPlayPanel.visible = false;
            highlightButtons(buttons, selectedIndex);

            // Update instructions text each time the menu opens
            const text = bindings.getHowToPlayText?.() ?? '';
            howToPlayBody.text = text;
        }

        hasHowToPlay = howToPlayBody.text.length > 0;

        const invScale = 1 / bindings.getScale();

        // Rebuild backdrop when canvas dims change or menu first opens
        if (visible.changed || canvasWidth.changed || canvasHeight.changed) {
            backdrop.clear();
            backdrop.rect(0, 0, canvasWidth.value, canvasHeight.value)
                .fill({ color: 0x000000, alpha: 0.7 });
        }

        // Centre on the game area, not the full canvas
        const gx = bindings.getGameX();
        const gy = bindings.getGameY();
        const gw = bindings.getGameWidth();
        const gh = bindings.getGameHeight();
        const gameCenterX = gx + gw / 2;
        const gameCenterY = gy + gh / 2;

        // Count visible buttons to compute total block height
        let visibleCount = 0;
        for (let i = 0; i < buttons.length; i++) {
            const isHtp = i === HOW_TO_PLAY_INDEX;
            if (!showingHowToPlay && !(isHtp && !hasHowToPlay)) visibleCount++;
        }

        // Compute total content height in logical coords and centre vertically
        const titleH = TITLE_CSS_SIZE * invScale;
        const titleGap = TITLE_BTN_CSS_GAP * invScale;
        const btnH = BTN_CSS_HEIGHT * invScale;
        const btnGap = BTN_CSS_GAP * invScale;
        const buttonsH = visibleCount * btnH + (visibleCount - 1) * btnGap;
        const totalH = titleH + titleGap + buttonsH;
        const blockTop = gameCenterY - totalH / 2;

        // Title position and scale
        title.position.set(gameCenterX, blockTop + titleH / 2);
        title.scale.set(invScale);

        // Button positions and scale - skip How to Play when no instructions
        const firstBtnY = blockTop + titleH + titleGap + btnH / 2;
        let visibleIdx = 0;
        for (let i = 0; i < buttons.length; i++) {
            const isHtp = i === HOW_TO_PLAY_INDEX;
            const hidden = showingHowToPlay || (isHtp && !hasHowToPlay);
            buttons[i].container.visible = !hidden;
            if (!hidden) {
                buttons[i].container.position.set(
                    gameCenterX,
                    firstBtnY + visibleIdx * (btnH + btnGap),
                );
                buttons[i].container.scale.set(invScale);
                visibleIdx++;
            }
        }

        // How to Play panel positioning
        title.visible = !showingHowToPlay;
        if (showingHowToPlay) {
            howToPlayBackdrop.clear();
            howToPlayBackdrop.rect(0, 0, canvasWidth.value, canvasHeight.value)
                .fill({ color: 0x000000, alpha: 0.85 });
            howToPlayBody.position.set(gameCenterX, gy + gh * 0.15);
            howToPlayBody.scale.set(invScale);
            howToPlayBackBtn.container.position.set(
                gameCenterX,
                gy + gh * 0.85,
            );
            howToPlayBackBtn.container.scale.set(invScale);
        }
    }

    // ---- Keyboard navigation -----------------------------------------------

    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.getVisible()) return;

        if (showingHowToPlay) {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Backspace') {
                e.preventDefault();
                showingHowToPlay = false;
                howToPlayPanel.visible = false;
                selectedIndex = 0;
                highlightButtons(buttons, selectedIndex);
            }
            return;
        }

        if (e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            do {
                selectedIndex = (selectedIndex - 1 + buttons.length) % buttons.length;
            } while (!hasHowToPlay && selectedIndex === HOW_TO_PLAY_INDEX);
            highlightButtons(buttons, selectedIndex);
        }
        else if (e.key === 'ArrowDown' || e.key === 's') {
            e.preventDefault();
            do {
                selectedIndex = (selectedIndex + 1) % buttons.length;
            } while (!hasHowToPlay && selectedIndex === HOW_TO_PLAY_INDEX);
            highlightButtons(buttons, selectedIndex);
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            actions[selectedIndex]();
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Rasterise text at device DPR so it stays crisp regardless of renderer resolution. */
const TEXT_RESOLUTION = (typeof globalThis !== 'undefined' && 'devicePixelRatio' in globalThis)
    ? globalThis.devicePixelRatio
    : 1;

const TITLE_CSS_SIZE = 32;
const TITLE_BTN_CSS_GAP = 24;
const HOW_TO_PLAY_CSS_FONT = 14;
const HOW_TO_PLAY_WRAP_WIDTH = 360;
const BTN_CSS_WIDTH = 200;
const BTN_CSS_HEIGHT = 48;
const BTN_CSS_GAP = 12;
const BTN_CSS_FONT = 18;
const COLOR_NORMAL = 0xffffff;
const COLOR_SELECTED = 0xffff00;
const BG_FILL_NORMAL = 0x222244;
const BG_FILL_SELECTED = 0x333366;
const BG_STROKE_NORMAL = 0x666688;
const BG_STROKE_SELECTED = 0xffff00;

interface ButtonEntry {
    container: Container;
    bg: Graphics;
    text: Text;
}

function createButton(label: string, onTap: () => void): ButtonEntry {
    const container = new Container();

    const bg = new Graphics();
    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    bg.on('pointerdown', () => {
        onTap();
    });
    container.addChild(bg);

    const text = new Text({
        text: label,
        resolution: TEXT_RESOLUTION,
        style: {
            fontFamily: 'monospace',
            fontSize: BTN_CSS_FONT,
            fill: COLOR_NORMAL,
            align: 'center',
        },
    });
    text.anchor.set(0.5, 0.5);
    container.addChild(text);

    return { container, bg, text };
}

function drawButtonBg(bg: Graphics, selected: boolean): void {
    bg.clear();
    bg.roundRect(-BTN_CSS_WIDTH / 2, -BTN_CSS_HEIGHT / 2, BTN_CSS_WIDTH, BTN_CSS_HEIGHT, 6)
        .fill({ color: selected ? BG_FILL_SELECTED : BG_FILL_NORMAL, alpha: 0.9 });
    bg.roundRect(-BTN_CSS_WIDTH / 2, -BTN_CSS_HEIGHT / 2, BTN_CSS_WIDTH, BTN_CSS_HEIGHT, 6)
        .stroke({ color: selected ? BG_STROKE_SELECTED : BG_STROKE_NORMAL, width: selected ? 2 : 1 });
}

function highlightButtons(
    buttons: readonly ButtonEntry[],
    selectedIndex: number,
): void {
    for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const sel = i === selectedIndex;
        btn.text.style.fill = sel ? COLOR_SELECTED : COLOR_NORMAL;
        drawButtonBg(btn.bg, sel);
    }
}
