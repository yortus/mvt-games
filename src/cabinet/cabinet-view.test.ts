// @vitest-environment happy-dom
import { Container, Texture } from 'pixi.js';
import { Power2 } from 'gsap';
import { afterEach, describe, expect, it } from 'vitest';
import { tickScene } from '../pixi-mvt';
import type { CabinetPhase } from './cabinet-model';
import { CabinetView } from './cabinet-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WIDTH = 800;
const HEIGHT = 600;
const CARD_W = 220;
const CARD_H = 160;
const ZOOM_MS = 400;
const ZOOM_SCALE = Math.max(WIDTH / CARD_W, HEIGHT / CARD_H) * 1.15;
const CAROUSEL_Y = HEIGHT * 0.45;

interface Cabinet {
    readonly view: Container;
    readonly state: { phase: CabinetPhase; selected: number; launches: number };
    /** The menu layer, which holds the title, the carousel and the hint. */
    readonly menu: Container;
    readonly title: Container;
    card: (index: number) => Container;
    /** The card's border, which fades during the zoom. */
    border: (index: number) => Container;
    /** One frame, as the ticker runs it: update, then refresh. */
    frame: (deltaMs: number) => void;
}

let current: Cabinet | undefined;

afterEach(() => {
    // The view listens for keys on `window` until it is destroyed
    current?.view.destroy({ children: true });
    current = undefined;
});

/** A cabinet of three games with the middle one selected, not yet refreshed. */
function createCabinet(): Cabinet {
    const state = { phase: 'menu' as CabinetPhase, selected: 1, launches: 0 };
    const view = CabinetView({
        phase: () => state.phase,
        gameCount: () => 3,
        gameNameAt: (i) => `Game ${i}`,
        gameThumbnailAt: () => Texture.WHITE,
        selectedIndex: () => state.selected,
        canvasWidth: () => WIDTH,
        canvasHeight: () => HEIGHT,
        onMovePressed: (direction) => {
            state.selected = (state.selected + (direction === 'right' ? 1 : 2)) % 3;
        },
        onLaunchPressed: () => {
            state.launches++;
        },
    });
    const menu = view.children[0] as Container;
    const carousel = menu.children[1] as Container;
    const card = (index: number): Container => carousel.children[index] as Container;
    current = {
        view,
        state,
        menu,
        title: menu.children[0] as Container,
        card,
        border: (index) => card(index).children[3] as Container,
        frame: (deltaMs) => {
            tickScene({ root: view, deltaMs });
        },
    };
    return current;
}

function press(key: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

/** Runs frames of 16 ms until `durationMs` has passed. */
function run(cabinet: Cabinet, durationMs: number): void {
    for (let elapsed = 0; elapsed < durationMs; elapsed += 16) {
        cabinet.frame(Math.min(16, durationMs - elapsed));
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CabinetView', () => {
    it('lays out the carousel on its first refresh, before any update', () => {
        const cabinet = createCabinet();

        tickScene({ root: cabinet.view, only: 'refresh' });

        expect(cabinet.menu.visible).toBe(true);
        expect(cabinet.card(1).x).toBe(WIDTH / 2);
        expect(cabinet.card(1).y).toBeCloseTo(CAROUSEL_Y);
        expect(cabinet.card(1).scale.x).toBe(1);
        expect(cabinet.card(0).alpha).toBeLessThan(1);
    });

    it('scrolls a newly selected game to the centre', () => {
        const cabinet = createCabinet();
        tickScene({ root: cabinet.view, only: 'refresh' });

        press('ArrowRight');
        run(cabinet, 1000);

        expect(cabinet.state.selected).toBe(2);
        expect(cabinet.card(2).x).toBeCloseTo(WIDTH / 2);
    });

    it('zooms into the selected card when Enter is pressed', () => {
        const cabinet = createCabinet();
        tickScene({ root: cabinet.view, only: 'refresh' });
        const sideAlpha = cabinet.card(0).alpha;

        press('Enter');
        cabinet.frame(ZOOM_MS / 2);

        const zoom = Power2.easeIn(0.5);
        expect(cabinet.title.alpha).toBeCloseTo(1 - zoom);
        expect(cabinet.card(1).scale.x).toBeCloseTo(1 + (ZOOM_SCALE - 1) * zoom);
        expect(cabinet.card(1).y).toBeCloseTo(CAROUSEL_Y + (HEIGHT / 2 - CAROUSEL_Y) * zoom);
        expect(cabinet.card(0).alpha).toBeCloseTo(sideAlpha * (1 - zoom));
    });

    it('draws the same zoom however many times it is refreshed', () => {
        const cabinet = createCabinet();
        tickScene({ root: cabinet.view, only: 'refresh' });
        press('Enter');
        cabinet.frame(ZOOM_MS / 2);
        const drawn = { scale: cabinet.card(1).scale.x, side: cabinet.card(0).alpha, border: cabinet.border(1).alpha };

        tickScene({ root: cabinet.view, only: 'refresh' });
        tickScene({ root: cabinet.view, only: 'refresh' });

        expect(cabinet.card(1).scale.x).toBe(drawn.scale);
        expect(cabinet.card(0).alpha).toBe(drawn.side);
        expect(cabinet.border(1).alpha).toBe(drawn.border);
    });

    it('reports the launch once, when the zoom in finishes', () => {
        const cabinet = createCabinet();
        tickScene({ root: cabinet.view, only: 'refresh' });

        press('Enter');
        run(cabinet, ZOOM_MS - 16);
        expect(cabinet.state.launches).toBe(0);

        run(cabinet, 16);
        expect(cabinet.state.launches).toBe(1);
        expect(cabinet.menu.visible).toBe(false);
    });

    it('stays hidden and ignores input while the launched game loads', () => {
        const cabinet = createCabinet();
        tickScene({ root: cabinet.view, only: 'refresh' });
        press('Enter');
        run(cabinet, ZOOM_MS);

        // Still 'menu' until the game has loaded
        press('Enter');
        press('ArrowRight');
        run(cabinet, 500);

        expect(cabinet.state.launches).toBe(1);
        expect(cabinet.state.selected).toBe(1);
        expect(cabinet.menu.visible).toBe(false);

        cabinet.state.phase = 'playing';
        cabinet.frame(16);
        expect(cabinet.menu.visible).toBe(false);
    });

    it('zooms back out of the card when the game exits', () => {
        const cabinet = createCabinet();
        tickScene({ root: cabinet.view, only: 'refresh' });
        const sideAlpha = cabinet.card(0).alpha;
        press('Enter');
        run(cabinet, ZOOM_MS);
        cabinet.state.phase = 'playing';
        cabinet.frame(16);

        cabinet.state.phase = 'menu';
        cabinet.frame(16);

        // Drawn at its start on the frame the game exits
        expect(cabinet.menu.visible).toBe(true);
        expect(cabinet.card(1).scale.x).toBeCloseTo(ZOOM_SCALE);
        expect(cabinet.title.alpha).toBeCloseTo(0);
        expect(cabinet.border(1).alpha).toBeCloseTo(0);

        run(cabinet, ZOOM_MS);

        expect(cabinet.card(1).scale.x).toBe(1);
        expect(cabinet.card(1).y).toBeCloseTo(CAROUSEL_Y);
        expect(cabinet.title.alpha).toBe(1);
        expect(cabinet.border(1).alpha).toBe(1);
        expect(cabinet.card(0).alpha).toBeCloseTo(sideAlpha);
    });
});
