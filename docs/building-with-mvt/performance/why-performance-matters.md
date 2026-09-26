# Why Performance Matters

> A game has a fixed time to produce each frame, and code that runs every
> frame spends it over and over. This page explains why that makes small costs
> add up, when you need to care and when you do not, and what the rest of this
> section covers.

**Related:** [Hot Paths](hot-paths.md) · [Performance Measurements](measurements.md) ·
[Benchmarking Methods](benchmarking-methods.md) · [The Game Loop](../the-game-loop.md)

---

::: info About the figures
The figures on this page were measured in this repo on one 2025 machine,
in Node.js's V8 engine, with nothing drawn. Absolute times will differ on
other hardware, browsers and engines; the comparisons between approaches are
what carry over. The details are in [Performance Measurements](measurements.md).
:::

## Every Frame Has a Deadline

At 60 frames per second, each frame has 16.7 ms. On a 120 Hz display it has
8.3 ms. That time is shared: your models and views, Pixi's drawing, input,
audio, and the browser itself all need a slice of it.

A frame that misses its deadline is not slightly late. It is dropped, and the
player sees the previous frame for twice as long: a stutter. So what matters
is not the average frame but the slowest ones. A game that is fast on average
and slow once a second feels worse than one that is steady.

## Small Costs Are Multiplied

Code on a [hot path](hot-paths.md) (`update()`, `refresh()`, and everything
they call) runs every frame, often once for every object in the game: every
enemy, bullet and particle. A cost that is invisible once
is paid 60 times a second, times the number of things on screen.

For example, calling `Object.values()` once per game object is over 40 times
slower than reading the same properties directly. Over 1000 game objects, that one
line also leaves about 80 KB of garbage every frame, which is the next
problem.

## Garbage Turns Into Pauses

Creating an object, array, string or function is cheap at the moment it
happens. The cost arrives later, when the JavaScript engine pauses the game to
reclaim the memory. The more a game allocates per frame, the more often those
pauses come, and a pause at the wrong moment drops a frame.

80 KB per frame is almost 5 MB of garbage a second. In the measurements, 1000
containers kept in step with Solid's signals, which allocate on every change,
made the engine collect 167 times a minute with everything moving. The same
containers kept in step by polling allocated nothing, and it collected none.

## MVT's Choices Have Costs

MVT's views [poll](../reacting-to-changes/why-polling.md): every frame, they
read the model and update what they show, whether or not anything changed.
That is what keeps models plain and removes subscriptions to manage. It also
means a view's cost follows the size of the scene, not the amount of change.

At game scale this is cheap: polling 1000 Pixi containers takes well under
0.1% of the frame budget. But it grows, and faster than you might guess: each
container costs about 8 times as much in a scene of 100,000 as in a scene of
1,000, and polling that scene at rest takes over a fifth of the budget. Knowing where those limits are lets you design for them, for
example by [skipping inactive parts of the scene](measurements.md#the-scene-passes).

## When You Need to Care

Most of the time, you do not. This repo's games spend well under 0.1% of each
frame's budget on their models and views, and following the
[hot path rules](hot-paths.md) is enough to keep them there.

Look more closely when:

- **The scene is large**: thousands of containers, or more.
- **Things are created and destroyed constantly**: bullets, particles,
  effects. Reusing them from a pool is cheaper.
- **You target slower devices**: phones and low-end laptops run the same code
  more slowly than the machine these measurements come from.
- **You see stutter**: frames that miss their deadline now and then, rather
  than a game that is slow all the time. That often means garbage.

When one of these applies, measure before changing anything. Code written for
speed is often harder to read, so keep code clear unless measuring shows it is
a real bottleneck.

## This Section

| Page | Answers |
| --- | --- |
| [Hot Paths](hot-paths.md) | What to avoid in code that runs every frame, and what to do instead |
| [Performance Measurements](measurements.md) | What things cost in this repo: polling, signals and events, scene size, the hot path rules, memory, and the games and demos |
| [Benchmarking Methods](benchmarking-methods.md) | How those costs were measured, and how to measure your own code without fooling yourself |
