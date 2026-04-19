# Adding a Game

> Step-by-step guide to creating a new game module and registering it with
> the cabinet. Covers directory structure, GameEntry/GameSession interfaces,
> models, views, and the registration process.

See the [MVT documentation](../../docs/index.md) for architecture background.

## Overview

Each game in this project is a self-contained module under `src/games/<name>/`.
The cabinet manages game selection and delegates to the active game session
each frame. To add a new game, you need:

1. A directory structure with data, models, and views.
2. A `GameEntry` factory that describes your game to the cabinet.
3. A registration in `src/games/index.ts`.

## The `GameEntry` and `GameSession` Interfaces

Every game implements two interfaces defined in `src/games/game-entry.ts`:

**`GameEntry`** - a descriptor for a game that can be registered in the
cabinet:

```ts
interface GameEntry {
    readonly id: string;              // unique identifier (e.g. 'breakout')
    readonly name: string;            // display name (e.g. 'Breakout')
    readonly screenWidth: number;     // desired canvas width in pixels
    readonly screenHeight: number;    // desired canvas height in pixels
    readonly thumbnailAdvanceMs?: number;  // ms to advance for thumbnail
    load?(): Promise<void>;           // optional asset loading
    start(stage: Container): GameSession;
}
```

**`GameSession`** - a running game instance:

```ts
interface GameSession {
    update(deltaMs: number): void;    // advance game state
    destroy(): void;                  // tear down and clean up
}
```

The cabinet calls `entry.start(stage)` to launch the game, then calls
`session.update(deltaMs)` each frame. When the game exits,
`session.destroy()` cleans up.

## Directory Structure

Create a new directory under `src/games/`:

```
src/games/breakout/
├── index.ts              Barrel - re-exports createBreakoutEntry
├── breakout-entry.ts     GameEntry factory
├── data/
│   ├── index.ts          Barrel - re-exports shared game constants
│   └── constants.ts      Shared game constants (used by both models and views)
├── models/
│   ├── index.ts          Barrel - re-exports all models, types, and model constants
│   ├── model-constants.ts  Model-only constants (physics, scoring, timing)
│   ├── common.ts         Domain types (BrickKind, GamePhase, etc.)
│   ├── ball-model.ts     Ball position, velocity, bouncing
│   ├── paddle-model.ts   Paddle position, input
│   └── game-model.ts     Root model - composes children
└── views/
    ├── index.ts           Barrel - re-exports createGameView and view constants
    ├── view-constants.ts  View-only constants (pixel sizes, HUD layout)
    ├── game-view.ts       Top-level view - wires child views
    ├── ball-view.ts       Ball renderer
    ├── paddle-view.ts     Paddle renderer
    └── brick-view.ts      Brick renderer
```

Note: The `data/` directory is a practical organisational choice, not an MVT
architectural layer.

## Step 1: Define Constants

Constants are split by consumer to enforce layer separation:

**`data/constants.ts`** - shared game constants used by both models and views:

```ts
// Arena dimensions in domain units
export const ARENA_WIDTH = 300;
export const ARENA_HEIGHT = 400;
```

**`models/model-constants.ts`** - model-only constants (physics, scoring, timing):

```ts
// Ball physics
export const BALL_SPEED = 200;     // domain-units per second
export const BALL_RADIUS = 4;      // domain-units

// Paddle
export const PADDLE_WIDTH = 50;    // domain-units
export const PADDLE_SPEED = 300;   // domain-units per second
```

**`views/view-constants.ts`** - view-only constants (pixel sizes, HUD layout):

```ts
/** Height of the HUD bar in pixels. */
export const HUD_HEIGHT = 30;
```

Models import model constants from `./model-constants` and shared constants
from `../data`. Views import view constants from `./view-constants` and shared
constants from `../data`. This structure makes it architecturally clear which
constants belong to which layer, and makes accidental cross-layer references
obvious.

## Step 2: Create Models (`models/`)

Start with domain types in `common.ts`:

```ts
export type GamePhase = 'playing' | 'ball-lost' | 'game-over' | 'level-clear';
export type BrickKind = 'normal' | 'hard' | 'unbreakable';
```

Create child models for each game entity. Each child model:

- Exposes a public interface with `readonly` properties and an
  `update(deltaMs)` method.
- Uses a factory function (e.g. `createBallModel(options)`).
- Defines positions in domain units.

Create a root game model that composes the children, following the
advance-then-orchestrate pattern:

```ts
function createGameModel(options: GameModelOptions): GameModel {
    const ball = createBallModel(/* ... */);
    const paddle = createPaddleModel(/* ... */);
    // ...

    const model: GameModel = {
        get ball() { return ball; },
        get paddle() { return paddle; },
        // ...
        update(deltaMs) {
            ball.update(deltaMs);
            paddle.update(deltaMs);
            checkCollisions();
        },
    };
    return model;
}
```

## Step 3: Create Views (`views/`)

Create leaf views for each presentation entity, accepting bindings:

```ts
interface BallViewBindings {
    getX(): number;
    getY(): number;
}

function createBallView(bindings: BallViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, BALL_RADIUS * SCALE).fill(0xffffff);
    view.addChild(gfx);

    function refresh(): void {
        view.position.set(
            bindings.getX() * SCALE,
            bindings.getY() * SCALE,
        );
    }

    view.onRender = refresh;
    return view;
}
```

Note: `SCALE` here is a view-level constant that converts world-units to pixels. The
view imports it from the data layer or computes it from screen dimensions and
arena size. Models never reference it.

Create a top-level game view that receives the model directly and wires
bindings for each leaf view:

```ts
function createGameView(game: GameModel): Container {
    const view = new Container();

    view.addChild(createBallView({
        getX: () => game.ball.x,
        getY: () => game.ball.y,
    }));

    view.addChild(createPaddleView({
        getX: () => game.paddle.x,
        getWidth: () => PADDLE_WIDTH,
    }));

    // ... more child views ...
    return view;
}
```

## Step 4: Create the Entry Point

The entry point factory creates the `GameEntry` descriptor:

```ts
import type { GameEntry, GameSession } from '../game-entry';

function createBreakoutEntry(): GameEntry {
    return {
        id: 'breakout',
        name: 'Breakout',
        screenWidth: ARENA_WIDTH * SCALE,
        screenHeight: ARENA_HEIGHT * SCALE,

        start(stage: Container): GameSession {
            const gameModel = createGameModel({ /* options */ });
            const gameView = createGameView(gameModel);
            stage.addChild(gameView);

            return {
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
            };
        },
    };
}
```

The `start()` method creates the model and view, mounts the view, and returns
a session. The `destroy()` method removes the view and cleans up.

If your game needs to load assets (sprite sheets, textures), implement the
optional `load()` method:

```ts
async load(): Promise<void> {
    await Assets.load(spritesheet);
}
```

## Step 5: Register with the Cabinet

Export the entry factory from your module's barrel file:

```ts
// src/games/breakout/index.ts
export { createBreakoutEntry } from './breakout-entry';
```

Add the export to the games registry:

```ts
// src/games/index.ts
export { createBreakoutEntry } from './breakout';
```

Then add the entry to the cabinet's game list in the bootstrap code (typically
`src/main.ts` or wherever the cabinet is constructed):

```ts
const cabinet = createCabinetModel({
    games: [
        createAsteroidsEntry(),
        createBreakoutEntry(),  // new game
        // ...
    ],
});
```

## Checklist

- `data/` has constants in domain units (not pixels)
- Models have `update(deltaMs)` methods and use domain-level coordinates
- Models do not reference views or use wall-clock time
- Leaf views accept bindings, top-level view accepts model directly
- Views convert domain units to presentation units (pixels)
- Entry point implements `GameEntry` with `start()` returning `GameSession`
- Barrel files export public API at each level
- Game is registered in `src/games/index.ts`
- Model tests exist and pass
