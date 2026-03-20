import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { watch } from '#common';
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

const MENU_WIDTH = 960;
const MENU_HEIGHT = 540;
const TITLE_Y = 24;

// Carousel geometry
const CAROUSEL_CENTER_Y = 258;
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
const ZOOM_FRAMES = 25;
const ZOOM_STEP = 1 / ZOOM_FRAMES;
const ZOOM_TARGET_SCALE = Math.max(MENU_WIDTH / CARD_W, MENU_HEIGHT / CARD_H) * 1.15;

// Colors
const COLOR_TITLE = 0xffff00;
const COLOR_CARD_BG = 0x111122;
const COLOR_BORDER_SELECTED = 0xffff00;
const COLOR_BORDER_NORMAL = 0x333344;
const COLOR_NAME_SELECTED = 0xffffff;
const COLOR_NAME_NORMAL = 0xaaaaaa;

type TransitionKind = 'idle' | 'zoom-in' | 'zoom-out';

interface Card {
    container: Container;
    border: Graphics;
    thumb: Sprite | undefined;
    name: Text;
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

export function createCabinetView(bindings: CabinetViewBindings): Container {
    const watcher = watch({
        phase: bindings.getPhase,
        selected: bindings.getSelectedIndex,
        count: bindings.getGameCount,
    });

    // Presentation-only state
    let scrollCurrent = 0;
    let scrollTarget = 0;
    let highlightedIndex = -1;
    let lastNavDelta = 0;
    let transition: TransitionKind = 'idle';
    let transitionProgress = 0;
    let transitionCardIndex = 0;

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
    title.position.set(MENU_WIDTH / 2, TITLE_Y);
    menuLayer.addChild(title);

    const carousel = new Container();
    carousel.sortableChildren = true;
    menuLayer.addChild(carousel);

    const hint = new Text({
        text: '\u2190\u2192 Browse   \u2502   Enter Play   \u2502   Esc Back',
        style: {
            fontFamily: 'monospace',
            fontSize: 13,
            fill: 0x666666,
            align: 'center',
        },
    });
    hint.anchor.set(0.5, 1);
    hint.position.set(MENU_WIDTH / 2, MENU_HEIGHT - 16);
    menuLayer.addChild(hint);

    let cards: Card[] = [];

    // ---- Keyboard input ---------------------------------------------------

    function onKeyDown(e: KeyboardEvent): void {
        if (transition !== 'idle') return;

        const phase = bindings.getPhase();
        if (phase === 'menu') {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowUp' || e.key === 'w') {
                e.preventDefault();
                lastNavDelta = -1;
                bindings.onNavigate(-1);
            }
            else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'ArrowDown' || e.key === 's') {
                e.preventDefault();
                lastNavDelta = 1;
                bindings.onNavigate(1);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                transitionCardIndex = bindings.getSelectedIndex();
                transition = 'zoom-in';
                transitionProgress = 0;
            }
        }
        else if (phase === 'playing') {
            if (e.key === 'Escape') {
                e.preventDefault();
                transitionCardIndex = bindings.getSelectedIndex();
                bindings.onExit();
                menuLayer.visible = true;
                scrollCurrent = transitionCardIndex;
                scrollTarget = transitionCardIndex;
                highlightedIndex = -1;
                transition = 'zoom-out';
                transitionProgress = 1;
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

        if (watched.phase.changed && transition === 'idle') {
            menuLayer.visible = watched.phase.value === 'menu';
        }

        if (watched.count.changed) {
            buildCards();
            scrollCurrent = bindings.getSelectedIndex();
            scrollTarget = scrollCurrent;
        }

        if (watched.selected.changed && transition === 'idle') {
            advanceScrollTarget();
        }

        // ---- Transition handling ----
        if (transition === 'zoom-in') {
            transitionProgress = Math.min(1, transitionProgress + ZOOM_STEP);
            if (transitionProgress >= 1) {
                menuLayer.visible = false;
                bindings.onLaunch();
                transition = 'idle';
                transitionProgress = 0;
                resetCardChildAlphas();
            }
            else {
                positionCardsWithZoom();
            }
            return;
        }

        if (transition === 'zoom-out') {
            transitionProgress = Math.max(0, transitionProgress - ZOOM_STEP);
            positionCardsWithZoom();
            if (transitionProgress <= 0) {
                transition = 'idle';
                resetCardChildAlphas();
                highlightedIndex = -1;
            }
            return;
        }

        // ---- Normal carousel scroll ----
        const diff = scrollTarget - scrollCurrent;
        if (Math.abs(diff) < LERP_SNAP) {
            scrollCurrent = scrollTarget;
        }
        else {
            scrollCurrent += diff * LERP_SPEED;
        }

        positionCards();
    }

    function advanceScrollTarget(): void {
        scrollTarget += lastNavDelta;
        lastNavDelta = 0;
    }

    function resetCardChildAlphas(): void {
        for (let i = 0; i < cards.length; i++) {
            cards[i].border.alpha = 1;
            cards[i].name.alpha = 1;
            if (cards[i].thumb) cards[i].thumb!.alpha = 1;
        }
    }

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

        const centerX = MENU_WIDTH / 2;
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

            card.container.position.set(centerX + rel * CARD_STRIDE, CAROUSEL_CENTER_Y);
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

    function positionCardsWithZoom(): void {
        const count = bindings.getGameCount();
        if (count === 0) return;

        const t = smoothstep(transitionProgress);
        const centerX = MENU_WIDTH / 2;
        const half = count / 2;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];

            if (i === transitionCardIndex) {
                card.container.visible = true;
                card.container.position.set(
                    centerX,
                    CAROUSEL_CENTER_Y + (MENU_HEIGHT / 2 - CAROUSEL_CENTER_Y) * t,
                );
                card.container.scale.set(1 + (ZOOM_TARGET_SCALE - 1) * t);
                card.container.alpha = 1;
                card.container.zIndex = 2000;
                const alpha = Math.pow(1 - t, 4);
                card.border.alpha = alpha;
                card.name.alpha = alpha;
                if (card.thumb) card.thumb.alpha = alpha;
            }
            else {
                const rel = ((i - scrollCurrent) % count + count + half) % count - half;
                const absRel = Math.abs(rel);

                if (absRel > MAX_VISIBLE_DISTANCE) {
                    card.container.visible = false;
                    continue;
                }

                card.container.visible = true;
                const scale = Math.max(SCALE_MIN, 1 - absRel * SCALE_FALLOFF);
                const baseAlpha = Math.max(ALPHA_MIN, 1 - absRel * ALPHA_FALLOFF);

                card.container.position.set(centerX + rel * CARD_STRIDE, CAROUSEL_CENTER_Y);
                card.container.scale.set(scale);
                card.container.alpha = baseAlpha * (1 - t);
                card.container.zIndex = 1000 - Math.round(absRel * 100);
            }
        }

        title.alpha = 1 - t;
        hint.alpha = 1 - t;
    }
}
