import { Text } from 'pixi.js';
import { definePixiProject } from 'playground';
import { BulletView, PoseView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

/** The size of each test's screen, in pixels. */
const SCREEN_WIDTH = 136;
const SCREEN_HEIGHT = 150;

// The project: four tests' views of a bullet, side by side. Each is a
// BulletView built with stand-in bindings, as a test builds it, with no model
// and no game. Under each are the values its assertions read.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x161a2a,
    start: ({ stage }) => {
        const middle = SCREEN_HEIGHT / 2;

        const inFlight = BulletView({ x: () => SCREEN_WIDTH / 2, y: () => middle, isInFlight: () => true });
        const notInFlight = BulletView({ x: () => SCREEN_WIDTH / 2, y: () => middle, isInFlight: () => false });
        const atTheEdge = BulletView({ x: () => SCREEN_WIDTH, y: () => middle, isInFlight: () => true });

        // The second test's stand-in: a value it changes between refreshes.
        // Here it changes on every tick.
        let x = 50;
        let elapsedMs = 0;
        const moving = BulletView({ x: () => x, y: () => middle, isInFlight: () => true });

        const poses = [
            PoseView({
                title: 'shows a bullet\nin flight',
                pose: inFlight,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                readouts: [{ name: 'view.visible', value: () => inFlight.visible }],
            }),
            PoseView({
                title: 'hides a bullet\nnot in flight',
                pose: notInFlight,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                readouts: [{ name: 'view.visible', value: () => notInFlight.visible }],
            }),
            PoseView({
                title: 'shows a bullet at\nthe edge',
                pose: atTheEdge,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                readouts: [{ name: 'view.visible', value: () => atTheEdge.visible }],
            }),
            PoseView({
                title: 'moves the bullet to\nits new position',
                pose: moving,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                readouts: [
                    { name: 'view.visible', value: () => moving.visible },
                    { name: 'view.position.x', value: () => Math.round(moving.position.x) },
                ],
            }),
        ];

        const gap = (WIDTH - poses.length * SCREEN_WIDTH) / (poses.length + 1);
        for (let i = 0; i < poses.length; i++) {
            poses[i].position.set(gap + i * (SCREEN_WIDTH + gap), 64);
            stage.addChild(poses[i]);
        }
        const heading = new Text({
            text: "Four tests' views of a bullet, each built with stand-in bindings",
            style: { fontFamily: 'monospace', fontSize: 13, fill: 0x8890b0 },
        });
        heading.anchor.set(0.5, 0);
        heading.position.set(WIDTH / 2, 18);
        stage.addChild(heading);

        return {
            update(deltaMs: number) {
                // Sweeps x from 20 to 120 and back, every 4 seconds
                elapsedMs += deltaMs;
                x = 70 - 50 * Math.cos(elapsedMs / 2000 * Math.PI);
            },
        };
    },
});
