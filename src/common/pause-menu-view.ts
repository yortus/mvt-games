import { Container, Graphics, Text } from 'pixi.js';
import { watch } from './watch';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PauseMenuViewBindings {
    getCanvasWidth(): number;
    getCanvasHeight(): number;
    getScale(): number;
    getVisible(): boolean;
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
        style: {
            fontFamily: 'monospace',
            fontSize: TITLE_CSS_SIZE,
            fill: 0xffffff,
            align: 'center',
        },
    });
    title.anchor.set(0.5, 0.5);
    content.addChild(title);

    // Buttons - drawn at CSS-pixel size, positioned and scaled in refresh
    const actions = [bindings.onResumePressed, bindings.onRestartPressed, bindings.onExitPressed];
    const labels = ['Resume', 'Restart', 'Exit to Cabinet'];
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

        // Reset selection on fresh open
        if (visible.changed) {
            selectedIndex = 0;
            highlightButtons(buttons, selectedIndex);
        }

        const invScale = 1 / bindings.getScale();

        // Rebuild backdrop when canvas dims change
        if (canvasWidth.changed || canvasHeight.changed) {
            backdrop.clear();
            backdrop.rect(0, 0, canvasWidth.value, canvasHeight.value)
                .fill({ color: 0x000000, alpha: 0.7 });
        }

        // Title position and scale
        title.position.set(canvasWidth.value / 2, canvasHeight.value * 0.35);
        title.scale.set(invScale);

        // Button positions and scale
        const btnStep = (BTN_CSS_HEIGHT + BTN_CSS_GAP) * invScale;
        const startY = canvasHeight.value * 0.45;
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].container.position.set(
                canvasWidth.value / 2,
                startY + i * btnStep,
            );
            buttons[i].container.scale.set(invScale);
        }
    }

    // ---- Keyboard navigation -----------------------------------------------

    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.getVisible()) return;

        if (e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + buttons.length) % buttons.length;
            highlightButtons(buttons, selectedIndex);
        }
        else if (e.key === 'ArrowDown' || e.key === 's') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % buttons.length;
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

const TITLE_CSS_SIZE = 32;
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
