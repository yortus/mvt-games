import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { HowToPlayCardView } from '../how-to-play-card-view';
import { EXAMPLE_SIZE, INK_COLOR, PAPER_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH, THIN_LINE_COLOR } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

// A game's example is its own; this one is a plain grid, to show where it goes
canvasTest('with an example, rules and controls', SIZE, () => {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    view.addChild(HowToPlayCardView({
        example: drawExample(),
        text: {
            rules: [
                'Join the dots in order, from 1 to 9, without lifting your pen.',
                'Every line must be straight. A line may cross another, but never run along it.',
            ],
            controls: [
                { action: 'Draw a line', inputs: ['drag'], note: 'Drag from one dot to the next' },
                { action: 'Rub out', inputs: ['tap'], note: 'Tap a line' },
                { action: 'Undo', inputs: [{ button: 'Undo' }] },
            ],
            notes: [],
        },
        onShowMePressed: () => undefined,
        onPlayPressed: () => undefined,
    }));
    return view;
});

function drawExample(): Graphics {
    const g = new Graphics();
    const step = EXAMPLE_SIZE / 3;
    for (let i = 0; i <= 3; i++) g.moveTo(i * step, 0).lineTo(i * step, EXAMPLE_SIZE).moveTo(0, i * step).lineTo(EXAMPLE_SIZE, i * step);
    g.stroke({ color: THIN_LINE_COLOR, width: 1 });
    return g.rect(0, 0, EXAMPLE_SIZE, EXAMPLE_SIZE).stroke({ color: INK_COLOR, width: 3 });
}
