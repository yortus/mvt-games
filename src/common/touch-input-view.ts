import { Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';
import { watch } from './watch';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TouchInputViewBindings {
    getCanvasWidth(): number;
    getCanvasHeight(): number;
    getGameX(): number;
    getGameY(): number;
    getGameWidth(): number;
    getGameHeight(): number;
    getScale(): number;
    getShowDpad(): boolean;
    getShowPrimary(): boolean;
    getShowSecondary(): boolean;
    getPrimaryLabel(): string;
    getSecondaryLabel(): string;
    getFloatingJoystick(): boolean;
    onXDirectionChanged?(direction: 'left' | 'none' | 'right'): void;
    onYDirectionChanged?(direction: 'up' | 'none' | 'down'): void;
    onPrimaryButtonChanged?(pressed: boolean): void;
    onSecondaryButtonChanged?(pressed: boolean): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTouchInputView(
    bindings: TouchInputViewBindings,
): Container {
    const view = new Container();
    view.label = 'touch-input';

    let dpadXDir: 'left' | 'none' | 'right' = 'none';
    let dpadYDir: 'up' | 'none' | 'down' = 'none';

    // Element groups - rebuilt on structural changes, repositioned every frame
    const dpadGroup = new Container();
    const primaryBtnGroup = new Container();
    const secondaryBtnGroup = new Container();
    view.addChild(dpadGroup, primaryBtnGroup, secondaryBtnGroup);

    let primaryText: Text | null = null;
    let secondaryText: Text | null = null;

    const watcher = watch({
        showDpad: bindings.getShowDpad,
        showPrimary: bindings.getShowPrimary,
        showSecondary: bindings.getShowSecondary,
        floatingJoystick: bindings.getFloatingJoystick,
        primaryLabel: bindings.getPrimaryLabel,
        secondaryLabel: bindings.getSecondaryLabel,
    });

    view.onRender = refresh;
    return view;

    // ---- Refresh / layout --------------------------------------------------

    function refresh(): void {
        const w = watcher.poll();

        const structuralChange = w.showDpad.changed ||
            w.showPrimary.changed || w.showSecondary.changed ||
            w.floatingJoystick.changed;

        if (structuralChange) {
            rebuild();
        }
        else {
            if (w.primaryLabel.changed && primaryText) {
                primaryText.text = bindings.getPrimaryLabel();
            }
            if (w.secondaryLabel.changed && secondaryText) {
                secondaryText.text = bindings.getSecondaryLabel();
            }
        }

        layout();
    }

    function rebuild(): void {
        // Release stale directions before tearing down event handlers
        if (dpadXDir !== 'none') {
            dpadXDir = 'none';
            bindings.onXDirectionChanged?.('none');
        }
        if (dpadYDir !== 'none') {
            dpadYDir = 'none';
            bindings.onYDirectionChanged?.('none');
        }

        destroyChildren(dpadGroup);
        destroyChildren(primaryBtnGroup);
        destroyChildren(secondaryBtnGroup);
        primaryText = null;
        secondaryText = null;

        if (bindings.getShowDpad()) {
            if (bindings.getFloatingJoystick()) {
                buildFloatingJoystick(dpadGroup);
            }
            else {
                buildFixedDpad(dpadGroup);
            }
        }

        if (bindings.getShowPrimary()) {
            primaryText = buildActionButton(
                primaryBtnGroup,
                bindings.getPrimaryLabel(),
                COLOR_PRIMARY,
                (pressed) => bindings.onPrimaryButtonChanged?.(pressed),
            );
        }

        if (bindings.getShowSecondary()) {
            secondaryText = buildActionButton(
                secondaryBtnGroup,
                bindings.getSecondaryLabel(),
                COLOR_SECONDARY,
                (pressed) => bindings.onSecondaryButtonChanged?.(pressed),
            );
        }
    }

    function layout(): void {
        const showDpad = bindings.getShowDpad();
        const showPrimary = bindings.getShowPrimary();
        const showSecondary = bindings.getShowSecondary();

        dpadGroup.visible = showDpad;
        primaryBtnGroup.visible = showPrimary;
        secondaryBtnGroup.visible = showSecondary;

        if (!showDpad && !showPrimary && !showSecondary) return;

        const canvasWidth = bindings.getCanvasWidth();
        const canvasHeight = bindings.getCanvasHeight();
        const gameX = bindings.getGameX();
        const gameY = bindings.getGameY();
        const gameWidth = bindings.getGameWidth();
        const gameHeight = bindings.getGameHeight();
        const invScale = 1 / bindings.getScale();

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

    // ---- Shared direction helper -------------------------------------------

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

    // ---- Floating joystick builder -----------------------------------------

    function buildFloatingJoystick(parent: Container): void {
        const thumbRadius = Math.round(DPAD_CSS_RADIUS * 0.4);

        // Invisible hit area covering the d-pad region (CSS-pixel coords)
        const hitArea = new Graphics();
        hitArea.rect(
            -DPAD_CSS_RADIUS * 1.5,
            -DPAD_CSS_RADIUS * 1.5,
            DPAD_CSS_RADIUS * 3,
            DPAD_CSS_RADIUS * 3,
        ).fill({ color: 0x000000, alpha: 0.01 });
        hitArea.eventMode = 'static';
        parent.addChild(hitArea);

        const base = new Graphics();
        base.circle(0, 0, DPAD_CSS_RADIUS).fill({ color: 0xffffff, alpha: 0.1 });
        base.circle(0, 0, DPAD_CSS_RADIUS).stroke({ color: 0xffffff, alpha: 0.15, width: 2 });
        base.visible = false;
        parent.addChild(base);

        const thumb = new Graphics();
        thumb.circle(0, 0, thumbRadius).fill({ color: 0xffffff, alpha: 0.25 });
        thumb.visible = false;
        parent.addChild(thumb);

        let trackingId: number | undefined;
        let originX = 0;
        let originY = 0;

        hitArea.on('pointerdown', (e: FederatedPointerEvent) => {
            if (trackingId !== undefined) return;
            trackingId = e.pointerId;
            originX = e.getLocalPosition(parent).x;
            originY = e.getLocalPosition(parent).y;
            base.position.set(originX, originY);
            thumb.position.set(originX, originY);
            base.visible = true;
            thumb.visible = true;
        });

        hitArea.on('pointermove', (e: FederatedPointerEvent) => {
            if (e.pointerId !== trackingId) return;
            const pos = e.getLocalPosition(parent);
            let dx = pos.x - originX;
            let dy = pos.y - originY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > DPAD_CSS_RADIUS) {
                dx = dx / dist * DPAD_CSS_RADIUS;
                dy = dy / dist * DPAD_CSS_RADIUS;
            }
            thumb.position.set(originX + dx, originY + dy);

            if (dist < DPAD_CSS_RADIUS * DEAD_ZONE) {
                setDirection('none', 'none');
            }
            else {
                const angle = Math.atan2(dy, dx);
                const shifted = angle + ZONE_SIZE / 2;
                const zone = ((Math.floor(shifted / ZONE_SIZE) % 8) + 8) % 8;
                setDirection(ZONE_X[zone], ZONE_Y[zone]);
            }
        });

        const release = (e: FederatedPointerEvent): void => {
            if (e.pointerId !== trackingId) return;
            trackingId = undefined;
            base.visible = false;
            thumb.visible = false;
            setDirection('none', 'none');
        };

        hitArea.on('pointerup', release);
        hitArea.on('pointerupoutside', release);
        hitArea.on('pointercancel', release);
    }

    // ---- Fixed D-pad builder -----------------------------------------------

    function buildFixedDpad(parent: Container): void {
        const dpadBg = new Graphics();
        dpadBg.circle(0, 0, DPAD_CSS_RADIUS).fill({ color: 0xffffff, alpha: 0.08 });
        parent.addChild(dpadBg);

        const arrowGfx = new Graphics();
        drawDpadArrows(arrowGfx, DPAD_CSS_RADIUS);
        arrowGfx.alpha = ARROW_ALPHA;
        parent.addChild(arrowGfx);

        const dpadHit = new Graphics();
        dpadHit.circle(0, 0, DPAD_CSS_RADIUS).fill({ color: 0x000000, alpha: 0.01 });
        dpadHit.eventMode = 'static';
        dpadHit.cursor = 'pointer';
        parent.addChild(dpadHit);

        let dpadTrackingId: number | undefined;

        dpadHit.on('pointerdown', (e: FederatedPointerEvent) => {
            if (dpadTrackingId !== undefined) return;
            dpadTrackingId = e.pointerId;
            updateDpadDirection(e.getLocalPosition(dpadHit));
        });

        dpadHit.on('pointermove', (e: FederatedPointerEvent) => {
            if (e.pointerId !== dpadTrackingId) return;
            updateDpadDirection(e.getLocalPosition(dpadHit));
        });

        const releaseDpad = (e: FederatedPointerEvent): void => {
            if (e.pointerId !== dpadTrackingId) return;
            dpadTrackingId = undefined;
            setDirection('none', 'none');
        };

        dpadHit.on('pointerup', releaseDpad);
        dpadHit.on('pointerupoutside', releaseDpad);
        dpadHit.on('pointercancel', releaseDpad);

        function updateDpadDirection(local: { x: number; y: number }): void {
            const { x, y } = local;
            const dist = Math.sqrt(x * x + y * y);

            if (dist < DPAD_CSS_RADIUS * DEAD_ZONE) {
                setDirection('none', 'none');
                return;
            }

            const angle = Math.atan2(y, x);
            const shifted = angle + ZONE_SIZE / 2;
            const zone = ((Math.floor(shifted / ZONE_SIZE) % 8) + 8) % 8;
            setDirection(ZONE_X[zone], ZONE_Y[zone]);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DPAD_CSS_RADIUS = 60;
const BTN_CSS_RADIUS = 30;
const MARGIN_CSS = 12;
const DEAD_ZONE = 0.2;
const ZONE_SIZE = Math.PI / 4;
const ZONE_X: readonly ('left' | 'none' | 'right')[] = ['right', 'right', 'none', 'left', 'left', 'left', 'none', 'right'];
const ZONE_Y: readonly ('up' | 'none' | 'down')[] = ['none', 'down', 'down', 'down', 'none', 'up', 'up', 'up'];
const ARROW_ALPHA = 0.3;
const COLOR_PRIMARY = 0x58a6ff;
const COLOR_SECONDARY = 0xf0883e;

function destroyChildren(container: Container): void {
    while (container.children.length > 0) {
        container.removeChildAt(0).destroy({ children: true });
    }
}

function drawDpadArrows(gfx: Graphics, radius: number): void {
    const r = radius * 0.65;
    const s = radius * 0.15;

    gfx.moveTo(r, 0).lineTo(r - s, -s).lineTo(r - s, s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
    gfx.moveTo(-r, 0).lineTo(-r + s, -s).lineTo(-r + s, s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
    gfx.moveTo(0, -r).lineTo(-s, -r + s).lineTo(s, -r + s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
    gfx.moveTo(0, r).lineTo(-s, r - s).lineTo(s, r - s).closePath().fill({ color: 0xffffff, alpha: 1.0 });
}

function buildActionButton(
    parent: Container,
    label: string,
    color: number,
    onChanged: (pressed: boolean) => void,
): Text {
    const bg = new Graphics();
    bg.circle(0, 0, BTN_CSS_RADIUS).fill({ color, alpha: 0.25 });
    bg.circle(0, 0, BTN_CSS_RADIUS).stroke({ color, alpha: 0.5, width: 2 });
    parent.addChild(bg);

    const hit = new Graphics();
    hit.circle(0, 0, BTN_CSS_RADIUS * 1.15).fill({ color: 0x000000, alpha: 0.01 });
    hit.eventMode = 'static';
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
    parent.addChild(text);

    hit.on('pointerdown', () => {
        onChanged(true);
        bg.alpha = 1.0;
    });

    const release = (): void => {
        onChanged(false);
        bg.alpha = 1.0;
    };

    hit.on('pointerup', release);
    hit.on('pointerupoutside', release);
    hit.on('pointercancel', release);

    return text;
}
