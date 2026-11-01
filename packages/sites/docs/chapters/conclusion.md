# Conclusion

> The browser gives a game everything it needs except a structure, and
> this book has offered one: models that decide, views that show, a ticker
> that keeps time, and eight principles behind the rules that keep them
> apart. This chapter looks back at what that structure gives you, is
> honest about what it doesn't, and suggests where to go from here.

**Related:** [Games in the Browser](01-games-in-the-browser.md) ·
[Why MVT](02-why-mvt.md) ·
[MVT on One Page](../appendices/a-mvt-on-one-page.md)

[Chapter 2](02-why-mvt.md) began with a ball that bounced and flashed, in
one function that ran every frame, and four ordinary requests that each
ran into something else:

- **Test that the ball comes to rest.** Now a test creates the model,
  calls `update` a few hundred times, and reads the height. It doesn't
  need a screen, a renderer or any waiting.
- **Draw it twice as big.** Now the model works in its own units, and the
  view decides how big they look, so only the view changes.
- **Add slow motion.** Now the ticker passes a smaller `deltaMs`, and
  everything slows together, the flash included, because every part gets
  its time from the ticker.
- **Show the height as a number, too.** Now a second view reads the same
  model, and the first view doesn't change.

Each request was hard because one function did three jobs. With the jobs
apart, each one became a change to one part. That's the whole of MVT, and
the rest of the book applied it to everything a game does.

## What the Three Parts Give You

- **Rules you can test alone.** A model is plain code that moves only
  when you call `update`. Its tests run in milliseconds, and give the same
  result every time ([Part IV](15-testing-models.md)).
- **Time under control.** Pause, slow motion, fast forward, stepping a
  frame at a time and replays all come from the `deltaMs` that the ticker
  passes ([Chapter 5](05-the-tick.md#time-control)).
- **Views you can add, change and remove.** A minimap, a sound, a
  three.js version of a Pixi game: each is one more view of the same
  model, and the others don't change
  ([Chapter 13](13-composing-views.md#many-views-of-one-model)).
- **Rich presentation, kept out of the rules.** Transitions, effects and
  lists in motion keep their own presentation state, which never decides
  what happens ([Chapter 11](11-presentation-state.md)).
- **Speed enough for a busy game.** At game scale, reading every value
  every frame takes a small part of a frame, and the hot paths are where
  the rest of the work goes ([Part VI](23-why-performance-matters.md)).

## What MVT Doesn't Do

MVT is a way to arrange your code, and some things are outside it. It
helps to know them before you start a project:

- **It isn't an engine.** Physics, loading assets, an editor and
  publishing are yours to choose or write
  ([Chapter 1](01-games-in-the-browser.md#trade-offs-of-working-without-an-engine)).
- **It asks for structure from the start.** A game has more parts, and a
  view has bindings to write. For a weekend game jam, that may not be
  worth it ([Chapter 2](02-why-mvt.md#trade-offs-of-mvt)).
- **It thinks in states, not events.** A moment that starts and ends
  within one update needs a trace in the model, such as a count
  ([Chapter 9](09-noticing-changes.md#counts-moments-that-repeat)).
- **It suits things that move.** A page that's mostly still may suit a UI
  framework better
  ([Appendix H](../appendices/h-mvt-beyond-the-web.md#programs-that-aren-t-games)).

## Where to Go from Here

- **Start small.** Take the game from [Chapter 3](03-a-first-game.md), and
  add one thing: a second view, a pause, or a test. Each one shows a part
  of MVT doing its job.
- **Read a real game.** The website's games, demos and puzzles are all
  built with MVT, in the same repo as this book. In the arcade,
  [Burrow Bust](https://github.com/yortus/mvt-games/tree/main/packages/sites/arcade/src/entries/burrow-bust)
  is a good first read. Among the demos, the
  [fruit machine](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/README.md)
  shows one model with four views.
- **Experiment.** Every experiment in this book opens in the playground,
  where you can change it, break it and fix it.
- **Keep the reference pages near.** [Appendix A](../appendices/a-mvt-on-one-page.md)
  lists every rule, [Appendix F](../appendices/f-troubleshooting.md) the
  mistakes people make most, and [Appendix G](../appendices/g-api-cheat-sheets.md)
  the libraries' APIs.
- **Take it elsewhere.** If you build for another platform, or something
  that isn't a game,
  [Appendix H](../appendices/h-mvt-beyond-the-web.md) says what carries
  over.

Sooner or later, you'll meet a case that no chapter covers. When you do,
ask the questions of the principles in
[Part VII](25-the-eight-principles.md). They're where the rules came
from, and they'll give you an answer that fits the rest of your game.
