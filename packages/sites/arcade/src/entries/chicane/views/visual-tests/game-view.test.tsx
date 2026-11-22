import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { COUNTDOWN_MS } from '../../data';
import { createGameModel, type GameModel, PLAYER_SHOOTER } from '../../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../game-view';
import { WARNING_FLASH_MS } from '../hud-view';
import { destroyAndFindLeaks } from '@mvtjs/pixi-3d';
import { expect, it } from 'vitest';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

// The car on the start line, the countdown at 2, the map, and the readouts at zero
canvasTest('counting down', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(1500, model, view);
    return view;
});

// Speeding up down the start straight, with the camera trailing, and GO fading
canvasTest('down the start straight', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    await advanceTime(2500, model, view);
    return view;
});

// Turning right into the long sweeper, sliding a little, with the front wheels turned
canvasTest('into the sweeper', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    await advanceTime(4200, model, view);
    model.steering = 1;
    await advanceTime(300, model, view);
    return view;
});

// Flat out off the track, a moment after the car hits a tree: the fireball, the debris, and the camera shaking
canvasTest('just wrecked', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    for (let elapsedMs = 0; model.car.wrecks === 0 && elapsedMs < 20000; elapsedMs += FRAME_MS) {
        model.steering = elapsedMs > 3000 && elapsedMs < 3600 ? 1 : 0;
        await advanceTime(FRAME_MS, model, view);
    }
    await advanceTime(250, model, view);
    return view;
});

// Catching the first rival, a little way ahead
canvasTest('catching a rival', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    for (let elapsedMs = 0; !isCarJustAhead(model) && elapsedMs < 30000; elapsedMs += FRAME_MS) {
        drive(model);
        await advanceTime(FRAME_MS, model, view);
    }
    return view;
});

// Firing through the rivals, a moment after a missile blows one up ahead: the explosion and the burning wreck
canvasTest('blowing up a rival', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    model.isFiring = true;
    for (let elapsedMs = 0; model.rivalsDestroyed === 0 && elapsedMs < 30000; elapsedMs += FRAME_MS) {
        drive(model);
        await advanceTime(FRAME_MS, model, view);
    }
    model.isFiring = false;
    await advanceTime(300, model, view);
    return view;
});

// A rival's missile closing from behind, with the warning flashing
canvasTest('a missile coming up behind', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    for (let elapsedMs = 0; !isMissileJustBehind(model) && elapsedMs < 120000; elapsedMs += FRAME_MS) {
        drive(model);
        await advanceTime(FRAME_MS, model, view);
    }
    return view;
});

// Over the line after three laps: the result over the race, and the finish on the gantry's board
canvasTest('finished', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(COUNTDOWN_MS, model, view);
    // Only the model plays out the race, which keeps the test quick. The view is ticked once the race is over,
    // long enough for the camera to settle behind the car
    for (let elapsedMs = 0; model.phase !== 'finished' && elapsedMs < 600_000; elapsedMs += FRAME_MS) {
        drive(model);
        model.update(FRAME_MS);
    }
    expect(model.phase).toBe('finished');
    await advanceTime(2000, model, view);
    return view;
});

const FRAME_MS = 1000 / 60;

// Leaving the race destroys its view, and the view must free every geometry, material and texture that its 3D views made.
// That includes the scoreboard's screen.
it('frees every resource that its 3D views made when it is destroyed', async () => {
    const model = createGameModel();
    const view = GameView({ model, controls: createArcadeControls() });
    await advanceTime(0, model, view);

    expect(destroyAndFindLeaks(view)).toEqual([]);
});

/** Whether a rival's missile is a little way behind your car, in view, while the warning shows. */
function isMissileJustBehind(model: GameModel): boolean {
    const { car, battle } = model;
    if (!model.isMissileIncoming || Math.floor(model.raceTimeMs / WARNING_FLASH_MS) % 2 !== 0) return false;
    for (let i = 0; i < battle.missiles.length; i++) {
        const missile = battle.missiles[i];
        if (!missile.isActive || missile.shooter === PLAYER_SHOOTER) continue;
        const behind = -((missile.x - car.x) * Math.cos(car.heading) + (missile.z - car.z) * Math.sin(car.heading));
        if (behind > 4 && behind < 10) return true;
    }
    return false;
}

/** Whether one of the other cars is a little way ahead of yours, and in view. */
function isCarJustAhead(model: GameModel): boolean {
    const { car, rivals } = model;
    for (let i = 0; i < rivals.cars.length; i++) {
        const other = rivals.cars[i];
        const along = (other.x - car.x) * Math.cos(car.heading) + (other.z - car.z) * Math.sin(car.heading);
        const across = -(other.x - car.x) * Math.sin(car.heading) + (other.z - car.z) * Math.cos(car.heading);
        if (along > 14 && along < 24 && Math.abs(across) < 6) return true;
    }
    return false;
}

/** A careful driver, which aims at a point a little way down the track, and brakes for the tight turns. */
function drive(model: GameModel): void {
    const { car, track } = model;
    const target = track.samples[(car.trackSample + 8) % track.samples.length];
    let turn = Math.atan2(target.z - car.z, target.x - car.x) - car.heading;
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    model.steering = turn > 0.03 ? 1 : turn < -0.03 ? -1 : 0;
    const isTight = Math.abs(turn) > 0.35;
    model.isBraking = isTight && car.speed > 26;
}
