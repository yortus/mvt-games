import { Container, Graphics, Text } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { setRefresh } from '@mvtjs/pixi';
import { listenToPointer } from './listen-to-pointer';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Which directions a d-pad goes. A four-way d-pad also goes diagonally. */
export type DpadKind = 'four-way' | 'left-right';

export interface TouchInputViewBindings {
    /** The canvas's size, in CSS pixels. */
    canvasWidth: () => number;
    canvasHeight: () => number;
    /** Where the game sits on the canvas, and at what scale. */
    gameX: () => number;
    gameY: () => number;
    gameWidth: () => number;
    gameHeight: () => number;
    scale: () => number;
    hasDpad: () => boolean;
    dpadKind: () => DpadKind;
    hasPrimaryButton: () => boolean;
    hasSecondaryButton: () => boolean;
    primaryLabel: () => string;
    secondaryLabel: () => string;
    /** A joystick that appears where the thumb lands, rather than a fixed d-pad. */
    isJoystickFloating: () => boolean;
    onXDirectionChanged?: (direction: 'left' | 'none' | 'right') => void;
    onYDirectionChanged?: (direction: 'up' | 'none' | 'down') => void;
    onPrimaryButtonChanged?: (pressed: boolean) => void;
    onSecondaryButtonChanged?: (pressed: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * On-screen controls for touch devices. There is a d-pad or a floating
 * joystick, and up to two buttons, beside or below the game. The view is
 * written in plain TypeScript. It rebuilds its controls when their layout
 * changes. It lays them out by hand each frame, at the canvas's scale.
 *
 * Each control follows one finger, from where it lands until it lets go. So
 * a thumb that slides off the d-pad still steers, and a finger lifted from
 * one button doesn't let go of the other. A finger let go while the controls
 * are hidden, as they are while the game is paused, still releases its
 * control. That's because Pixi sends `pointerupoutside` to a hidden object
 * too.
 */
export function TouchInputView(bindings: TouchInputViewBindings): Container {
    const view = new Container();
    view.label = 'touch-input';

    // The direction the d-pad or the joystick holds
    let dpadXDir: 'left' | 'none' | 'right' = 'none';
    let dpadYDir: 'up' | 'none' | 'down' = 'none';
    // Whether each button is held
    let isPrimaryHeld = false;
    let isSecondaryHeld = false;
    // The floating joystick, while a thumb holds it. Where the thumb landed, and where its knob is now
    let isJoystickHeld = false;
    let joystickX = 0;
    let joystickY = 0;
    let knobX = 0;
    let knobY = 0;

    // The groups of display objects. They are rebuilt when the layout changes, and placed again every frame
    const dpadGroup = new Container();
    const primaryBtnGroup = new Container();
    const secondaryBtnGroup = new Container();
    view.addChild(dpadGroup, primaryBtnGroup, secondaryBtnGroup);

    // What the refresh shows a hold on. They are rebuilt with the controls
    let primaryText: Text | undefined;
    let secondaryText: Text | undefined;
    let primaryHeldFill: Graphics | undefined;
    let secondaryHeldFill: Graphics | undefined;
    let joystickBase: Graphics | undefined;
    let joystickKnob: Graphics | undefined;

    const watcher = watch({
        showDpad: bindings.hasDpad,
        showPrimary: bindings.hasPrimaryButton,
        showSecondary: bindings.hasSecondaryButton,
        floatingJoystick: bindings.isJoystickFloating,
        dpadKind: bindings.dpadKind,
        primaryLabel: bindings.primaryLabel,
        secondaryLabel: bindings.secondaryLabel,
    });
    // The watcher sees only changes from here on, so the first controls are built now
    rebuild();

    setRefresh(view, refresh);
    return view;

    // ---- Refresh / layout --------------------------------------------------

    function refresh(): void {
        const w = watcher.poll();

        const structuralChange = w.showDpad.changed
            || w.showPrimary.changed || w.showSecondary.changed
            || w.floatingJoystick.changed || w.dpadKind.changed;

        if (structuralChange) {
            rebuild();
        }
        else {
            if (w.primaryLabel.changed && primaryText) {
                primaryText.text = bindings.primaryLabel();
                fitLabel(primaryText);
            }
            if (w.secondaryLabel.changed && secondaryText) {
                secondaryText.text = bindings.secondaryLabel();
                fitLabel(secondaryText);
            }
        }

        layout();
        showHolds();
    }

    function rebuild(): void {
        releaseAll();

        destroyChildren(dpadGroup);
        destroyChildren(primaryBtnGroup);
        destroyChildren(secondaryBtnGroup);
        primaryText = undefined;
        secondaryText = undefined;
        primaryHeldFill = undefined;
        secondaryHeldFill = undefined;
        joystickBase = undefined;
        joystickKnob = undefined;

        if (bindings.hasDpad()) {
            if (bindings.isJoystickFloating()) {
                buildFloatingJoystick(dpadGroup);
            }
            else {
                buildFixedDpad(dpadGroup, bindings.dpadKind());
            }
        }

        if (bindings.hasPrimaryButton()) {
            const button = buildActionButton({
                parent: primaryBtnGroup,
                label: bindings.primaryLabel(),
                color: COLOR_PRIMARY,
                onChanged: (pressed) => {
                    isPrimaryHeld = pressed;
                    bindings.onPrimaryButtonChanged?.(pressed);
                },
            });
            primaryText = button.text;
            primaryHeldFill = button.heldFill;
        }

        if (bindings.hasSecondaryButton()) {
            const button = buildActionButton({
                parent: secondaryBtnGroup,
                label: bindings.secondaryLabel(),
                color: COLOR_SECONDARY,
                onChanged: (pressed) => {
                    isSecondaryHeld = pressed;
                    bindings.onSecondaryButtonChanged?.(pressed);
                },
            });
            secondaryText = button.text;
            secondaryHeldFill = button.heldFill;
        }
    }

    /**
     * Releases every control held, since their event handlers are about to
     * go. A rebuild happens in the refresh step, during the tick. So each
     * release is reported from a microtask, after the frame's code has
     * finished.
     */
    function releaseAll(): void {
        isJoystickHeld = false;
        if (dpadXDir !== 'none') {
            dpadXDir = 'none';
            queueMicrotask(() => bindings.onXDirectionChanged?.('none'));
        }
        if (dpadYDir !== 'none') {
            dpadYDir = 'none';
            queueMicrotask(() => bindings.onYDirectionChanged?.('none'));
        }
        if (isPrimaryHeld) {
            isPrimaryHeld = false;
            queueMicrotask(() => bindings.onPrimaryButtonChanged?.(false));
        }
        if (isSecondaryHeld) {
            isSecondaryHeld = false;
            queueMicrotask(() => bindings.onSecondaryButtonChanged?.(false));
        }
    }

    function layout(): void {
        const showDpad = bindings.hasDpad();
        const showPrimary = bindings.hasPrimaryButton();
        const showSecondary = bindings.hasSecondaryButton();

        dpadGroup.visible = showDpad;
        primaryBtnGroup.visible = showPrimary;
        secondaryBtnGroup.visible = showSecondary;

        if (!showDpad && !showPrimary && !showSecondary) return;

        const canvasWidth = bindings.canvasWidth();
        const canvasHeight = bindings.canvasHeight();
        const gameX = bindings.gameX();
        const gameY = bindings.gameY();
        const gameWidth = bindings.gameWidth();
        const gameHeight = bindings.gameHeight();
        const invScale = 1 / bindings.scale();

        const isPortrait = canvasHeight >= canvasWidth;

        let dpadCenterX: number;
        let dpadCenterY: number;
        let btnAreaX: number;
        let btnAreaY: number;

        if (isPortrait) {
            const belowTop = gameY + gameHeight;
            const belowHeight = canvasHeight - belowTop;
            const controlCenterY = belowTop + belowHeight / 2;

            dpadCenterX = canvasWidth * 0.25;
            dpadCenterY = controlCenterY;
            btnAreaX = canvasWidth * 0.75;
            btnAreaY = controlCenterY;
        }
        else {
            const leftWidth = gameX;
            const rightStart = gameX + gameWidth;
            const rightWidth = canvasWidth - rightStart;
            const controlCenterY = canvasHeight * 0.6;

            dpadCenterX = leftWidth / 2;
            dpadCenterY = controlCenterY;
            btnAreaX = rightStart + rightWidth / 2;
            btnAreaY = controlCenterY;
        }

        if (showDpad) {
            dpadGroup.position.set(dpadCenterX, dpadCenterY);
            dpadGroup.scale.set(invScale);
        }

        const btnStep = (BTN_CSS_RADIUS * 2 + MARGIN_CSS) * invScale;
        const hasBoth = showPrimary && showSecondary;

        if (showSecondary) {
            const offsetY = hasBoth ? btnStep / 2 : 0;
            secondaryBtnGroup.position.set(btnAreaX, btnAreaY + offsetY);
            secondaryBtnGroup.scale.set(invScale);
        }

        if (showPrimary) {
            const offsetY = hasBoth ? -btnStep / 2 : 0;
            primaryBtnGroup.position.set(btnAreaX, btnAreaY + offsetY);
            primaryBtnGroup.scale.set(invScale);
        }
    }

    /** Shows each button held down, and the floating joystick where the thumb holds it. */
    function showHolds(): void {
        if (primaryHeldFill !== undefined) primaryHeldFill.visible = isPrimaryHeld;
        if (secondaryHeldFill !== undefined) secondaryHeldFill.visible = isSecondaryHeld;
        if (joystickBase === undefined || joystickKnob === undefined) return;
        joystickBase.visible = isJoystickHeld;
        joystickKnob.visible = isJoystickHeld;
        joystickBase.position.set(joystickX, joystickY);
        joystickKnob.position.set(knobX, knobY);
    }

    // ---- Shared direction helpers ------------------------------------------

    function setDirection(
        newX: 'left' | 'none' | 'right',
        newY: 'up' | 'none' | 'down',
    ): void {
        if (newX !== dpadXDir) {
            dpadXDir = newX;
            bindings.onXDirectionChanged?.(newX);
        }
        if (newY !== dpadYDir) {
            dpadYDir = newY;
            bindings.onYDirectionChanged?.(newY);
        }
    }

    /** Steers towards a thumb (dx, dy) from the middle, in one of eight zones. Inside the dead zone, it steers nowhere. */
    function steerTowards(dx: number, dy: number): void {
        if (dx * dx + dy * dy < DEAD_ZONE_RADIUS * DEAD_ZONE_RADIUS) {
            setDirection('none', 'none');
            return;
        }
        const zone = ((Math.floor((Math.atan2(dy, dx) + ZONE_SIZE / 2) / ZONE_SIZE) % 8) + 8) % 8;
        setDirection(ZONE_X[zone], ZONE_Y[zone]);
    }

    // ---- Floating joystick builder -----------------------------------------

    function buildFloatingJoystick(parent: Container): void {
        const knobRadius = Math.round(DPAD_CSS_RADIUS * 0.4);

        // Invisible hit area covering the d-pad region (CSS-pixel coords)
        const hitArea = new Graphics();
        hitArea.rect(
            -DPAD_CSS_RADIUS * 1.5,
            -DPAD_CSS_RADIUS * 1.5,
            DPAD_CSS_RADIUS * 3,
            DPAD_CSS_RADIUS * 3,
        ).fill({ color: 0x000000, alpha: 0.01 });
        parent.addChild(hitArea);

        joystickBase = new Graphics();
        joystickBase.circle(0, 0, DPAD_CSS_RADIUS).fill({ color: 0xffffff, alpha: 0.1 });
        joystickBase.circle(0, 0, DPAD_CSS_RADIUS).stroke({ color: 0xffffff, alpha: 0.15, width: 2 });
        joystickBase.visible = false;
        parent.addChild(joystickBase);

        joystickKnob = new Graphics();
        joystickKnob.circle(0, 0, knobRadius).fill({ color: 0xffffff, alpha: 0.25 });
        joystickKnob.visible = false;
        parent.addChild(joystickKnob);

        // The hit area sits at the group's origin, unscaled, so its pixels are the group's.
        // The thumb is followed wherever it goes, so one that slides off the area still steers
        listenToPointer({
            target: hitArea,
            onPressed: (x, y) => {
                isJoystickHeld = true;
                joystickX = x;
                joystickY = y;
                knobX = x;
                knobY = y;
            },
            onMoved: (x, y) => {
                const dx = x - joystickX;
                const dy = y - joystickY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // The knob stays within the base's rim
                const reach = distance > DPAD_CSS_RADIUS ? DPAD_CSS_RADIUS / distance : 1;
                knobX = joystickX + dx * reach;
                knobY = joystickY + dy * reach;
                steerTowards(dx, dy);
            },
            onReleased: () => {
                isJoystickHeld = false;
                setDirection('none', 'none');
            },
        });
    }

    // ---- Fixed D-pad builder -----------------------------------------------

    function buildFixedDpad(parent: Container, kind: DpadKind): void {
        const dpadBg = new Graphics();
        dpadBg.circle(0, 0, DPAD_CSS_RADIUS).fill({ color: 0xffffff, alpha: 0.08 });
        parent.addChild(dpadBg);

        const arrowGfx = new Graphics();
        drawDpadArrows(arrowGfx, DPAD_CSS_RADIUS, kind);
        arrowGfx.alpha = ARROW_ALPHA;
        parent.addChild(arrowGfx);

        const dpadHit = new Graphics();
        dpadHit.circle(0, 0, DPAD_CSS_RADIUS).fill({ color: 0x000000, alpha: 0.01 });
        dpadHit.cursor = 'pointer';
        parent.addChild(dpadHit);

        // Followed wherever the thumb goes, so one that drifts off the d-pad still steers
        listenToPointer({
            target: dpadHit,
            onPressed: steer,
            onMoved: steer,
            onReleased: () => setDirection('none', 'none'),
        });

        function steer(x: number, y: number): void {
            if (kind === 'four-way') {
                steerTowards(x, y);
                return;
            }
            if (x * x + y * y < DEAD_ZONE_RADIUS * DEAD_ZONE_RADIUS) setDirection('none', 'none');
            else setDirection(x < 0 ? 'left' : 'right', 'none');
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DPAD_CSS_RADIUS = 60;
const BTN_CSS_RADIUS = 30;
const MARGIN_CSS = 12;
/** How far from the middle a thumb must be to steer, as a share of the d-pad's radius, and in pixels. */
const DEAD_ZONE = 0.2;
const DEAD_ZONE_RADIUS = DPAD_CSS_RADIUS * DEAD_ZONE;
const ZONE_SIZE = Math.PI / 4;
const ZONE_X: readonly ('left' | 'none' | 'right')[] = ['right', 'right', 'none', 'left', 'left', 'left', 'none', 'right'];
const ZONE_Y: readonly ('up' | 'none' | 'down')[] = ['none', 'down', 'down', 'down', 'none', 'up', 'up', 'up'];
const ARROW_ALPHA = 0.3;
const COLOR_PRIMARY = 0x58a6ff;
const COLOR_SECONDARY = 0xf0883e;
/** How strongly a held button's fill shows, over its resting fill. */
const HELD_ALPHA = 0.35;

function destroyChildren(container: Container): void {
    while (container.children.length > 0) {
        container.removeChildAt(0).destroy({ children: true });
    }
}

function drawDpadArrows(gfx: Graphics, radius: number, kind: DpadKind): void {
    const r = radius * 0.65;
    const s = radius * 0.15;

    gfx.moveTo(r, 0).lineTo(r - s, -s).lineTo(r - s, s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
    gfx.moveTo(-r, 0).lineTo(-r + s, -s).lineTo(-r + s, s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
    if (kind === 'left-right') return;
    gfx.moveTo(0, -r).lineTo(-s, -r + s).lineTo(s, -r + s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
    gfx.moveTo(0, r).lineTo(-s, r - s).lineTo(s, r - s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
}

interface ActionButtonOptions {
    readonly parent: Container;
    readonly label: string;
    readonly color: number;
    /** The button was pressed or let go, by the one finger it follows. */
    readonly onChanged: (pressed: boolean) => void;
}

/** Builds a round button. It returns its label, and the fill that shows it held down. */
function buildActionButton(options: ActionButtonOptions): { readonly text: Text; readonly heldFill: Graphics } {
    const { parent, label, color, onChanged } = options;
    const bg = new Graphics();
    bg.circle(0, 0, BTN_CSS_RADIUS).fill({ color, alpha: 0.25 });
    bg.circle(0, 0, BTN_CSS_RADIUS).stroke({ color, alpha: 0.5, width: 2 });
    parent.addChild(bg);

    // Shown only while the button is held, over its resting look
    const heldFill = new Graphics();
    heldFill.circle(0, 0, BTN_CSS_RADIUS).fill({ color, alpha: HELD_ALPHA });
    heldFill.visible = false;
    parent.addChild(heldFill);

    const hit = new Graphics();
    hit.circle(0, 0, BTN_CSS_RADIUS * 1.15).fill({ color: 0x000000, alpha: 0.01 });
    hit.cursor = 'pointer';
    parent.addChild(hit);

    const text = new Text({
        text: label,
        style: {
            fontFamily: 'monospace',
            fontSize: Math.round(BTN_CSS_RADIUS * 0.7),
            fill: color,
            align: 'center',
        },
    });
    text.anchor.set(0.5, 0.5);
    text.alpha = 0.6;
    fitLabel(text);
    parent.addChild(text);

    // One finger at a time, so another finger lifting elsewhere doesn't let the button go
    listenToPointer({
        target: hit,
        onPressed: () => onChanged(true),
        onReleased: () => onChanged(false),
    });

    return { text, heldFill };
}

/** Shrinks a button's label, if it must, to fit inside the button. */
function fitLabel(text: Text): void {
    text.scale.set(1);
    const maxWidth = BTN_CSS_RADIUS * 1.6;
    if (text.width > maxWidth) text.scale.set(maxWidth / text.width);
}
