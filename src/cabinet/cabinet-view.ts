import gsap from 'gsap';
import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { isTouchDevice, watch } from '#common';
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
    getCanvasWidth(): number;
    getCanvasHeight(): number;
    onMovePressed(direction: 'left' | 'right'): void;
    onLaunchPressed(): void;
    onExitPressed(): void;
}

export interface CabinetView extends Container {
    requestExit(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCabinetView(bindings: CabinetViewBindings): CabinetView {
    const watcher = watch({
        phase: bindings.getPhase,
        selected: bindings.getSelectedIndex,
        count: bindings.getGameCount,
        canvasW: bindings.getCanvasWidth,
        canvasH: bindings.getCanvasHeight,
    });

    // Presentation-only state
    let scrollCurrent = 0;
    let scrollTarget = 0;
    let highlightedIndex = -1;
    let lastNavDelta = 0;
    let transitioning = false;
    let zoomTimeline: gsap.core.Timeline | undefined;
    let canvasW = bindings.getCanvasWidth();
    let canvasH = bindings.getCanvasHeight();

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
        if (transitioning) return;

        const phase = bindings.getPhase();
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
                startZoomIn(bindings.getSelectedIndex());
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
        if (transitioning || bindings.getPhase() !== 'menu') return;
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
            const selectedIdx = bindings.getSelectedIndex();
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
            const count = bindings.getGameCount();
            if (count > 0) {
                const targetIndex = ((nearest % count) + count) % count;
                const currentIndex = bindings.getSelectedIndex();
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

    view.onRender = refresh;

    const originalDestroy = view.destroy.bind(view);
    view.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        if (zoomTimeline) zoomTimeline.kill();
        originalDestroy(options);
    };

    /** Trigger the zoom-out exit animation (called from the pause menu). */
    const requestExit = (): void => {
        if (!transitioning && bindings.getPhase() === 'playing') {
            startZoomOut(bindings.getSelectedIndex());
        }
    };

    return Object.assign(view, { requestExit });

    // ---- Internals --------------------------------------------------------

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.phase.changed && !transitioning) {
            menuLayer.visible = watched.phase.value === 'menu';
        }

        if (watched.canvasW.changed || watched.canvasH.changed) {
            canvasW = bindings.getCanvasWidth();
            canvasH = bindings.getCanvasHeight();
            title.position.set(canvasW / 2, TITLE_Y);
            hint.position.set(canvasW / 2, canvasH - 16);
            highlightedIndex = -1;
        }

        if (watched.count.changed) {
            buildCards();
            scrollCurrent = bindings.getSelectedIndex();
            scrollTarget = scrollCurrent;
        }

        if (watched.selected.changed && !transitioning) {
            scrollTarget += lastNavDelta;
            lastNavDelta = 0;
        }

        if (transitioning) return;

        // Smooth scroll interpolation
        const diff = scrollTarget - scrollCurrent;
        if (Math.abs(diff) < LERP_SNAP) {
            scrollCurrent = scrollTarget;
        }
        else {
            scrollCurrent += diff * LERP_SPEED;
        }

        positionCards();
    }

    // ---- Zoom transitions (presentation-only GSAP timelines) --------------

    function startZoomIn(cardIndex: number): void {
        transitioning = true;
        const card = cards[cardIndex];
        const zoomScale = Math.max(canvasW / CARD_W, canvasH / CARD_H) * 1.15;

        const tl = zoomTimeline = gsap.timeline({
            onComplete() {
                menuLayer.visible = false;
                resetAllCards();
                bindings.onLaunchPressed();
                transitioning = false;
                zoomTimeline = undefined;
            },
        });

        // Fade out title and hint
        tl.to(title, { alpha: 0, duration: ZOOM_DURATION, ease: 'power2.in' }, 0);
        tl.to(hint, { alpha: 0, duration: ZOOM_DURATION, ease: 'power2.in' }, 0);

        // Fade out non-selected cards
        for (let i = 0; i < cards.length; i++) {
            if (i !== cardIndex) {
                tl.to(cards[i].container, { alpha: 0, duration: ZOOM_DURATION, ease: 'power2.in' }, 0);
            }
        }

        // Zoom the selected card to fill the screen
        tl.to(card.container.scale, { x: zoomScale, y: zoomScale, duration: ZOOM_DURATION, ease: 'power2.in' }, 0);
        tl.to(card.container.position, { y: canvasH / 2, duration: ZOOM_DURATION, ease: 'power2.in' }, 0);

        // Fade out card chrome (border, name, thumbnail)
        tl.to(card.border, { alpha: 0, duration: ZOOM_DURATION * 0.7, ease: 'power2.in' }, 0);
        tl.to(card.name, { alpha: 0, duration: ZOOM_DURATION * 0.7, ease: 'power2.in' }, 0);
        if (card.thumb) {
            tl.to(card.thumb, { alpha: 0, duration: ZOOM_DURATION * 0.7, ease: 'power2.in' }, 0);
        }
    }

    function startZoomOut(cardIndex: number): void {
        transitioning = true;

        bindings.onExitPressed();
        menuLayer.visible = true;

        // Position all cards at their normal carousel positions
        scrollCurrent = cardIndex;
        scrollTarget = cardIndex;
        highlightedIndex = -1;
        positionCards();

        const card = cards[cardIndex];
        const carouselY = canvasH * 0.45;
        const zoomScale = Math.max(canvasW / CARD_W, canvasH / CARD_H) * 1.15;

        const tl = zoomTimeline = gsap.timeline({
            onComplete() {
                transitioning = false;
                highlightedIndex = -1;
                zoomTimeline = undefined;
                positionCards();
            },
        });

        // Title and hint
        tl.fromTo(title, { alpha: 0 }, { alpha: 1, duration: ZOOM_DURATION, ease: 'power2.out' }, 0);
        tl.fromTo(hint, { alpha: 0 }, { alpha: 1, duration: ZOOM_DURATION, ease: 'power2.out' }, 0);

        // Non-selected cards fade in from 0 to their distance-based alpha
        for (let i = 0; i < cards.length; i++) {
            if (i !== cardIndex) {
                tl.fromTo(cards[i].container, { alpha: 0 }, { alpha: cards[i].container.alpha, duration: ZOOM_DURATION, ease: 'power2.out' }, 0);
            }
        }

        // Selected card shrinks from zoomed to normal
        tl.fromTo(card.container.scale, { x: zoomScale, y: zoomScale }, { x: 1, y: 1, duration: ZOOM_DURATION, ease: 'power2.out' }, 0);
        tl.fromTo(card.container.position, { y: canvasH / 2 }, { y: carouselY, duration: ZOOM_DURATION, ease: 'power2.out' }, 0);

        // Card chrome fades in
        tl.fromTo(card.border, { alpha: 0 }, { alpha: 1, duration: ZOOM_DURATION * 0.7, ease: 'power2.out' }, ZOOM_DURATION * 0.3);
        tl.fromTo(card.name, { alpha: 0 }, { alpha: 1, duration: ZOOM_DURATION * 0.7, ease: 'power2.out' }, ZOOM_DURATION * 0.3);
        if (card.thumb) {
            tl.fromTo(card.thumb, { alpha: 0 }, { alpha: 1, duration: ZOOM_DURATION * 0.7, ease: 'power2.out' }, ZOOM_DURATION * 0.3);
        }
    }

    function resetAllCards(): void {
        title.alpha = 1;
        hint.alpha = 1;
        for (let i = 0; i < cards.length; i++) {
            cards[i].container.alpha = 1;
            cards[i].container.scale.set(1);
            cards[i].border.alpha = 1;
            cards[i].name.alpha = 1;
            if (cards[i].thumb) cards[i].thumb!.alpha = 1;
        }
    }

    // ---- Card building and layout -----------------------------------------

    function buildCards(): void {
        for (let i = 0; i < cards.length; i++) {
            cards[i].container.destroy({ children: true });
        }
        cards = [];
        highlightedIndex = -1;

        const count = bindings.getGameCount();
        for (let i = 0; i < count; i++) {
            const cardContainer = new Container();
            cardContainer.pivot.set(CARD_W / 2, CARD_H / 2);

            // Background
            const bg = new Graphics();
            bg.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS).fill(COLOR_CARD_BG);
            cardContainer.addChild(bg);

            // Thumbnail
            const tex = bindings.getGameThumbnail(i);
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
                text: bindings.getGameName(i),
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
        const count = bindings.getGameCount();
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

// Smooth scroll interpolation
const LERP_SPEED = 0.15;
const LERP_SNAP = 0.01;

// Zoom transition
const ZOOM_DURATION = 0.4;

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
