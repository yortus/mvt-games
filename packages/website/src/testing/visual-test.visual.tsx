// The harness's own visual tests: what a Pixi picture covers, one case each.
import { Container, Graphics, Text } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { describe } from 'vitest';
import { advanceTime, visualTest } from '#testing';

describe('visualTest', () => {
    visualTest('framed by its bounds', () => new Graphics().circle(0, 0, 30).fill(0x5bd1ff));

    visualTest('placed by its own position', () => {
        const view = new Graphics().rect(0, 0, 60, 20).fill(0xffe45c);
        view.position.set(400, 300);
        return view;
    });

    visualTest('at a fixed size', () => new Graphics().rect(10, 10, 40, 40).fill(0xff4f8b), { width: 100, height: 60 });

    visualTest('pixel art', () => new Graphics().circle(20, 20, 16).fill(0x2fd27a), { pixelArt: true });

    // A big smooth view drawn at half resolution: a quarter of the pixels
    visualTest('at half resolution', () => new Graphics().roundRect(0, 0, 300, 160, 24).fill(0x5bd1ff).circle(150, 80, 50).fill(0xff4f8b), { resolution: 0.5 });

    visualTest('canvas text', () => new Text({ text: 'SPIN 1,250', style: { fontFamily: '"Segoe UI", sans-serif', fontSize: 24, fontWeight: '900', fill: 0xffffff } }));

    visualTest('after time passes', async () => {
        // A bar that grows in its update step: presentation state
        const bar = new Graphics();
        let width = 10;
        const view = new Container();
        view.addChild(bar);
        setUpdate(view, (deltaMs) => {
            width += deltaMs / 10;
            bar.clear().rect(0, 0, width, 12).fill(0xffffff);
        });
        await advanceTime({ views: [view], totalMs: 320 });
        return view;
    });
});
