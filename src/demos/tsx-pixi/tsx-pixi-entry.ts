import type { Container } from 'pixi.js';
import type { DemoEntry, DemoSession } from '../demo-entry';
import { createDemoModel } from './demo-model';
import { createDemoView } from './demo-view';

const ARENA_WIDTH = 480;
const ARENA_HEIGHT = 320;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTsxPixiEntry(): DemoEntry {
    return {
        id: 'tsx-pixi',
        name: 'Declarative Pixi with TSX',
        description:
            'Builds a Pixi.js scene graph declaratively using TSX. A custom JSX runtime ' +
            'maps elements like <container> and <text> to Pixi display objects. Dynamic ' +
            'props use getter functions polled each frame with change detection - no ' +
            'virtual DOM, no reactive library, just the MVT ticker loop.',
        techniques: [
            'Custom JSX runtime',
            'Function-valued props for dynamic bindings',
            'Per-frame change detection',
            'Zip-compare list reconciliation',
            'Memoized getters with auto-dep tracking',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/src/demos/tsx-pixi',
        screenWidth: ARENA_WIDTH,
        screenHeight: ARENA_HEIGHT,
        thumbnailAdvanceMs: 500,

        start(stage: Container): DemoSession {
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

            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
}
