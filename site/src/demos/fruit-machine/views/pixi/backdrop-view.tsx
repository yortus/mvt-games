/** @jsxImportSource @mvtjs/pixi/jsx */
import type { Container, Graphics } from 'pixi.js';
import { SYMBOL_COLORS } from '../art';
import { BACKDROP, BACKDROP_DECAL, FONT_FAMILY, FRAME, FRAME_SHADE, SCREEN_HEIGHT, SCREEN_WIDTH, WHITE } from './pixi-layout';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Everything behind the machine, drawn once: the backdrop, big soft discs,
 * confetti in the fruits' colours, and the title on its banner. It has no
 * bindings: nothing here follows the model.
 */
export function BackdropView(): Container {
    return (
        <container>
            <graphics ref={drawBackdrop} />
            <graphics ref={drawBanner} />
            <text text="FRUIT MACHINE" x={SCREEN_WIDTH / 2} y={40} anchor={0.5} style={TITLE_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TITLE_STYLE = {
    fontFamily: FONT_FAMILY,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 6,
    fill: WHITE,
};

const CONFETTI_COLORS = [
    SYMBOL_COLORS.pic1, SYMBOL_COLORS.pic2, SYMBOL_COLORS.pic4, SYMBOL_COLORS.pic5, SYMBOL_COLORS.pic6, SYMBOL_COLORS.wild,
];

function drawBackdrop(g: Graphics): void {
    g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(BACKDROP);
    g.circle(70, 470, 190).fill(BACKDROP_DECAL);
    g.circle(910, 70, 150).fill(BACKDROP_DECAL);
    g.circle(860, 520, 90).fill(BACKDROP_DECAL);

    // Confetti, scattered the same way every time: a small fixed sequence, not the model's random numbers
    let seed = 7;
    const next = (): number => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    for (let i = 0; i < 46; i++) {
        let x = next() * SCREEN_WIDTH;
        let y = next() * SCREEN_HEIGHT;
        // Only in the margins, never over the machine's parts
        while (isOverContent(x, y)) {
            x = next() * SCREEN_WIDTH;
            y = next() * SCREEN_HEIGHT;
        }
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 3 + next() * 5;
        switch (i % 3) {
            case 0:
                g.circle(x, y, size).fill(color);
                break;
            case 1:
                g.roundRect(x, y, size * 3, size * 1.2, size * 0.6).fill(color);
                break;
            default:
                g.poly([x, y - size * 1.4, x + size * 1.3, y + size, x - size * 1.3, y + size]).fill(color);
        }
    }
}

/** The parts of the screen confetti keeps off: the paytable, the window and its lights, the meters, the button and the title. */
const CONTENT_AREAS = [
    [0, 95, 190, 450], [160, 60, 800, 460], [190, 455, 770, 530], [800, 190, 940, 340], [270, 0, 690, 82],
];

function isOverContent(x: number, y: number): boolean {
    for (let i = 0; i < CONTENT_AREAS.length; i++) {
        const [left, top, right, bottom] = CONTENT_AREAS[i];
        if (x > left && x < right && y > top && y < bottom) return true;
    }
    return false;
}

function drawBanner(g: Graphics): void {
    const width = 380;
    const x = (SCREEN_WIDTH - width) / 2;
    g.roundRect(x, 20, width, 52, 26).fill(FRAME_SHADE);
    g.roundRect(x, 14, width, 52, 26).fill(FRAME);
}
