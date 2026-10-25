# Adding an Entry

> Step-by-step guide to adding a game or a demo to the Arcade. Covers the
> directory layout, the `start/` directory every entry has, models, views,
> the two kinds of starter, the catalogue and the thumbnail.

See the [MVT documentation](../../../docs/index.md) for architecture background.

## Overview

Everything the Arcade lists is an **entry**: a game or a demo. A demo shows
a technique, or is a piece of art to watch. Each is a self-contained module under
`packages/sites/arcade/src/entries/<id>/`, named for its id. Games and demos are
built the same way; the difference is in their metadata, such as their
`kind` tag and how to play a game. To add one, you need:

1. A directory with data, models, and views.
2. A `start/` directory: `entry.ts`, what the Arcade's card shows,
   `details.ts`, the entry's long text, and `load.ts`, the code it imports
   when the entry is launched.
3. A line in `catalogue.ts`.
4. A thumbnail.

The Arcade lists every entry without loading any entry's code, so the first
paint of the page stays small. The code, and the renderer it draws with,
load only when someone launches the entry. The long text, for the info
panel and the search, loads just after the first paint.

## Originality

An entry here can be inspired by a classic, but must not copy it. Ideas,
genres and mechanics are free to use; titles, character names and designs,
artwork, music and specific level layouts are not.

- **Art** is drawn from scratch, in a generator script in `packages/sites/arcade/scripts/`
  (`generate-<name>-textures.ts`) or in the entry's views, so where it came
  from is in the repo. Never use sprites ripped from another game, and do not
  trace or closely follow someone else's artwork, even reworked.
- **Characters** are your own designs, named for what they are.
- **Levels and mazes** are designed from a blank grid, not transcribed.
- **The title** is your own. Before adopting it, search it as a game (the
  web, Steam, the app stores) and in the trademark registers (USPTO, TMview).
- **In prose**, describe a game by its genre ("a maze chase", "inspired by
  golden-age arcade games"), not as a clone of a named game.
- **Sound** is made in your code. Design each sound effect and instrument
  from its technique, and don't copy a synthesiser's factory preset. Never
  record or download a sound. An Audio90 sample is bounced from the chip's
  own engines, and you shouldn't rebuild a famous drum break hit for hit.
  Write your own melodies, chords and arrangements, in a genre's style.
  Name each sound for what it is, such as `PAD` or `EXPLODE`, never for a
  console, a sound chip or a synthesiser.
- **Credit the classic** a game is inspired by, if it is one game rather
  than a genre, in its entry's `inspiredBy`: the info panel shows "Inspired
  by Pac-Man (Namco, 1980)". This is the one place another game's title
  appears; the name, description and everything else stay the entry's own.

## Directory Structure

Create a new directory under `packages/sites/arcade/src/entries/`, named for the
entry's id:

```
packages/sites/arcade/src/entries/breakout/
├── index.ts              Barrel - export { entry } from './start'
├── start/
│   ├── index.ts          Barrel - export { entry } from './entry'
│   ├── entry.ts          `entry`: what the Arcade's card shows, `loadDetails` and `load`
│   ├── details.ts        `details`: the long text, for the info panel and the search
│   ├── load.ts           `load()`: loads the assets, returns how to start the entry
│   ├── thumbnail.webp    Its card's picture (Step 6)
│   └── share.png         Its link preview's picture (Step 6)
├── data/
│   ├── index.ts          Barrel - re-exports shared constants
│   └── constants.ts      Shared constants (used by both models and views)
├── models/
│   ├── index.ts          Barrel - re-exports all models, types, and model constants
│   ├── model-constants.ts  Model-only constants (physics, scoring, timing)
│   ├── common.ts         Domain types (BrickKind, GamePhase, etc.)
│   ├── ball-model.ts     Ball position, velocity, bouncing
│   ├── paddle-model.ts   Paddle position, and the way it is steered
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

### Text in the Style of an Era

If your entry is in the style of the 1970s to the 1990s, set its text in
the site's pixel glyphs rather than a system font. That's how the arcades
of the time looked, and it suits a pixel-art screen far better. The glyphs
cover every printable ASCII character. Each one is 5 cells wide and 7 tall,
with two more rows for letters that hang below the line. They live in
`#pixel-glyphs`, and two shared views draw them for you:

- **`PixelTextView`**, from `#shared`, draws a string in capitals. It uses
  a whole number of screen pixels for each cell, so the text stays crisp at
  any size. You can give it a shadow or an outline, and a `maxWidth` that
  it shrinks to fit. It only draws again when its text changes, so a HUD
  costs almost nothing.
- **`OverlayView`**, the shared overlay for messages such as "Paused", sets
  its message in the glyphs when you pass `font: 'pixel'`.

For text that would be about 9 to 12 pixels tall, use a scale of 1. For 14
to 20 pixels, use a scale of 2, if it fits. If your entry draws the glyphs
its own way, such as into a texture, read them from `#pixel-glyphs`
directly.

## Step 4: Write the Starter (`start/load.ts`)

`load()` loads the entry's assets and returns a **starter**: how to start the
entry, and how the host should run it. Its types are in
[`entry-types/`](../entry-types/entry-starter.ts). An entry drawn with Pixi
returns a `pixi` starter, and draws on a stage the host owns. The entry
makes its `load` with `definePixiLoader`, which types it for the chip its
starter plays on, if any (see [Sound](#sound)):

```ts
import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { textures } from '../data';

/** Loads Breakout's textures, and returns how to start it. It makes no sound, as yet. */
export const load = definePixiLoader(async () => {
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
});
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
Its callbacks are named for the controls (`onPrimaryButtonChanged`), and
the wiring is where you say what each one means. Give the model the
meaning, never the control. A button held to steer sets state named for
what it does (`paddle.direction`, `ship.isThrusting`), and a press that asks
for something once calls an action:

```ts
onRestartButtonChanged: (isDown) => {
    if (isDown) gameModel.startNewRun();
},
```

So the model never knows there is a button, and never watches for the
moment one is pressed. The host reports a button only when it goes down or
up, never again as a key repeats.
The starter's other options say how the host should show the entry:
`pixelArt` (nearest-neighbour textures, no antialiasing), `integerScale`
(scale by whole numbers only, for crisp pixels), `fitTo` (for an entry that
lays itself out for the area it is given, as Boids does), and
`thumbnailAdvanceMs` (how far to run the entry before taking its thumbnail).

### Sound

If your entry makes sound, its starter names the sound chip it plays on.
There are two virtual sound chips, from `@mvtjs/chiptune`. The **Audio80** is
in the spirit of the 1980s home computers. The **Audio90** has sixteen
stereo voices of FM, analog and samples, in the spirit of the 1990s. The
[Tune Tracker](./tune-tracker/start/load.ts) plays on the Audio90.

You name the chip in your starter's `soundChip`. `definePixiLoader` works
out the chip's type from it, so `start` is given that chip as `sound`, with
the right type. You don't need to write any types yourself. If you name a
chip that doesn't exist, or use `sound` as the other chip, TypeScript tells
you. The host loads the chip as it prepares your entry, and gives it to
each session for your audio views:

```ts
export const load = definePixiLoader(async () => {
    await textures.load();

    return {
        kind: 'pixi',
        soundChip: 'audio80',
        // ...
        start({ stage, sound }): EntrySession {   // sound: Audio80
            const gameModel = createGameModel({ /* options */ });
            const gameView = GameView({ model: gameModel, sound });
            // ...
        },
    };
});
```

Choose the chip that matches your entry's decade.
[Using the Audio90](../../../../libraries/chiptune/docs/using-the-audio90.md#which-chip)
compares the two. If your entry plays samples on the Audio90, bounce them
in its `load`, beside its textures. Then none of them has to bounce while
the entry plays:

```ts
await textures.load();
prepareAudio90Samples(SAMPLES);
```

If your entry makes no sound, leave `soundChip` out, as the Breakout
example above does. Then its start options have no `sound`, and the host
doesn't load a chip for it. If you read `sound` anyway, you'll find it
typed `undefined`, so you can't give it to an audio view by mistake.

### Entries with their own renderers

An entry that draws with three.js, the DOM, or several renderers at once
returns an `element` starter instead, from a `load` made with
`defineElementLoader`. Its
`start({ element })` builds the
entry inside an element the host gives it, and returns a session with two
more members: `views`, the roots of its views of every renderer, and
`render()`, which draws a frame. The host still runs each frame in the MVT
order: the session's `update`, then `updateView` and `refreshView` over its
`views`, then `render`. Some renderers start asynchronously, as Pixi's
`init` does. If the entry has one, its session's `ready` is a promise that
settles once every renderer can draw. A host that produces one image, such
as the thumbnail script or a visual test, waits for it. See
[Boids in 3D](./boids-3d/start/load.ts) for a small one, and the
[Fruit Machine](./fruit-machine/start/load.ts) for one model with views on
three renderers.

## Step 5: Describe the Entry (`start/entry.ts`)

`entry.ts` is what the Arcade shows without running anything. That's the
card, and what the search reads first. It's part of the home page's first
load, so keep it to what the card needs. It imports your entry's long text
and its starter only when they're wanted:

```ts
import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

/** Breakout, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'breakout',
    name: 'Breakout',
    summary: 'Knock out every brick with a ball and a paddle.',
    tags: { kind: 'game', era: '1970s', genres: ['action'] },
    screenWidth: 300,
    screenHeight: 400,
    thumbnail,
    cardColor: 'sky',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
```

`details.ts` holds your entry's long text. The info panel shows it, and
the search reads it as well as the summary. The Arcade loads every entry's
long text just after the page first appears, so the cards don't have to
wait for it:

```ts
import type { EntryDetails } from '../../../entry-types';

/** Breakout's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A bat-and-ball game. ...',
        'What it shows about MVT, for the info panel. ...',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Break every brick to clear the wall.',
        controls: [
            { action: 'Move', inputs: ['left-right', 'a-d', 'joystick'] },
            { action: 'Serve', inputs: ['space', { button: 'Serve' }] },
        ],
    },
};
```

- **`id`** is the directory's name, and the entry's address:
  `/arcade/breakout/` launches it. The build gives that address a page of
  its own, a copy of the Arcade's, so a link to it shows the entry's name,
  summary and thumbnail when it is shared.
- **`tags`** are what the search filters by: its `kind` (`game` or `demo`),
  an `era` if it is in the style of one, and the `genres` that say what it
  is, such as `art` for a demo made to be looked at. The values are listed in
  [`arcade-entry.ts`](../entry-types/arcade-entry.ts).
- **`screenWidth`** and **`screenHeight`** are the play area, in the entry's
  own pixels: the same numbers its views use, written out, since importing
  them would bring the views, and their renderer, into the Arcade's first
  load. In development, the Arcade checks they match the starter's.
- In `details.ts`, the **`description`** is a paragraph or two, separated
  by a blank line, about what the entry is, written for someone who wants
  to play it or watch it. How it's built goes in **`implementation`**, also
  a paragraph or two, written for a developer reading the code: its models,
  its views, and the techniques worth noticing. The info panel shows it
  under its own heading, How It's Made, after the description, so a player
  can stop reading before it. If your entry is a game, give it **`howToPlay`**, which
  the info panel shows on its How to Play tab, and which the runner's (i)
  opens over the game as it plays. It has an `intro` (what to aim for), the
  `controls`, and any `notes`. Each control is an action and the inputs
  that do it: keys (`'arrows'`, `'space'`, or keys pressed together, such as
  `['space', 'up']`), gestures (`'joystick'`, `'swipe'`, `'drag'`) and the
  game's on-screen buttons (`{ button: 'Fire' }`). The panel draws them as a
  table, with a column for the keyboard and one for touch, so give them as
  data rather than in the text. The kinds are listed in
  [`arcade-entry.ts`](../entry-types/arcade-entry.ts). If it's a demo, give
  it **`techniques`**, the patterns it shows off, and a `howToPlay` if it
  takes input.
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
two pictures. `start/thumbnail.webp` is for its card. `start/share.png` is
for its link preview, the picture a chat app or a social network shows
beside a shared link to the entry. It is 1200 by 630 pixels, the size those
sites draw a large preview at, so they don't stretch it and blur it. A
picture that would be too large as a PNG is saved as `start/share.jpg`
instead. The build stops if an entry has neither. Run the script again
whenever the entry's look changes.

If the Arcade's dev server is running, the script uses it. Otherwise it
starts one of its own.

The entry also gets a visual test of its whole screen, at the same moment,
without any new code. `visual-tests/canvas-entries.test.tsx` makes one for every
Pixi entry in the catalogue, and `visual-tests/html-entries.test.tsx` makes one
for every element entry. Record the test's reference image, look at it, and
commit it:

```bash
npx vitest run packages/sites/arcade/src/entries/visual-tests/canvas-entries.test.tsx -u
```

Give the views their own visual tests too, with one test for each
state their bindings can show. See
[Visual Tests](../../../docs/building-with-mvt/iterating-with-confidence/visual-tests.md).

## Keeping Highscores

A game with a score can have a highscore table in the Arcade. The table
holds the ten best scores from everyone who plays, and the Arcade asks for a
player's initials when their score places. The game itself only says what
its score is, and when a run ends. It changes no model.

First, the session reports its score as `scoring`, in `start/load.ts`. Both
members are query bindings, which the Arcade reads every frame. It watches
`isOver` turn true, and reads `score` then:

```ts
return {
    // update, destroy and inputConfig, as before
    scoring: {
        score: () => gameModel.score,
        // True from the run's end until the game starts another
        isOver: () => gameModel.phase === 'game-over',
    },
};
```

A run that can also end in a win counts that as over too, as
`gameModel.phase !== 'playing'` does in Crumb Chase.

Next, `start/entry.ts` says the entry has a table, with
`hasHighscores: true`. Last, the game needs a table in the Worker that
keeps them. Add it to `GAMES` in
[`highscores/rules/games.ts`](../highscores/rules/games.ts), with a cap
that no real score could reach, and deploy the Worker, as
[its README](../../highscores-worker/README.md#looking-after-the-tables)
says. Tests check that the entries
with `hasHighscores` and the games in `GAMES` are the same, and start each
of those games to check that it reports its score.

A game whose HUD shows a best score can show the best in the Arcade's table
instead. The start options give it as `bestScore`, which returns 0 while
the table is empty or out of reach. It is absent when the game runs outside
the Arcade, as in its thumbnail. Neon Monsoon's HUD shows the higher of
`bestScore` and its own best this session.

## Saving a Game

A game can be saved part way through, so the Arcade offers to resume it
next time. The Arcade saves every few seconds of play, as the visitor
leaves the game, and as the page is hidden. The session gives two methods. `saveGame` returns the
game as it stands, as a value JSON can hold. It returns undefined when there
is nothing worth resuming, such as a run that is over. `loadGame` restores a
saved game in place of the one the session started with, and returns
whether it could. A save from an older version of the game may not fit,
so `loadGame` checks the value's shape first:

```ts
return {
    // update, destroy, inputConfig and scoring, as before
    saveGame: gameModel.save,
    loadGame: gameModel.load,
};
```

The game model does the work, through its public actions. A version number
in the save lets a later change to its shape reject older saves. `save` is
called every few seconds, in any phase of the game, so it must give a
sensible answer whether the player is dying, between levels, or watching a
cascade play out.

A game with nothing worth resuming saves nothing. That is a game that is
over, and a game not yet under way, which resuming would only start again.
The player can always restart. When `save` returns undefined, the Arcade
removes any save the game had, so a visitor who leaves after a game over,
or before playing, is not offered a resume next time.

What a game saves depends on the game. A game whose whole state is small
and settles often saves all of it. Crumb Chase's `save` records the score,
the crumbs eaten, and each animal's tile, and its `load` rebuilds the maze
and the animals from them. Kwazy Cactii saves its board whenever it is at
rest. While a swap plays out, it saves the board as it stood before the
swap.

An action game saves a checkpoint instead, because its bullets, enemies and
explosions are too many to save and too fleeting to matter. A checkpoint is
the start of the current level or wave. The rule is that leaving and
resuming must never help the player, since the score may go on a highscore
table. So a save keeps:

- **The level:** the current one. A level just cleared saves the next one,
  since nothing in it is left to play.
- **The score as the level started.** The points won in the level are won
  again on resuming.
- **The lives as they are now.** A life lost in the level stays lost, even
  one whose loss is still playing out. A game with no lives left saves
  nothing. A game that awards lives for points leaves out the lives earned
  in the level, since the points that earned them are won again.
- **Nothing else lost in the level comes back.** Neon Monsoon keeps no more
  bombs or weapon power than the player has now.

An action game's checkpoint on its first level, with no score, is the
game's start, so it saves nothing. Astrovoid is the simplest example. Its
`save` returns the wave, the score as the wave began, and the lives left.
Fenceline also saves the state of its random numbers as the round began, so
a resumed round is laid out as it was, and leaving cannot deal a new one.

## Checklist

- `data/` has constants in domain units (not pixels)
- Models have `update(deltaMs)` methods and use domain-level coordinates
- Models do not reference views or use wall-clock time
- Views are `XxxView(bindings)` functions; leaf views take query and relay
  bindings, the top-level view takes `{ model }`
- Views convert domain units to presentation units (pixels)
- `start/load.ts` returns a starter whose session's `update` advances only
  the models
- An entry that makes sound names its chip, `soundChip: 'audio80'` or
  `'audio90'`, and types its starter for it, and an Audio90 entry bounces
  its samples in `load` (see [Sound](#sound))
- An entry in the style of the 1970s to the 1990s sets its text in the pixel
  glyphs (see [Text in the Style of an Era](#text-in-the-style-of-an-era))
- `start/details.ts` exports `details`, the long text, and `entry.ts` loads
  it with `loadDetails`
- `start/entry.ts` exports `entry`, with its screen size matching the
  starter's
- Barrel files export public API at each level
- The entry is listed in `catalogue.ts`, and has its own thumbnail
- The entry's whole-screen reference image is recorded, and its views have visual tests
- Model tests exist and pass
- A game with a score reports it as `scoring`, says `hasHighscores: true`,
  and has a table in `GAMES` (see [Keeping Highscores](#keeping-highscores))
- A game that can be resumed gives `saveGame` and `loadGame` (see [Saving a Game](#saving-a-game))
- The title, characters, art, levels and sounds are the entry's own (see [Originality](#originality))
