---
layout: doc
---

# Building Web Games with MVT

> This book teaches MVT (Model-View-Ticker), a way to structure games that
> run in a web browser. It splits a game into models that decide what
> happens, views that show it, and a ticker that keeps time. The result is
> a game you can test without a screen, pause and replay, and draw any way
> you like. The book starts with a ball bouncing on a canvas, and adds one
> idea at a time until you have everything a full arcade game needs.

## Who This Book Is For

This book is for programmers who want to build games that run in a web
browser, and want those games to stay easy to change as they grow.

You might be a web developer who knows React or Vue, and wants to make a
game. You might have made a game or two with a renderer such as Pixi, and
watched the code tangle as it grew: a timer that keeps running while the
game is paused, a rule that you can't test without drawing the screen,
or a change to how something looks that breaks how it plays. Or you
might know an engine such as Unity or Godot, and want to build for the
web without one.

You'll need to be comfortable writing TypeScript or JavaScript, and know
the basics of a web page, such as elements and events. You won't need any experience of
a game engine or a renderer. The examples draw with Pixi, a popular 2D
renderer, and use only a small part of it.

If you build for another platform, or write programs that animate but
aren't games, most of the book still applies.
[Appendix H](appendices/h-mvt-beyond-the-web.md) says what carries over.

## What You'll Learn

- **Write a game's rules as models.** A model is plain code, which a test
  can check in milliseconds without drawing anything.
- **Show the game with views.** You can add, change or remove a view
  without touching the rules, whether it draws with Pixi, three.js or
  HTML, or plays sound.
- **Control time.** A game can pause, slow down, speed up, step a frame at
  a time, or replay.
- **Polish the presentation.** Transitions, effects and lists of things
  that come and go keep their own state, out of the rules.
- **Test and tune.** You'll test how each view looks with images, and keep
  a busy game fast.
- **Decide new cases.** When you meet a situation that no rule covers, the
  eight principles behind the rules show what to do.

## How the Book Is Organised

| Part | Contents |
| --- | --- |
| **I. The Big Picture** | Where web games come from, why MVT exists, and a first game built with it: [Games in the Browser](chapters/01-games-in-the-browser.md), [Why MVT](chapters/02-why-mvt.md), [A First Game](chapters/03-a-first-game.md) |
| **II. The Simulation** | Models, and the time that moves them: [Models](chapters/04-models.md), [The Tick](chapters/05-the-tick.md), [Time and Phases](chapters/06-time-and-phases.md) |
| **III. The Presentation** | Views, from a single sprite to lists that change, and why they poll: [Views](chapters/07-views.md), [Bindings](chapters/08-bindings.md), [Noticing Changes](chapters/09-noticing-changes.md), [Why Views Poll](chapters/10-why-views-poll.md), [Presentation State](chapters/11-presentation-state.md), [Writing Views in JSX](chapters/12-writing-views-in-jsx.md), [Composing Views](chapters/13-composing-views.md), [Lists and Switches](chapters/14-lists-and-switches.md) |
| **IV. Testing** | Testing each part on its own: [Testing Models](chapters/15-testing-models.md), [Testing Views](chapters/16-testing-views.md), [Visual Tests](chapters/17-visual-tests.md) |
| **V. Advanced Presentation** | Views that grow complex, and what games add: [Growing a Complex View](chapters/18-growing-a-complex-view.md), [Lists in Motion](chapters/19-lists-in-motion.md), [Sound and Music](chapters/20-sound-and-music.md), [Reading Layout Back](chapters/21-reading-layout-back.md), [Reduced Motion](chapters/22-reduced-motion.md) |
| **VI. Performance** | Keeping a game fast: [Why Performance Matters](chapters/23-why-performance-matters.md), [Hot Paths](chapters/24-hot-paths.md) |
| **VII. Principles Behind MVT** | The principles behind the rules, one chapter each, and how to use them on a case the rules don't cover: [The Eight Principles](chapters/25-the-eight-principles.md), then [SoC](chapters/26-separation-of-concerns.md), [SSOT](chapters/27-single-source-of-truth.md), [CQS](chapters/28-command-query-separation.md), [DIP](chapters/29-dependency-inversion.md), [CRP](chapters/30-composite-reuse.md), [DbC](chapters/31-design-by-contract.md), [MISU](chapters/32-make-illegal-states-unrepresentable.md), [DfT](chapters/33-design-for-testability.md), and [Using the Principles](chapters/34-using-the-principles.md) |
| **Conclusion** | What MVT gives you, what it doesn't, and where to go next: [Conclusion](chapters/conclusion.md) |
| **Appendices** | Pages to look things up in: [MVT on One Page](appendices/a-mvt-on-one-page.md) (every rule), [Glossary](appendices/b-glossary.md), [Measurements](appendices/c-measurements.md), [Measuring Performance](appendices/d-measuring-performance.md), [Timelines with GSAP](appendices/e-timelines-with-gsap.md), [Troubleshooting](appendices/f-troubleshooting.md), [API Cheat Sheets](appendices/g-api-cheat-sheets.md), [MVT Beyond the Web](appendices/h-mvt-beyond-the-web.md), [Why Update and Refresh](appendices/i-why-update-and-refresh.md) |

Each chapter builds only on the chapters before it. When one has to
mention something that comes later, it says so, and doesn't depend on it.

<div class="online-only">

You can also [read the book as a PDF](./building-web-games-with-mvt.pdf),
typeset for print or for reading offline. It's printed each time the site
is published, so it always matches these pages. In place of each
experiment that runs here, it shows the experiment's picture and the
address of its page.

</div>

## If You're in a Hurry

Read Parts I to III in order. They teach everything you need to build a
game with MVT, in about the order you'll need it. Part IV, on testing, is
short, and worth reading next. Then dip into the rest as questions come
up: Part V when a view gets complicated, Part VI when a frame starts to
feel slow, and Part VII when you want to know why a rule exists. If something isn't working,
[Troubleshooting](appendices/f-troubleshooting.md) lists the mistakes
people make most, and where each one is explained.

## Conventions

**Examples are in TypeScript, and run in a browser.** Most of them draw
with Pixi. The ideas don't depend on either, as
[Appendix H](appendices/h-mvt-beyond-the-web.md) shows. The examples
follow one style throughout:
factory functions that take one options object, `undefined` rather than
`null`, and string-literal unions rather than enums. That style is a
choice, not part of MVT, and each chapter says which is which.

**"In this book" asides** show how the `@mvtjs` libraries do something,
or which of the book's own conventions an example follows. MVT requires
an order of calls and a few rules, not any particular library. The
`@mvtjs` libraries include a small library for each renderer that the
book uses (`@mvtjs/pixi`, `@mvtjs/three` and `@mvtjs/html`), and one for
what they share (`@mvtjs/utils`). Where an example uses one, an aside
says so:

::: info In this book
`setRefresh`, from `@mvtjs/pixi`, sets a Pixi container's refresh step:
the step that reads the state and shows it, every frame.
:::

**Experiments** appear throughout the online book. Each is a small
example that runs in the page, written for the passage it sits beside, and
numbered by its chapter, such as Experiment 4A. It shows a picture until
you press Run it here. Then it runs, and View code opens its code below
it, so you can change the code and watch it run again. The link below
each experiment, Open it in the playground, opens it in the playground, a
small editor in your browser for whole projects. The text never depends on an
experiment, and a printed copy shows each one's picture and the address
of its page online instead.

**The website's games, demos and puzzles** supply the bigger examples.
This book is part of the
[MVT Games website](https://yortus.com/mvt-games/), which also has
an arcade of original games, a collection of demos and a collection of
puzzles. They're all built with MVT, in the
[same repo](https://github.com/yortus/mvt-games) as this book. When a
chapter needs more than a sketch, it points to one of them, such as
Burrow Bust, a digging game in the arcade, and links to its code.

## For AI Agents

If you're an AI coding agent working in this repo, start with
[AGENTS.md](https://github.com/yortus/mvt-games/blob/main/AGENTS.md). It
sums up the rules and conventions, and points to the chapters behind
them.
