---
layout: doc
---

# MVT Games Documentation

Canvas and game applications tend to mix state, rendering, and timing into
tangled code that is hard to test, debug, or extend. **MVT (Model-View-Ticker)**
solves this by splitting applications into three strict layers, giving you
deterministic models you can unit test, stateless views you can swap, and
frame-consistent rendering across the board.

## The Three Layers

```
  Ticker (frame loop)
    │
    ├── 1. model.update(deltaMs)   ← Models advance state
    ├── 2. view.refresh()          ← Views read state, update presentation
    └── 3. renderer draws          ← Frame drawn to screen
```

| Layer      | Owns                | Receives       | Must not touch         |
| ---------- | ------------------- | -------------- | ---------------------- |
| **Model**  | State, domain logic | `deltaMs`      | Views, rendering, time |
| **View**   | Presentation        | Bindings/model | Domain state, timers   |
| **Ticker** | Frame loop          | Animation frame | Domain logic, rendering code |

## Choose Your Path

### Learn MVT

New to the project? The learn path takes you from zero to working understanding
in eight short pages:

1. [What is MVT?](learn/what-is-mvt.md) - The problem, the solution, the benefits
2. [Architecture Overview](learn/architecture-overview.md) - The frame loop at a glance
3. [Models](learn/models.md) - State, `update(deltaMs)`, determinism
4. [Views](learn/views.md) - Scene graph, `refresh()`, statelessness
5. [The Ticker](learn/ticker.md) - Wiring the loop
6. [Bindings](learn/bindings.md) - Connecting views to models
7. [Walkthrough](learn/walkthrough.md) - Annotated tour of the Asteroids module
8. [Next Steps](learn/next-steps.md) - Where to go from here

### Reference

Already familiar and need to look something up?

- [Architecture Rules](reference/architecture-rules.md) - All MVT rules in one page
- [Style Guide](reference/style-guide.md) - Code conventions and naming
- [Glossary](reference/glossary.md) - Term definitions
- [Project Structure](reference/project-structure.md) - Directory layout and barrel files
- [Proven Patterns](foundations/proven-patterns.md) - The engineering heritage behind MVT
- [Reactivity Guide](reactivity/) - Events, signals, watchers, and comparison framework

### AI Agents

AI coding agents should start with [AGENTS.md](https://github.com/yortus/mvt-games/blob/main/AGENTS.md)
for compressed orientation.

## Contributing

Adding to or maintaining these docs?
See the [Contributing Guide](contributing.md) for page templates,
section purposes, and style rules.

## Design Philosophy

These guides are built around four principles:

1. **Separation of concerns** - Models own state; views own presentation; the
   ticker owns time. No layer reaches into another. Public APIs
   are defined by interfaces, not implementation details.
2. **Testability by design** - Models are deterministic (same `update` calls
   produce the same state). Views can be tested with mock bindings. Neither
   depends on the other.
3. **Explicit over implicit** - Time flows through `update(deltaMs)`, not
   hidden timers. Data flows through `bindings`, not global imports.
4. **Performance without obscurity** - Hot-path rules exist to avoid per-tick
   waste, but clarity still matters. Optimise where it counts; keep everything
   else readable.


