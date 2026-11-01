# Why Performance Matters

> A game has a fixed time to make each frame, and code that runs every
> frame spends that time over and over. A performance cost too small to
> notice once is repeated sixty times a second, for every object on
> screen, and the garbage that code leaves behind comes back as pauses.
> Most games never get near the limit. This chapter shows how small
> performance costs add up, and how to tell when your game's performance
> needs attention.

**Related:** [Hot Paths](24-hot-paths.md) ·
[Measurements](../appendices/c-measurements.md) ·
[Measuring Performance](../appendices/d-measuring-performance.md) ·
[The Tick](05-the-tick.md)

Here's one line from a view's refresh step:

```ts
const values = Object.values(enemy.stats);
```

It looks harmless, and once, it is. But a refresh step runs every frame,
and this line runs for every enemy. Over 1000 game objects, calling
`Object.values()` like this is about 30 times slower than reading the same
properties directly, and it leaves about 80 KB of garbage behind every
frame. These costs don't show up when you write the line, or in a quick
test. They show up as a game that stutters.

::: info About the figures
The figures in this chapter come from the short version of
[Appendix C](../appendices/c-measurements.md), measured on one machine, in
Node.js's V8 engine, without drawing anything. Your times will differ on other
hardware, browsers and engines. The comparisons between approaches are
what carry over.
:::

## Every Frame Has a Deadline

At 60 frames per second, each frame has 16.7 ms. On a 120 Hz display it has
8.3 ms. That time is shared. Your models and views, the renderer's drawing,
input, audio and the browser itself all need a slice of it.

A frame that misses its deadline isn't slightly late. It's dropped, and the
player sees the previous frame for twice as long: a stutter. So the
slowest frames matter more than the average frame. A game that is fast
on average and slow once a second feels worse than one that is steady.

## Small Performance Costs Are Multiplied

Code on a [hot path](24-hot-paths.md) runs every tick, once a frame.
That's `update()`, `refresh()` and everything they call. It often runs
once for every object in the game: every enemy, bullet and particle. A
time cost that's too small to notice once is repeated 60 times a second,
times the number of things on screen.

That's how the `Object.values()` line above turns into something you can
measure. Its time is the first problem. Its garbage is the second.

## Garbage Turns Into Pauses

Creating an object, array, string or function is fast at the moment it
happens. The time cost arrives later, when the JavaScript engine pauses
the game to reclaim the memory. The more a game allocates each frame, the
more often those pauses come, and a pause at the wrong moment drops a frame.

80 KB a frame is almost 5 MB of garbage a second, and the engine has to
stop the game again and again to collect it.

[§](#try-object-values-swarm) puts the `Object.values()` line in the
refresh step of a swarm of 10,000 enemies. Once the meter has warmed up,
its bar shows how much of each frame the models and views take, and its
graph shows the last ninety ticks, with a frame's time at the top. Press
View code, and in `main.ts` set `USE_OBJECT_VALUES` to `false`, and
compare the times and the spikes. Your times will differ from the figures
here, but the gap between the two should show.

<TryIt example="object-values-swarm" file="main.ts" />

## The Performance Cost of MVT's Polling

MVT's views [poll](10-why-views-poll.md): every tick, each one reads the
model, whether or not the state changed, so the time that polling takes
follows the size of the scene, not the amount that changed. At game scale
that's well under a tenth of a percent of the frame's time, and
[Chapter 10](10-why-views-poll.md#drawbacks-of-polling) shows where it
starts to take a noticeable share of the frame. In a very large scene, a
part that isn't active can skip its views' refresh steps, as
[Chapter 7](07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries)
shows. Hiding it doesn't do that on its own.

## When Performance Needs Attention

Most of the time, it doesn't. The games measured in
[Appendix C](../appendices/c-measurements.md) each spend well under 0.1%
of each frame's time on their models and views,
and following the [hot path rules](24-hot-paths.md) is enough to keep
them there.

Look more closely when one of these is true:

- **The scene is large.** It has thousands of containers, or more.
- **Things are made and thrown away all the time.** Bullets, particles
  and effects are the usual ones. Reusing them from a pool is faster.
- **You target slower devices.** Phones and low-end laptops run the same
  code more slowly than the machine these figures come from.
- **You see stutter.** Frames miss their deadline now and then, rather
  than the game being slow all the time. That often means garbage.

When one of these applies, measure before you change anything.
[Appendix D](../appendices/d-measuring-performance.md) shows how to
measure without fooling yourself. Code written for speed is often harder
to read, so keep code clear unless a measurement shows it's a real
bottleneck.

## Summary

Every frame has a deadline, and a missed one is a visible stutter. Code on
a hot path runs every frame, often once for every object, so a small
performance cost there is multiplied many times over. Allocation takes
time twice: once as it happens, and again later, in the pauses that
collect the garbage.

MVT's polling views take time in proportion to the size of the scene.
That time is small at game scale, and worth planning for in very large
scenes. Most games never get near the limit. When yours might, measure
first, as [Appendix D](../appendices/d-measuring-performance.md)
describes, and compare with the figures in
[Appendix C](../appendices/c-measurements.md).
[Chapter 24](24-hot-paths.md) says what to avoid in code that runs every
tick, and what to do instead.
