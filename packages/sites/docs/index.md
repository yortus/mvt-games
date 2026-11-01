---
layout: doc
---

# Building Web Games with MVT

> This book teaches MVT (Model-View-Ticker), a way to structure games that
> run in a web browser. It splits a game into models that decide what
> happens, views that show it, and a ticker that keeps time. The result is
> a game you can test without a screen, pause and replay, and draw any way
> you like. The book starts from what the browser provides and a bouncing
> ball, and builds, one idea at a time, to the techniques behind a full
> arcade game.

## Who This Book Is For

This book is for you if you write games for the browser, or want to, and
you've watched one grow tangled. Perhaps a timer fires while the game
is paused, or a test needs a whole renderer to check one rule, or a
change to how something looks breaks how it behaves. MVT is a way of
keeping those jobs apart.

You'll need to read TypeScript or JavaScript, and know a little about how
a web page works. You won't need a game engine, or any experience of one.
If you build for another platform, or build programs that animate but
aren't games, MVT still applies, and
[Appendix H](appendices/h-mvt-beyond-the-web.md) says what carries over.

## MVT in a Paragraph

A **model** holds the game's state and its rules, and moves forward in
time only when its `update(deltaMs)` is called, with the milliseconds
since the last frame. It has no reference to the views that show it. A
**view** reads the models every frame and shows what they hold, on a
canvas, in the page, or as sound. It never keeps anything that decides what happens.
A **ticker** runs the loop: each frame, it updates every model, then
every view, and then the frame is drawn. Because every model finishes
updating before any view reads it, every view shows the same moment. And
because time reaches the game only through the ticker, the ticker can
pause it, slow it down, or replay it. [Chapter 2](chapters/02-why-mvt.md)
shows why that matters, starting from a game where it goes wrong.

## How the Book Is Organised

| Part | Contents |
| --- | --- |
| **I. The Big Picture** | Where web games come from, why MVT exists, and a first game built with it: [Games in the Browser](chapters/01-games-in-the-browser.md), [Why MVT](chapters/02-why-mvt.md), [A First Game](chapters/03-a-first-game.md) |
| **II. The Simulation** | Models, and the time that moves them: [Models](chapters/04-models.md), [The Tick](chapters/05-the-tick.md), [Time and Phases](chapters/06-time-and-phases.md) |
| **III. The Presentation** | Views, from a single sprite to lists that change, and why they poll: [Views](chapters/07-views.md), [Bindings](chapters/08-bindings.md), [Noticing Changes](chapters/09-noticing-changes.md), [Why Views Poll](chapters/10-why-views-poll.md), [Presentation State](chapters/11-presentation-state.md), [Writing Views in JSX](chapters/12-writing-views-in-jsx.md), [Composing Views](chapters/13-composing-views.md), [Lists and Switches](chapters/14-lists-and-switches.md) |
| **IV. Testing** | Testing each part on its own: [Testing Models](chapters/15-testing-models.md), [Testing Views](chapters/16-testing-views.md), [Visual Tests](chapters/17-visual-tests.md) |
| **V. Advanced Presentation** | Views that grow complex, and what games add: [Growing a Complex View](chapters/18-growing-a-complex-view.md), [Lists in Motion](chapters/19-lists-in-motion.md), [Sound and Music](chapters/20-sound-and-music.md), [Reading Layout Back](chapters/21-reading-layout-back.md), [Reduced Motion](chapters/22-reduced-motion.md) |
| **VI. Performance** | Keeping a game fast: [Why Performance Matters](chapters/23-why-performance-matters.md), [Hot Paths](chapters/24-hot-paths.md) |
| **VII. Why MVT Works** | The principles behind the rules, one chapter each, and how to use them on a case the rules don't cover: [The Principles Behind MVT](chapters/25-the-principles-behind-mvt.md), then [SoC](chapters/26-separation-of-concerns.md), [SSOT](chapters/27-single-source-of-truth.md), [CQS](chapters/28-command-query-separation.md), [DIP](chapters/29-dependency-inversion.md), [CRP](chapters/30-composite-reuse.md), [DbC](chapters/31-design-by-contract.md), [MISU](chapters/32-make-illegal-states-unrepresentable.md), [DfT](chapters/33-design-for-testability.md), and [Using the Principles](chapters/34-using-the-principles.md) |
| **Appendices** | Pages to look things up in: [MVT on One Page](appendices/a-mvt-on-one-page.md) (every rule), [Glossary](appendices/b-glossary.md), [Measurements](appendices/c-measurements.md), [Measuring Performance](appendices/d-measuring-performance.md), [Timelines with GSAP](appendices/e-timelines-with-gsap.md), [Troubleshooting](appendices/f-troubleshooting.md), [API Cheat Sheets](appendices/g-api-cheat-sheets.md), [MVT Beyond the Web](appendices/h-mvt-beyond-the-web.md) |

Each chapter builds only on the chapters before it. When one has to
mention something that comes later, it says so, and doesn't depend on it.

<div class="online-only">

You can also [read the book as a PDF](./building-web-games-with-mvt.pdf),
typeset for print or for reading offline. It's printed each time the site
is published, so it always matches these pages. In place of each example
that runs here, it shows the example's picture and the address of its page.

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

**Examples that run** appear throughout the online book, each written for
the passage it sits beside. Each shows a picture of the example until you
press Run it here. Then it runs in the page, and View code opens its code
below it, so you can change it and watch the example run again. Open it in
the playground, below each one, opens it in the playground, a small editor
in your browser for whole projects. The text never depends on these
examples, and a printed copy shows each one's picture, and the address of
its page online, instead.

**The Arcade's games** supply the bigger examples. The
[Arcade](https://github.com/yortus/mvt-games) is a collection of
original games and demos, all built with MVT, in the same repo as this
book. When a
chapter needs more than a sketch, it points to one of them, such as
Burrow Bust, a digging game, and links to its code.

## For AI Agents

If you're an AI coding agent working in this repo, start with
[AGENTS.md](https://github.com/yortus/mvt-games/blob/main/AGENTS.md). It
sums up the rules and conventions, and points to the chapters behind
them.
