import { Container } from 'pixi.js';
import { setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/pixi';
import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { GameView, MenuView } from './views';

const WIDTH = 640;
const HEIGHT = 360;
/** The menu's bar takes the bottom of the stage, and the game the rest. */
const GAME_HEIGHT = 300;

// A ticker with a pause and a speed control, for a game and its menu in two
// separate layers. Neither the ball's model nor its views know that pausing
// or slow motion exist: the ticker only chooses what time to give them.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0a1628,
    start: ({ stage }) => {
        const game = createBallModel({ width: WIDTH, height: GAME_HEIGHT });

        // The ticker's own state: not the game's, and not a view's. The game
        // starts in slow motion, at half speed.
        let isPaused = false;
        let speed = 0.5;

        const gameLayer = GameView({ model: game });
        const menuLayer = MenuView({
            isPaused: () => isPaused,
            speed: () => speed,
            onPausePressed: () => {
                isPaused = !isPaused;
            },
            onSpeedPicked: (picked) => {
                speed = picked;
            },
            width: WIDTH,
            height: HEIGHT,
        });

        // Each frame, the playground calls `tick` below, then updates the
        // whole stage with the frame's real deltaMs, then refreshes it. The
        // game's layer must get the game's time instead, so it sits in a
        // holder whose update step skips everything inside it. The holder
        // isn't skipped by refreshView, so the game is refreshed, paused or not.
        const gameHolder = new Container();
        setUpdate(gameHolder, () => SKIP_DESCENDANTS);
        gameHolder.addChild(gameLayer);
        stage.addChild(gameHolder, menuLayer);

        return { update: tick };

        function tick(deltaMs: number): void {
            if (!isPaused) {
                const gameMs = deltaMs * speed; // 0.5 for slow motion, 2 for fast
                game.update(gameMs);
                updateView(gameLayer, gameMs);
            }
            // Then the playground does the rest, with the frame's real time:
            // updateView(menuLayer, deltaMs), as the menu runs in real time,
            // and refreshView(stage), for every view, paused or not
        }
    },
});
