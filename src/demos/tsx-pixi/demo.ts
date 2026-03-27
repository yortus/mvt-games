import { Application } from 'pixi.js';
import { createDemoModel } from './demo-model';
import { createDemoView } from './demo-view';

const ARENA_WIDTH = 480;
const ARENA_HEIGHT = 320;

async function main(): Promise<void> {
    const app = new Application();
    await app.init({
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
        background: 0x1a1a2e,
        antialias: true,
    });
    document.body.appendChild(app.canvas);

    const model = createDemoModel({ arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT });

    const view = createDemoView({
        getScore: () => model.score,
        getPlayerX: () => model.playerX,
        getPlayerY: () => model.playerY,
        getPlayerAngle: () => model.playerAngle,
        getCoins: () => model.coins,
        getStars: () => model.stars,
        getMessage: () => model.message,
        onCoinTap: (index) => model.collectCoin(index),
    });

    app.stage.addChild(view);

    // MVT ticker loop: model advances, then Pixi renders (triggering onRender)
    app.ticker.add((ticker) => {
        model.update(ticker.deltaMS);
    });
}

main();
