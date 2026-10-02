import { Power2 } from 'gsap';
import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { isTouchDevice } from '#common';
import { watch } from '@mvtjs/utils';
import type { CabinetPhase } from './cabinet-model';
import { setTickMethods } from '../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CabinetViewBindings {
    /** When this changes from `'playing'` to `'menu'`, the view zooms back out to the menu. */
    phase: () => CabinetPhase;
    gameCount: () => number;
    gameNameAt: (index: number) => string;
    gameThumbnailAt: (index: number) => Texture | undefined;
    selectedIndex: () => number;
    canvasWidth: () => number;
    canvasHeight: () => number;
    onMovePressed: (direction: 'left' | 'right') => void;
    /** Reported once the zoom into the selected game has finished. */
    onLaunchPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game-selection menu: a carousel of game cards, zooming into the chosen
 * game when it launches and back out when the game exits. Written in plain
 * TypeScript: it lays out and animates its cards by hand.
 *
 * `update` advances the presentation state (the scroll, and the zoom) and
 * `refresh` draws it; neither does the other's job.
 */
export function CabinetView(bindings: CabinetViewBindings): Container {
    // Polled by `update`, for the edges that start presentation transitions
    const stateWatcher = watch({
        phase: bindings.phase,
        selected: bindings.selectedIndex,
        count: bindings.gameCount,
    });
    // Polled by `refresh`, for the edges that change what is drawn
    const layoutWatcher = watch({
        count: bindings.gameCount,
        canvasW: bindings.canvasWidth,
        canvasH: bindings.canvasHeight,
    });

    // ---- Presentation state -----------------------------------------------
    // Valid from construction: the first refresh may come before the first
    // update.

    /** The carousel's scroll position, in cards, eased towards `scrollTarget`. */
    let scrollCurrent = bindings.selectedIndex();
    let scrollTarget = scrollCurrent;
    /** The direction of the last keyboard move, applied when the selection changes. */
    let lastNavDelta = 0;

    let zoomPhase: ZoomPhase = 'none';
    /** The card being zoomed into or out of. */
    let zoomCardIndex = 0;
    let zoomElapsedMs = 0;
    /**
     * How far the zoom has gone, eased: 0 shows the carousel, 1 has the zoomed
     * card filling the screen and everything else faded out.
     */
    let zoomAmount = 0;
    /** The same for the zoomed card's border, name and thumbnail, which fade on their own schedule. */
    let chromeZoomAmount = 0;

    // The state above already matches the bindings, so `update` reacts only
    // to changes from here on. Otherwise its first poll would see them all as
    // changed, and a key pressed before the first update would move the
    // scroll twice.
    stateWatcher.poll();

    // ---- What `refresh` last drew -----------------------------------------
    let highlightedIndex = -1;
    let canvasW = bindings.canvasWidth();
    let canvasH = bindings.canvasHeight();

    // ---- Scene elements ---------------------------------------------------
    const view = new Container();

    const menuLayer = new Container();
    view.addChild(menuLayer);

    const title = new Text({
        text: '\u2726  MVT GAMES  \u2726',
        style: {
            fontFamily: 'monospace',
            fontSize: 32,
            fill: COLOR_TITLE,
            align: 'center',
        },
    });
    title.anchor.set(0.5, 0);
    title.position.set(canvasW / 2, TITLE_Y);
    menuLayer.addChild(title);

    const carousel = new Container();
    carousel.sortableChildren = true;
    menuLayer.addChild(carousel);

    const hint = new Text({
        text: isTouchDevice()
            ? '\u2190\u2192 Swipe   \u2502   Tap Play'
            : '\u2190\u2192 Browse   \u2502   Enter Play',
        style: {
            fontFamily: 'monospace',
            fontSize: 13,
            fill: 0x666666,
            align: 'center',
        },
    });
    hint.anchor.set(0.5, 1);
    hint.position.set(canvasW / 2, canvasH - 16);
    menuLayer.addChild(hint);

    let cards: Card[] = [];

    // ---- Keyboard input ---------------------------------------------------

    function onKeyDown(e: KeyboardEvent): void {
        if (zoomPhase !== 'none') return;

        const phase = bindings.phase();
        if (phase === 'menu') {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowUp' || e.key === 'w') {
                e.preventDefault();
                lastNavDelta = -1;
                bindings.onMovePressed('left');
            }
            else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'ArrowDown' || e.key === 's') {
                e.preventDefault();
                lastNavDelta = 1;
                bindings.onMovePressed('right');
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                startZoomIn(bindings.selectedIndex());
            }
        }
    }

    window.addEventListener('keydown', onKeyDown);

    // ---- Touch / pointer input --------------------------------------------

    let swipeStartX = 0;
    let swipePointerId: number | undefined;
    let swipeScrollAnchor = 0;
    let swiped = false;

    menuLayer.eventMode = 'static';
    menuLayer.hitArea = { contains: () => true };

    menuLayer.on('pointerdown', (e) => {
        if (zoomPhase !== 'none' || bindings.phase() !== 'menu') return;
        if (swipePointerId !== undefined) return;
        swipePointerId = e.pointerId;
        swipeStartX = e.globalX;
        swipeScrollAnchor = scrollCurrent;
        swiped = false;
    });

    menuLayer.on('pointermove', (e) => {
        if (e.pointerId !== swipePointerId) return;
        const dx = e.globalX - swipeStartX;
        if (!swiped && Math.abs(dx) > SWIPE_DEAD_ZONE) {
            swiped = true;
        }
        if (swiped) {
            scrollCurrent = swipeScrollAnchor - dx / CARD_STRIDE;
            scrollTarget = scrollCurrent;
        }
    });

    const releaseSwipe = (e: { pointerId: number; globalX: number; globalY: number }): void => {
        if (e.pointerId !== swipePointerId) return;
        swipePointerId = undefined;
        if (!swiped) {
            const selectedIdx = bindings.selectedIndex();
            const card = cards[selectedIdx];
            if (card) {
                const b = card.container.getBounds();
                if (e.globalX >= b.minX && e.globalX <= b.maxX
                    && e.globalY >= b.minY && e.globalY <= b.maxY) {
                    startZoomIn(selectedIdx);
                }
            }
        }
        else {
            // Snap to nearest card and sync the model's selected index
            const nearest = Math.round(scrollCurrent);
            scrollTarget = nearest;
            const count = bindings.gameCount();
            if (count > 0) {
                const targetIndex = ((nearest % count) + count) % count;
                const currentIndex = bindings.selectedIndex();
                if (targetIndex !== currentIndex) {
                    let delta = targetIndex - currentIndex;
                    if (delta > count / 2) delta -= count;
                    else if (delta < -count / 2) delta += count;
                    lastNavDelta = 0;
                    bindings.onMovePressed(delta > 0 ? 'right' : 'left');
                }
            }
        }
    };

    menuLayer.on('pointerup', releaseSwipe);
    menuLayer.on('pointerupoutside', releaseSwipe);
    menuLayer.on('pointercancel', () => {
        swipePointerId = undefined;
    });

    // ---- Lifecycle --------------------------------------------------------

    setTickMethods(view, { update, refresh });

    view.on('destroyed', () => {
        window.removeEventListener('keydown', onKeyDown);
    });

    return view;

    // ---- Internals --------------------------------------------------------

    function refresh(): void {
        const watched = layoutWatcher.poll();

        if (watched.canvasW.changed || watched.canvasH.changed) {
            canvasW = watched.canvasW.value;
            canvasH = watched.canvasH.value;
            title.position.set(canvasW / 2, TITLE_Y);
            hint.position.set(canvasW / 2, canvasH - 16);
            highlightedIndex = -1;
        }

        // Structure that follows state changes here, never in `update`
        if (watched.count.changed) buildCards();

        // Hidden while a game plays, and from the end of the zoom into a game
        // until it starts, which may take a few frames while it loads
        menuLayer.visible = bindings.phase() === 'menu' && zoomPhase !== 'zoomed-in';

        positionCards();
        applyZoom();
    }

    /** Advances the presentation state: the carousel's eased scroll, and the zoom. */
    function update(deltaMs: number): void {
        const watched = stateWatcher.poll();

        if (watched.count.changed) {
            scrollCurrent = bindings.selectedIndex();
            scrollTarget = scrollCurrent;
        }

        if (watched.phase.changed) {
            if (watched.phase.value === 'playing') {
                // Launched, after zooming in or directly (from the URL)
                setZoomPhase('none');
            }
            else if (watched.phase.previous === 'playing') {
                // The game has exited: zoom back out of its card to the menu,
                // showing its start this frame
                startZoomOut(bindings.selectedIndex());
                return;
            }
        }

        if (zoomPhase === 'zooming-in' || zoomPhase === 'zooming-out') {
            advanceZoom(deltaMs);
            return;
        }

        if (watched.selected.changed) {
            scrollTarget += lastNavDelta;
            lastNavDelta = 0;
        }

        // Ease the scroll towards its target: LERP_SPEED of the way per 60fps
        // frame, whatever the frame rate.
        const diff = scrollTarget - scrollCurrent;
        if (Math.abs(diff) < LERP_SNAP) {
            scrollCurrent = scrollTarget;
        }
        else {
            scrollCurrent += diff * (1 - Math.pow(1 - LERP_SPEED, deltaMs / FRAME_MS_60FPS));
        }
    }

    // ---- Zoom transitions -------------------------------------------------
    // Presentation state only, advanced by `update(deltaMs)` and drawn by
    // `applyZoom` in `refresh`.

    function startZoomIn(cardIndex: number): void {
        zoomCardIndex = cardIndex;
        setZoomPhase('zooming-in');
    }

    function startZoomOut(cardIndex: number): void {
        zoomCardIndex = cardIndex;
        scrollCurrent = cardIndex;
        scrollTarget = cardIndex;
        setZoomPhase('zooming-out');
    }

    function setZoomPhase(phase: ZoomPhase): void {
        zoomPhase = phase;
        zoomElapsedMs = 0;
        // Zooming out starts from fully zoomed in; every other phase starts
        // (or stays) where it shows the carousel or holds the zoomed card.
        zoomAmount = phase === 'zooming-out' || phase === 'zoomed-in' ? 1 : 0;
        chromeZoomAmount = zoomAmount;
    }

    function advanceZoom(deltaMs: number): void {
        zoomElapsedMs += deltaMs;
        const t = Math.min(1, zoomElapsedMs / ZOOM_DURATION_MS);
        if (zoomPhase === 'zooming-in') {
            // The chrome fades over the first part of the zoom
            zoomAmount = Power2.easeIn(t);
            chromeZoomAmount = Power2.easeIn(Math.min(1, t / CHROME_FADE_SHARE));
            if (t === 1) {
                setZoomPhase('zoomed-in');
                // A relay binding, not presentation output: launching was
                // deferred until the zoom finished.
                bindings.onLaunchPressed();
            }
        }
        else {
            // The chrome fades back in over the last part of the zoom
            zoomAmount = 1 - Power2.easeOut(t);
            chromeZoomAmount = 1 - Power2.easeOut(Math.max(0, (t - (1 - CHROME_FADE_SHARE)) / CHROME_FADE_SHARE));
            if (t === 1) setZoomPhase('none');
        }
    }

    /**
     * Draws the zoom over the carousel layout `positionCards` has just
     * written: the zoomed card grows to fill the screen and centres
     * vertically, its chrome fades, and everything else fades out.
     */
    function applyZoom(): void {
        const fade = 1 - zoomAmount;
        title.alpha = fade;
        hint.alpha = fade;

        const zoomScale = Math.max(canvasW / CARD_W, canvasH / CARD_H) * 1.15;
        const carouselY = canvasH * 0.45;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const isZoomed = i === zoomCardIndex;
            const chromeAlpha = isZoomed ? 1 - chromeZoomAmount : 1;
            card.border.alpha = chromeAlpha;
            card.name.alpha = chromeAlpha;
            if (card.thumb) card.thumb.alpha = chromeAlpha;

            if (zoomAmount === 0) continue;
            if (isZoomed) {
                const scale = card.container.scale.x;
                card.container.scale.set(scale + (zoomScale - scale) * zoomAmount);
                card.container.y = carouselY + (canvasH / 2 - carouselY) * zoomAmount;
            }
            else if (card.container.visible) {
                // Scales the alpha `positionCards` has just written; cards it
                // hid keep theirs, so it is written once per refresh either way.
                card.container.alpha *= fade;
            }
        }
    }

    // ---- Card building and layout -----------------------------------------

    function buildCards(): void {
        for (let i = 0; i < cards.length; i++) {
            cards[i].container.destroy({ children: true });
        }
        cards = [];
        highlightedIndex = -1;

        const count = bindings.gameCount();
        for (let i = 0; i < count; i++) {
            const cardContainer = new Container();
            cardContainer.pivot.set(CARD_W / 2, CARD_H / 2);

            // Background
            const bg = new Graphics();
            bg.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS).fill(COLOR_CARD_BG);
            cardContainer.addChild(bg);

            // Thumbnail
            const tex = bindings.gameThumbnailAt(i);
            let thumb: Sprite | undefined;
            if (tex) {
                thumb = new Sprite(tex);
                const scale = Math.min(THUMB_W / tex.width, THUMB_H / tex.height);
                thumb.width = tex.width * scale;
                thumb.height = tex.height * scale;
                thumb.position.set(THUMB_PAD + (THUMB_W - thumb.width) / 2, THUMB_PAD + (THUMB_H - thumb.height) / 2);
                cardContainer.addChild(thumb);
            }

            // Game name
            const name = new Text({
                text: bindings.gameNameAt(i),
                style: {
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fill: COLOR_NAME_NORMAL,
                    align: 'center',
                },
            });
            name.anchor.set(0.5, 0);
            name.position.set(CARD_W / 2, CARD_H - NAME_H + 4);
            cardContainer.addChild(name);

            // Border (drawn on top)
            const border = new Graphics();
            cardContainer.addChild(border);

            carousel.addChild(cardContainer);
            cards.push({ container: cardContainer, border, thumb, name });
        }
    }

    function positionCards(): void {
        const count = bindings.gameCount();
        if (count === 0) return;

        const centerX = canvasW / 2;
        const carouselY = canvasH * 0.45;
        const half = count / 2;

        let nearestIndex = 0;
        let nearestDist = Infinity;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];

            const rel = ((i - scrollCurrent) % count + count + half) % count - half;
            const absRel = Math.abs(rel);

            if (absRel < nearestDist) {
                nearestDist = absRel;
                nearestIndex = i;
            }

            if (absRel > MAX_VISIBLE_DISTANCE) {
                card.container.visible = false;
                continue;
            }

            card.container.visible = true;

            const scale = Math.max(SCALE_MIN, 1 - absRel * SCALE_FALLOFF);
            const alpha = Math.max(ALPHA_MIN, 1 - absRel * ALPHA_FALLOFF);

            card.container.position.set(centerX + rel * CARD_STRIDE, carouselY);
            card.container.scale.set(scale);
            card.container.alpha = alpha;

            card.container.zIndex = 1000 - Math.round(absRel * 100);
        }

        if (nearestIndex !== highlightedIndex) {
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const sel = i === nearestIndex;

                card.border.clear();
                if (sel) {
                    card.border.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
                        .stroke({ color: COLOR_BORDER_SELECTED, width: 2 });
                }
                else {
                    card.border.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS)
                        .stroke({ color: COLOR_BORDER_NORMAL, width: 1 });
                }

                card.name.style.fill = sel ? COLOR_NAME_SELECTED : COLOR_NAME_NORMAL;
            }
            highlightedIndex = nearestIndex;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TITLE_Y = 24;

// Carousel geometry
const CARD_W = 220;
const CARD_H = 160;
const CARD_STRIDE = 250;
const CARD_RADIUS = 6;
const THUMB_PAD = 6;
const NAME_H = 24;
const THUMB_W = CARD_W - THUMB_PAD * 2;
const THUMB_H = CARD_H - NAME_H - THUMB_PAD * 2;

// Depth-based visual falloff
const SCALE_FALLOFF = 0.14;
const SCALE_MIN = 0.55;
const ALPHA_FALLOFF = 0.25;
const ALPHA_MIN = 0.15;
const MAX_VISIBLE_DISTANCE = 3.5;

// Smooth scroll interpolation: the share of the remaining distance covered per
// 60fps frame, and the distance at which the scroll snaps to its target.
const LERP_SPEED = 0.15;
const LERP_SNAP = 0.01;
const FRAME_MS_60FPS = 1000 / 60;

// Zoom transition
const ZOOM_DURATION_MS = 400;
/** The share of the zoom over which the zoomed card's chrome fades. */
const CHROME_FADE_SHARE = 0.7;

/**
 * Where the zoom into and out of a game's card is. `'zoomed-in'` holds the
 * card filling the screen, the menu hidden, until the launched game starts.
 */
type ZoomPhase = 'none' | 'zooming-in' | 'zoomed-in' | 'zooming-out';

// Touch / pointer
/** Minimum pointer distance (logical px) to distinguish swipe from tap. */
const SWIPE_DEAD_ZONE = 8;

// Colors
const COLOR_TITLE = 0xffff00;
const COLOR_CARD_BG = 0x111122;
const COLOR_BORDER_SELECTED = 0xffff00;
const COLOR_BORDER_NORMAL = 0x333344;
const COLOR_NAME_SELECTED = 0xffffff;
const COLOR_NAME_NORMAL = 0xaaaaaa;

interface Card {
    container: Container;
    border: Graphics;
    thumb: Sprite | undefined;
    name: Text;
}
