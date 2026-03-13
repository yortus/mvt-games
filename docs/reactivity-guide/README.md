# Reactivity in TypeScript/JavaScript — A Practical Guide

How to choose and implement a reactivity strategy for interactive TS/JS
applications: games, web apps, simulations, and visualisations.

---

## Who This Guide Is For

Software engineers making architectural decisions about **how state changes
propagate** through a TypeScript/JavaScript application. The guide assumes
familiarity with TypeScript and at least one front-end framework, but does not
assume prior experience with any particular reactivity paradigm.

## What This Guide Covers

Reactivity — the mechanism by which one part of a system responds to changes in
another — is an architectural choice with far-reaching consequences for
performance, correctness, testability, and maintainability. There is no single
"best" approach. The right choice depends on your project's update model, scale,
performance profile, and team expertise.

This guide covers three primary approaches and several variants:

| Approach | Core Mechanism | Section |
|----------|----------------|---------|
| **Events** (pub/sub) | Source emits; listeners subscribe | [events.md](events.md) |
| **Signals** (push-based observables) | Dependency graph auto-tracks reads; triggers on write | [signals.md](signals.md) |
| **Watchers** (poll-based change detection) | Consumer polls a getter each tick; compares to cached value | [watchers.md](watchers.md) |

Each section uses the same structure: concept, working code, benefits, drawbacks,
and situational guidance.

## How to Read This Guide

1. **Start with the conceptual framing** — [Push vs Pull Reactivity](push-vs-pull.md)
   introduces the taxonomy that underpins all three approaches.
2. **Read the approach(es) relevant to your project** — each is self-contained
   with working examples.
3. **Use the comparison** — [Comparison & Decision Framework](comparison.md)
   places all approaches side by side with a decision flowchart.
4. **Reference the worked examples** — [Examples](examples.md) shows each
   approach applied to the same scenarios across different project types.

```
                          ┌──────────────────────────┐
                          │   Push vs Pull Framing   │
                          │    (push-vs-pull.md)     │
                          └────────────┬─────────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 ▼                     ▼                     ▼
        ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
        │    Events    │     │   Signals    │     │   Watchers   │
        │ (events.md)  │     │ (signals.md) │     │(watchers.md) │
        └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
               │                    │                    │
               └────────────────────┼────────────────────┘
                                    ▼
                          ┌──────────────────────────┐
                          │  Comparison & Decision   │
                          │   (comparison.md)        │
                          └────────────┬─────────────┘
                                       ▼
                          ┌──────────────────────────┐
                          │    Worked Examples       │
                          │    (examples.md)         │
                          └──────────────────────────┘
```

## Conventions Used

- **Working code examples** use TypeScript targeting the browser. Game examples
  use [PixiJS](https://pixijs.com/) for rendering and
  [GSAP](https://gsap.com/) for tweening — both are widely used and
  framework-agnostic.
- **Signal examples** use [SolidJS](https://www.solidjs.com/) APIs as the
  reference implementation, with notes on Angular signals and the TC39 Signals
  proposal where they differ materially.
- All examples use classic arcade games (Pac-Man, Asteroids, Breakout, Space
  Invaders, Tetris) as domain references — they are universally understood and
  map well to common interactive patterns.

## Quick Orientation

If you already know what you're looking for:

- *"I'm building a UI-driven web app with forms and data grids"* →
  [Signals](signals.md) are likely your best fit; see also
  [Comparison § UI Apps](comparison.md#ui-driven-web-applications).
- *"I'm building a game or real-time simulation with a tick loop"* →
  [Watchers](watchers.md) are worth serious consideration; see also
  [Comparison § Tick-Based](comparison.md#tick-based-games-and-simulations).
- *"I'm building a loosely-coupled system with decoupled components"* →
  [Events](events.md) may be the right foundation; see also
  [Comparison § Decoupled Systems](comparison.md#loosely-coupled-and-plugin-architectures).
- *"I need to decide between approaches for a new project"* →
  Go straight to the [Decision Framework](comparison.md#decision-framework).

---

*This guide is a living document. Contributions, corrections, and additional
worked examples are welcome.*
