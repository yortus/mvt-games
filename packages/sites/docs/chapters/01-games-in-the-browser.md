# Games in the Browser

> A web browser has everything a game needs: a canvas to draw on, sound,
> input from keys, pointers and gamepads, and a call to your code before
> each frame is drawn. It doesn't have a structure for the game's own
> code, and neither do most of the tools that web games are built with.
> Engines bring a structure of their own, renderers don't bring one, and
> UI frameworks bring one made for web pages that are mostly still. Each leaves
> the same question open: how to keep the code that decides what happens
> apart from the code that shows it. The rest of the book answers it.

**Related:** [Why MVT](02-why-mvt.md) · [The Tick](05-the-tick.md) ·
[MVT Beyond the Web](../appendices/h-mvt-beyond-the-web.md)

Here's a square that slides across a canvas, written with nothing but
what the browser provides:

```ts
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;
document.body.append(canvas);
const context = canvas.getContext('2d')!;

let x = 0; // pixels from the left edge
let lastTime = performance.now();

function frame(now: number): void {
    const deltaMs = now - lastTime;
    lastTime = now;
    x = (x + 0.1 * deltaMs) % 400; // 0.1 pixels per ms
    context.clearRect(0, 0, 400, 300);
    context.fillRect(x, 140, 20, 20);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

`requestAnimationFrame(frame)` schedules one call to `frame`, just before
the browser next draws the page, and passes it a timestamp in
milliseconds. Each call schedules the next, so `frame` runs once a frame,
usually as often as the screen refreshes. That's 60 times a second on
many screens, and more on some. The square moves by the time that has
passed since the last frame, so it crosses the canvas at the same speed
on any screen.

That's a loop, a picture and time, which are at the heart of every game.
A real game needs much more: sprites and animations, sound, input, rules,
levels and menus. The browser provides the building blocks for all of
them.

## The Browser's Building Blocks

| Job | What the browser provides |
| --- | --- |
| Drawing | The canvas, with a 2D drawing API, or WebGL and the newer WebGPU, which draw with the graphics card. Or the page itself, as HTML elements styled with CSS |
| Sound | The Web Audio API, which plays, mixes and makes sounds |
| Input | Events for the keyboard, the mouse, touch and pens, and the Gamepad API |
| Time | `requestAnimationFrame`, once a frame, and `performance.now()`, a precise clock |
| Storage | `localStorage` and IndexedDB, for settings and saved games |

These are low-level. A canvas draws shapes and images, but it doesn't
remember them: to move a sprite, you clear the canvas and draw it again.
The Web Audio API connects sound sources and effects into a graph, and
leaves the music to you. So most web games are built with tools on top of
these. The tools come in three broad kinds.

## Game Engines

A **[game engine](../appendices/b-glossary.md)** provides a whole way of
making a game. Phaser and PlayCanvas are written for the web, and Unity
and Godot can export a game to run in a browser. An engine draws, plays
sound, reads input and runs physics, and it runs the loop for you. Each
frame, it calls an update function in your code, and passes it the time
since the last frame. Engines that don't run in a browser work the same
way:

| Engine | Called once a frame |
| --- | --- |
| Phaser | A scene's `update(time, delta)`, with `delta` in milliseconds |
| PlayCanvas | A script's `update(dt)`, with `dt` in seconds |
| Unity | `MonoBehaviour.Update()`, which reads `Time.deltaTime` |
| Godot | `Node._process(delta)` |
| Unreal | `AActor::Tick(DeltaSeconds)` |

That's the same shape as the `update(deltaMs)` function at the heart of
MVT, the architecture this book teaches. If you've written a script for
one of these engines, you've already written half of MVT.

An engine also decides how your code is arranged. A game is made of the
engine's objects: sprites, nodes or game objects, each with scripts of
its own. The game's state mostly lives in them. An enemy's position is
its sprite's position, and its health is a field on its script.

That's quick to write, and most engine tutorials work this way. But the
game's rules end up in the same objects that are drawn, so they're hard
to separate later:

- **A test of one rule has to start the engine,** or build a stand-in for
  it, because the rule's state lives in the engine's objects.
- **Two ways of showing the same thing,** such as an enemy's sprite and
  its mark on a minimap, read each other's state, or keep copies of it.
- **The engine sets the order** in which its objects update, and that
  isn't always the order that your rules need.

You can keep your rules apart from the engine's objects. But you do it
on your own, because the engine's structure is built the other way.

## Renderers

A **[renderer](../appendices/b-glossary.md)** only draws. Pixi draws 2D
scenes quickly, with WebGL or WebGPU, and three.js draws 3D scenes. Each
keeps a tree of display objects, called a
**[scene graph](../appendices/b-glossary.md)**. You create a sprite once,
change its position as the game goes on, and the renderer draws it where
it is now. Each also provides a loop: Pixi's ticker calls your functions
once a frame, and three.js's renderer has `setAnimationLoop`.

A renderer leaves the rest of your code to you. That's freedom, and it's
also the problem. Without a structure, a game grows the way most first
games do: one function that runs every frame, decides what happens, moves
the sprites and starts timers, all at once.
[Chapter 2](02-why-mvt.md) starts from a small game written that way, and
shows what goes wrong as soon as you want to test it, resize it or slow
it down.

## UI Frameworks

A **[UI framework](../appendices/b-glossary.md)**, such as React, Vue,
Svelte, Solid or Angular, gives a web app its structure. You describe
the page as a tree of components, built from the app's state. When some
of the state changes, the framework updates the parts of the page that
depend on it, so you don't write the code that finds and changes those
elements yourself.

UI frameworks are built for pages that are mostly still, such as a form,
a list or a dashboard. Something changes when the user clicks, or when a
reply arrives from a server, and the framework does a little work for
each change. A game is the opposite. Positions and animations change
every frame, so that work runs for nearly every value, at least sixty
times a second.

Libraries that put a game inside a framework work around this. React
Three Fiber, which builds three.js scenes from React components,
recommends changing objects directly, in a function that it calls once a
frame, rather than through React's state. That way, React doesn't render
the components again every frame.
[Chapter 10](10-why-views-poll.md) compares the ways that frameworks
find changes with the way MVT does, and measures when each is faster.

## Entity Component Systems

Some games are built as an
**[entity component system](../appendices/b-glossary.md)** (ECS). Each
game object is an id, with pieces of plain data attached to it, such as
a position or a speed. Separate functions, called systems, process every
object that has the pieces they need. An ECS stores and processes many
objects quickly. It answers a different question from where a game's
rules live and how they're shown, and it can work inside a model of the
kind this book teaches. [Chapter 30](30-composite-reuse.md#common-misreadings)
says how.

## The Question That Web Game Tools Leave Open

Each kind of tool solves part of the problem. The browser provides
drawing, sound, input and a call once a frame. A renderer makes drawing
fast and simple. An engine adds physics, assets and an editor. A UI
framework arranges a page that changes now and then. They all leave one
question open: how to keep the code that decides what happens in your
game apart from the code that shows it, and from the clock.

That question matters more as a game grows. You'll want to test a rule
without drawing anything. You'll want to pause the game, slow it down, or
replay a bug. You'll want to show the same thing in a second way, or the
same game with a new renderer. Each of those is easy when the jobs are
apart, and hard when they're tangled.

## MVT's Place Among These Tools

MVT (Model-View-Ticker) is this book's answer to that question. It isn't
an engine or a library. It's a way to arrange your own code into three
parts: models that decide what happens, views that show it, and a ticker
that keeps time and calls the other two in a fixed order.
[Chapter 2](02-why-mvt.md) introduces the three parts.

Because MVT is only an arrangement of your code, it works with any of
the tools above. This book uses it with renderers, mostly Pixi. Inside an
engine, one of your scripts can act as the ticker, and
[Appendix H](../appendices/h-mvt-beyond-the-web.md) sketches how. MVT
isn't tied to the web, either. The same three parts work in other
languages, and in programs that aren't games, and Appendix H covers those
too.

## The Tools This Book Uses

| Job | In this book |
| --- | --- |
| Language | TypeScript |
| Drawing | Pixi for most examples, three.js for 3D, and the DOM for views made of HTML |
| Sound | Two virtual sound chips from the `audio90` package, which play through the Web Audio API ([Chapter 20](20-sound-and-music.md)) |
| Tests | Vitest, and the `v-snap` package for tests that compare images ([Chapters 15 to 17](15-testing-models.md)) |
| MVT's helpers | The `@mvtjs` libraries: one for each renderer, and `@mvtjs/utils` for what they share |

MVT doesn't require any of them. The [Preface](../index.md#conventions)
says how the book marks the places where an example depends on one.

## Trade-offs of Working Without an Engine

- **You choose and connect the pieces.** An engine comes with physics,
  asset loading, an editor and a way to publish. With a renderer, you
  choose a library for each, or write it yourself. MVT doesn't add any of
  them.
- **An engine is often quicker to start with.** For a game jam or a first
  game, an engine's own structure may get you further in a weekend. MVT's
  structure is worth more as a game grows, and as you test it, change it
  and show it in new ways.
- **MVT inside an engine goes against the engine's design a little.** The
  engine's tools expect the game's state to live in its objects. Keep the
  rules in models, and the engine's editor shows the views, but not the
  state that decides the game.

## Summary

The browser provides what a game needs at the lowest level: drawing,
sound, input, storage and a call once a frame. Engines build a whole
structure on top, with the game's state inside the engine's own objects.
Renderers make drawing fast, and leave the structure to you. UI
frameworks provide a structure for pages that change now and then, not
every frame. Each leaves the same question open: how to keep the code
that decides what happens apart from the code that shows it, and from
the clock. MVT answers it with three parts, and works with whichever
renderer or engine you choose. [Chapter 2](02-why-mvt.md) starts from a
small game that leaves the question unanswered, and untangles it.

## Further Reading

- MDN Web Docs, ["Anatomy of a video game"](https://developer.mozilla.org/en-US/docs/Games/Anatomy).
  The browser's frame loop, `requestAnimationFrame` and timing, from the
  ground up.
- The React Three Fiber documentation,
  ["Performance pitfalls"](https://r3f.docs.pmnd.rs/advanced/pitfalls).
  Why a game inside React changes its objects directly, once a frame.
