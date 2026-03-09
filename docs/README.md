# Documentation

Welcome to the project documentation. These guides describe the architecture,
patterns, and coding conventions used throughout the codebase.

## Guides

| Document                                 | Description                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [MVT Architecture Guide](mvt-guide.md)   | The Model-View-Ticker pattern — components, data flow, time management, bindings, hot paths                            |
| [MVT Foundations](mvt-foundations.md)    | Proven patterns behind the architecture — game loop, passive view, deterministic simulation, and how they fit together |
| [TypeScript Style Guide](style-guide.md) | Coding conventions — naming, file structure, barrel imports, factory patterns, enums                                   |

**New to the project?** Start with the [Style Guide](style-guide.md) for coding
conventions, then read the [MVT Guide](mvt-guide.md) for architecture.

## Philosophy

These guides are built around four principles:

1. **Separation of concerns** — Models own state; views own presentation; the
   ticker owns time. No layer reaches into another.
2. **Testability by design** — Models are deterministic (same `update` calls →
   same state). Views can be tested with mock bindings. Neither depends on the
   other.
3. **Explicit over implicit** — Time flows through `update(deltaMs)`, not
   hidden timers. Data flows through `bindings`, not global imports. Public APIs
   are defined by interfaces, not implementation details.
4. **Performance without obscurity** — Hot-path rules exist to avoid per-tick
   waste, but clarity still matters. Optimise where it counts; keep everything
   else readable.

## Glossary

Quick reference for terms used throughout the guides.

| Term                   | Definition                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model**              | A stateful object that owns domain logic and advances via `update(deltaMs)`. Has no knowledge of views or rendering.                               |
| **View**               | A stateless renderer that reads model state through bindings and writes to the scene graph via `refresh()`.                                        |
| **Ticker**             | The frame loop that drives the application: calls `model.update(deltaMs)`, then `view.refresh()`, then the renderer draws.                         |
| **Bindings**           | A plain object bridging view↔model. Contains `get*()` accessors for reading state and `on*()` handlers for relaying user input.                    |
| **Barrel file**        | An `index.ts` that re-exports the public API of a directory module. All cross-directory imports must go through the barrel.                        |
| **Factory function**   | A `createXxx(options)` function that returns an object satisfying an interface. Used instead of classes for encapsulation via closures.            |
| **Hot path**           | Code that runs every tick (~60fps) — `update()` and `refresh()` and everything they call. Must avoid unnecessary allocations.                      |
| **deltaMs**            | Milliseconds elapsed since the last tick. The sole mechanism by which time flows into models.                                                      |
| **Presentation state** | Limited view-internal state used purely for visual transitions (e.g., animating a score counter). The exception to the "views are stateless" rule. |
| **GSAP timeline**      | A paused GSAP timeline used inside models to tween state over time, advanced manually via `update(deltaMs)` — never auto-playing.                  |

## See Also

- [AGENTS.md](../AGENTS.md) — Concise AI agent orientation (architecture +
  conventions at a glance)
- [README.md](../README.md) — Project overview and quickstart
