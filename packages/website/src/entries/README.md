# Adding an Entry

> Step-by-step guide to adding a game or a demo to the Arcade. Covers the
> directory layout, the `start/` directory every entry has, models, views,
> the two kinds of starter, the catalogue and the thumbnail.

See the [MVT documentation](../../../docs/index.md) for architecture background.

## Overview

Everything the Arcade lists is an **entry**: a game, a demo, or one day an
art piece. Each is a self-contained module under
`packages/website/src/entries/<id>/`, named for its id. Games and demos are
built the same way; the difference is in their metadata, such as their
`kind` tag and a game's instructions. To add one, you need:

1. A directory with data, models, and views.
2. A `start/` directory: `entry.ts`, what the Arcade lists, and `load.ts`,
   the code it imports when the entry is launched.
3. A line in `catalogue.ts`.
4. A thumbnail.

The Arcade lists every entry without loading any entry's code, so the first
paint of the page stays small. The code, and the renderer it draws with,
load only when someone launches the entry.

## Originality

An entry here can be inspired by a classic, but must not copy it. Ideas,
genres and mechanics are free to use; titles, character names and designs,
artwork, music and specific level layouts are not.

- **Art** is drawn from scratch, in a generator script in `packages/website/scripts/`
  (`generate-<name>-textures.ts`) or in the entry's views, so where it came
  from is in the repo. Never use sprites ripped from another game, and do not
  trace or closely follow someone else's artwork, even reworked.
- **Characters** are your own designs, named for what they are.
- **Levels and mazes** are designed from a blank grid, not transcribed.
- **The title** is your own. Before adopting it, search it as a game (the
  web, Steam, the app stores) and in the trademark registers (USPTO, TMview).
- **In prose**, describe a game by its genre ("a maze chase", "inspired by
  golden-age arcade games"), not as a clone of a named game.
- **Credit the classic** a game is inspired by, if it is one game rather
  than a genre, in its entry's `inspiredBy`: the info panel shows "Inspired
  by Pac-Man (Namco, 1980)". This is the one place another game's title
  appears; the name, description and everything else stay the entry's own.

## Directory Structure

Create a new directory under `packages/website/src/entries/`, named for the
entry's id:

```
packages/website/src/entries/breakout/
├── index.ts              Barrel - export { entry } from './start'
├── start/
│   ├── index.ts          Barrel - export { entry } from './entry'
│   ├── entry.ts          `entry`: what the Arcade lists, and `load`
│   ├── load.ts           `load()`: loads the assets, returns how to start the entry
│   └── thumbnail.webp    Its card's picture (Step 6)
├── data/
│   ├── index.ts          Barrel - re-exports shared constants
│   └── constants.ts      Shared constants (used by both models and views)
├── models/
│   ├── index.ts          Barrel - re-exports all models, types, and model constants
│   ├── model-constants.ts  Model-only constants (physics, scoring, timing)
│   ├── common.ts         Domain types (BrickKind, GamePhase, etc.)
│   ├── ball-model.ts     Ball position, velocity, bouncing
│   ├── paddle-model.ts   Paddle position, input
│   └── game-model.ts     Root model - composes children
└── views/
    ├── index.ts           Barrel - re-exports GameView and view constants
    ├── view-constants.ts  View-only constants (pixel sizes, HUD layout)
    ├── game-view.ts       Top-level view - wires child views
    ├── ball-view.ts       Ball renderer
    ├── paddle-view.ts     Paddle renderer
    └── brick-view.ts      Brick renderer
```

`start/` is the same in every entry. Everything else is the entry's own: a
small demo may have only `models/` and `views/`. A view whose body is
written in JSX is a `.tsx` file instead; see Step 3.

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

Create leaf views for each presentation entity. A view is a function that
takes a bindings object and returns a Pixi container (see
[Style Guide: Views and Bindings](../../../docs/reference/style-guide.md#views-and-bindings)):

```ts
export interface BallViewBindings {
    x: () => number;
    y: () => number;
}
```

How the function builds its container is up to you. Write its body in JSX or
in plain TypeScript: neither is required, both give the same outside, and
callers cannot tell which a view uses. Here is the same ball view both ways.

In JSX, in `ball-view.tsx`:

```tsx
/** @jsxImportSource @mvtjs/pixi */

export function BallView(bindings: BallViewBindings): Container {
    return (
        <graphics
            x={() => bindings.x() * SCALE}
            y={() => bindings.y() * SCALE}
            ref={(g) => g.circle(0, 0, BALL_RADIUS * SCALE).fill(0xffffff)}
        />
    );
}
```

In plain TypeScript, in `ball-view.ts`:

```ts
export function BallView(bindings: BallViewBindings): Container {
    const view = new Graphics();
    view.circle(0, 0, BALL_RADIUS * SCALE).fill(0xffffff);

    setRefresh(view, () => { view.position.set(bindings.x() * SCALE, bindings.y() * SCALE); });
    return view;
}
```

Which to choose, view by view:

- **JSX** tends to suit views that are mostly a tree of display objects whose
  properties follow the model: sprites, text, a HUD, an overlay, and views
  that compose child views or project collections with `<List>`. The
  structure reads at a glance, and the runtime writes the refresh step for
  you.
- **Plain TypeScript** tends to suit views whose work is mostly drawing, or
  managing their own display objects each frame (a pool of sprites, a ring
  buffer of scrolling terrain), and views that need tight control of what
  happens each frame. It is also the natural choice if you would rather not
  use JSX at all.

A game can mix the two freely. Fuel Run, for example, writes its terrain in
plain TypeScript and its other views in JSX.

Note: `SCALE` here is a view-level constant that converts world-units to pixels. The
view imports it from the data layer or computes it from screen dimensions and
arena size. Models never reference it.

Create a top-level game view that takes the model in its bindings and wires
the bindings of each leaf view. Again, either kind of body works:

```ts
export interface GameViewBindings {
    model: GameModel;
}
```

```tsx
/** @jsxImportSource @mvtjs/pixi */

export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    return (
        <container>
            <BallView x={() => model.ball.x} y={() => model.ball.y} />
            <PaddleView x={() => model.paddle.x} width={PADDLE_WIDTH} />
            {/* ... more child views ... */}
        </container>
    );
}
```

```ts
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const view = new Container();
    view.addChild(
        BallView({ x: () => model.ball.x, y: () => model.ball.y }),
        PaddleView({ x: () => model.paddle.x, width: PADDLE_WIDTH }),
        // ... more child views ...
    );
    return view;
}
```

`width={PADDLE_WIDTH}` is a fixed value: `PaddleViewBindings` declares
`width: number`, so the paddle view reads it once, at construction, and does
not support it changing.

## Step 4: Write the Starter (`start/load.ts`)

`load()` loads the entry's assets and returns a **starter**: how to start the
entry, and how the host should run it. Its types are in
[`entry-types/`](../entry-types/entry-starter.ts). An entry drawn with Pixi
returns a `pixi` starter, and draws on a stage the host owns:

```ts
import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { textures } from '../data';

/** Loads Breakout's textures, and returns how to start it. */
export async function load(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
        pixelArt: true,
        integerScale: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,

        start({ stage }): EntrySession {
            const gameModel = createGameModel({ /* options */ });
            const gameView = GameView({ model: gameModel });
            stage.addChild(gameView);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
                inputConfig: {
                    showDpad: true,
                    onXDirectionChanged: (dir) => { gameModel.paddle.direction = dir; },
                },
            };
        },
    };
}
```

`start()` creates the model and view, mounts the view, and returns a
**session**. The session's `update()` advances the model and nothing else.
The host updates and refreshes the whole stage once per frame, after the
models, with `updateView(app.stage, deltaMs)`, which calls every view's
update method (for views with presentation state), then
`refreshView(app.stage)`, which calls every refresh method. So the session
never updates or refreshes its own views. Pausing is the host's call too:
while paused, it stops calling `update()` and leaves the entry's view out of
`updateView`, so an entry needs no pause logic of its own. `destroy()`
removes the view and cleans up.

A game gives an `inputConfig`: the controls it takes. The host turns the
keyboard, and touch controls on a touch screen, into the calls it lists.
The starter's other options say how the host should show the entry:
`pixelArt` (nearest-neighbour textures, no antialiasing), `integerScale`
(scale by whole numbers only, for crisp pixels), `fitTo` (for an entry that
lays itself out for the area it is given, as Boids does), and
`thumbnailAdvanceMs` (how far to run the entry before taking its thumbnail).

### Entries with their own renderers

An entry that draws with three.js, the DOM, or several renderers at once
returns an `element` starter instead. Its `start({ element })` builds the
entry inside an element the host gives it, and returns a session with two
more members: `views`, the roots of its views of every renderer, and
`render()`, which draws a frame. The host still runs each frame in the MVT
order: the session's `update`, then `updateView` and `refreshView` over its
`views`, then `render`. A renderer that starts asynchronously (Pixi's
`init`) makes the session's `ready` a promise that settles once it can
draw, so that a host taking one picture (a thumbnail, a visual test) waits
for it. See [Boids in 3D](./boids-3d/start/load.ts) for a small one, and
the [Fruit Machine](./fruit-machine/start/load.ts) for one model with
views on three renderers.

## Step 5: Describe the Entry (`start/entry.ts`)

`entry.ts` is what the Arcade shows without running anything: the card, the
search, and the info panel. It imports the starter only when the entry is
launched:

```ts
import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

/** Breakout, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'breakout',
    name: 'Breakout',
    summary: 'Knock out every brick with a ball and a paddle.',
    description: [
        'A bat-and-ball game. ...',
        'What it shows about MVT, for the info panel. ...',
    ].join('\n\n'),
    tags: { kind: 'game', era: '1970s', genres: ['action'] },
    screenWidth: 300,
    screenHeight: 400,
    thumbnail,
    cardColor: 'sky',
    instructions: 'Left and Right move the paddle.',
    load: async () => (await import('./load')).load(),
};
```

- **`id`** is the directory's name, and the entry's address: `/#breakout`
  launches it.
- **`tags`** are what the search filters by: its `kind` (`game`, `demo` or
  `art`), an `era` if it is in the style of one, and the `genres` that say
  what it is. The values are listed in
  [`arcade-entry.ts`](../entry-types/arcade-entry.ts).
- **`screenWidth`** and **`screenHeight`** are the play area, in the entry's
  own pixels: the same numbers its views use, written out, since importing
  them would bring the views, and their renderer, into the Arcade's first
  load. In development, the Arcade checks they match the starter's.
- A game gives **`instructions`**, for the info panel and the pause menu. A
  demo gives **`techniques`**, the patterns it shows.
- **`inspiredBy`** credits the classic the entry is inspired by, if there is
  one (`{ title, maker, year }`), as the [originality rules](#originality) ask.
  The info panel shows it, and the search finds the entry by its title.
- **`thumbnailCrop`** picks the part of the play area the card shows, and
  **`cardColor`** the card's colour, from the Arcade's palette. Both are
  optional.

The entry's size in lines and files, and the renderers it draws with, are
measured from its source when the site builds. Nobody writes them down.

Then export it through both barrels, `start/index.ts` and the entry's own
`index.ts`:

```ts
// start/index.ts
export { entry } from './entry';

// index.ts
export { entry } from './start';
```

## Step 6: List It, and Take Its Thumbnail

Add the entry to [`catalogue.ts`](./catalogue.ts), naming it as you import
it:

```ts
import { entry as breakoutEntry } from './breakout';

export const CATALOGUE: readonly ArcadeEntry[] = [
    // ...
    breakoutEntry,
];
```

The thumbnail is a picture of the entry running, taken by a script and
committed. Every page that lists the catalogue imports every entry's
thumbnail, so copy another entry's `thumbnail.webp` into `start/` as a
placeholder first, then take the real one:

```bash
npm run generate-thumbnails -- breakout
```

It starts the entry headless, advances it by `thumbnailAdvanceMs`, and saves
`start/thumbnail.webp`. Run it again whenever the entry's look changes.

The same moment is also the entry's visual test of its whole screen, which
it gets without any code: `entries.visual.tsx` (or `entries.html.visual.tsx`,
for an element entry) makes one for every entry in the catalogue. Record
its picture, look at it, and commit it:

```bash
npm run test:visual:update -- --picture breakout
```

Give the views their own visual tests too, one picture per state their
bindings can show: see
[Visual Tests](../../../docs/building-with-mvt/iterating-with-confidence/visual-tests.md).

## Checklist

- `data/` has constants in domain units (not pixels)
- Models have `update(deltaMs)` methods and use domain-level coordinates
- Models do not reference views or use wall-clock time
- Views are `XxxView(bindings)` functions; leaf views take query and relay
  bindings, the top-level view takes `{ model }`
- Views convert domain units to presentation units (pixels)
- `start/load.ts` returns a starter whose session's `update` advances only
  the models
- `start/entry.ts` exports `entry`, with its screen size matching the
  starter's
- Barrel files export public API at each level
- The entry is listed in `catalogue.ts`, and has its own thumbnail
- The entry's whole-screen picture is recorded, and its views have visual tests
- Model tests exist and pass
- The title, characters, art and levels are the entry's own (see [Originality](#originality))
