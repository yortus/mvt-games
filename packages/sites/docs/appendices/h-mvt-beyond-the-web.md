# MVT Beyond the Web

> This book builds web games in TypeScript, but MVT isn't tied to the
> web, to a language, or to games. Its three parts, and the order in
> which a tick calls them, work wherever a program runs in frames. This
> appendix says what carries over unchanged, what is only this book's
> choice, and how MVT fits inside a game engine, in other languages, and
> in programs that aren't games.

**Related:** [Games in the Browser](../chapters/01-games-in-the-browser.md) ·
[MVT on One Page](a-mvt-on-one-page.md) ·
[The Eight Principles](../chapters/25-the-eight-principles.md)

Read the rules in [Appendix A](a-mvt-on-one-page.md) again, and look for
the browser. A model moves forward only through `update(deltaMs)`. A view
reads state and writes output, and doesn't hold any state that decides
what happens. The ticker calls every model, then every view, in that order,
once a frame. Each of those sentences holds without a browser, a canvas
or TypeScript. They describe how to arrange code, and any language with
functions can arrange code that way.

## What Carries Over Unchanged

These are MVT itself, and they work the same anywhere:

- **The three parts and their jobs.** Models decide what happens, views
  show it, and the ticker keeps time
  ([Chapter 2](../chapters/02-why-mvt.md)).
- **The tick's order.** Every model updates, then every view updates and
  refreshes, then the frame is drawn
  ([Chapter 5](../chapters/05-the-tick.md)).
- **Time through `update(deltaMs)` only,** with its cap, which makes a
  model deterministic, testable and easy to pause
  ([Chapter 4](../chapters/04-models.md#the-update-deltams-contract)).
- **Bindings.** A view reads the state through a small set of values and
  functions, so you can test it with stand-ins
  ([Chapter 8](../chapters/08-bindings.md)).
- **The rules and the principles.** Appendix A's rules, and the eight
  principles of [Part VII](../chapters/25-the-eight-principles.md),
  don't mention the web.

## The Book's Own Choices

Everything else in the book's examples is a choice, made for the web and
for TypeScript. Elsewhere, you'd make the same choices in your platform's
own way:

| In this book | Elsewhere |
| --- | --- |
| `requestAnimationFrame` calls the ticker once a frame | An engine's update function, a game library's main loop, or a loop around the platform's frame timer |
| Pixi, three.js and the DOM draw the views' output | Any renderer: an engine's scene, a native UI toolkit, even a terminal |
| The `@mvtjs` libraries walk the view tree, and provide reactions and JSX | A few functions of your own. The ticker can keep a list of views, or walk your renderer's tree, as [Chapter 7](../chapters/07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries) describes |
| Factory functions, `undefined` rather than `null`, and string-literal unions | Your language's own habits: classes in C#, structs and traits in Rust, tables in Lua |
| Time in milliseconds | Engines often use seconds. Any unit works, as long as the whole game uses one |

## MVT Inside a Game Engine

An engine runs the loop itself, and calls an update function on each of
its objects every frame. To use MVT inside one, let one script be the
ticker. Here's the idea in Unity, in C#:

```csharp
// The one script whose Update runs the game: MVT's ticker
public class GameTicker : MonoBehaviour
{
    const float MaxDeltaMs = 100f;

    GameModel model;
    GameView view;

    void Start()
    {
        model = new GameModel();
        view = new GameView(model, transform);
    }

    void Update()
    {
        float deltaMs = Mathf.Min(Time.deltaTime * 1000f, MaxDeltaMs);
        model.Update(deltaMs);  // 1. the models move on
        view.Update(deltaMs);   // 2. presentation state moves on
        view.Refresh();         // 3. every view reads and writes
    }                           // 4. Unity draws the frame
}
```

`GameModel` is a plain C# class, not a `MonoBehaviour`, so a test can
create it and call `Update` without starting Unity. `GameView` creates
the game objects that show the model, and writes to them in `Refresh`.
Unity calls the `Update` of each script in an order that you'd have to
set by hand. With one ticker, the order is the one in the code, and it's
the same every frame. Godot works the same way: one node's
`_process(delta)` is the ticker, and the models are plain classes.
[Appendix I](i-why-update-and-refresh.md) compares MVT's steps with Unity's
`Update` and `LateUpdate`.

One thing needs a decision. An engine's physics moves its objects on its
own, so if collisions decide what happens in your game, the engine is
holding domain logic. Either the models do their own physics, which is
often simple for an arcade game, or the physics is part of the model's
world, and the ticker reads its results into the models after each
physics step. The second keeps the engine's physics, but a test of those
rules needs the engine again.

## Other Languages

A language needs only two things for MVT: a way to keep state together
with the functions that change it, and a way to call a list of those
functions each frame. Objects, closures and structs all do the first,
so nearly every language can.

- **Bindings** become an interface in C# or Java, a set of delegates
  such as `Func<int>`, or a table of functions in Lua.
- **Rust's borrowing rules** don't allow a view to keep a reference to a
  model that the ticker changes each frame. Pass the model to each
  view's refresh instead, as `view.refresh(&model)`. The tick's order
  suits this: every update borrows the models mutably, and every refresh
  only reads them.
- **The book's style isn't MVT.** Factory functions and options objects
  suit TypeScript. In a language built around classes, models and views
  can be classes, as long as they follow the rules.

## Programs That Aren't Games

Anything that changes over time and is shown on a screen has a game's
problems: simulations, visualisations, animated editors, music software.
MVT gives them what it gives a game. You can test the rules without a
screen, pause and replay them, and show the same state in more than one
way.

A program that's mostly still is different. In a form or a settings
page, reading every value every frame does work for nothing, as
[Chapter 10](../chapters/10-why-views-poll.md#when-push-is-faster-than-polling)
measures. A ticker can run only while something is moving or a timer is
due, and stop the rest of the time, starting again on input. That keeps
MVT's order, but every input and every arrival of data must start the
ticker again. For a page where nothing moves at all, a UI framework may
suit it better.

## Summary

MVT is a way of arranging code, not a web technology. Its three parts,
the tick's order, `update(deltaMs)`, bindings, the rules and the
principles carry over to any platform. The browser's frame callback, the
renderers, the `@mvtjs` libraries and the book's TypeScript style are
choices that you'd make your own way elsewhere. Inside an engine, one
script acts as the ticker, and the models stay plain classes. In other
languages, bindings become interfaces or delegates, and in Rust, views
take the model as an argument. Programs that animate suit MVT as well
as games do, and programs that are mostly still can tick only when
something changes.
