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

| Layer      | Owns                | Receives       | Must not touch         |
| ---------- | ------------------- | -------------- | ---------------------- |
| **Model**  | State, domain logic | `deltaMs`      | Views, rendering, time |
| **View**   | Presentation        | Bindings/model | Domain state, timers   |
| **Ticker** | Frame loop          | Animation frame | Domain logic, rendering code |

## The Frame Sequence

Every frame follows the same strict order:

```
  Ticker (frame loop)
    ├── 1. model.update(deltaMs)   ← Models advance state
    ├── 2. view.refresh()          ← Views read state, update presentation
    └── 3. renderer draws          ← Frame drawn to screen
```

Models always settle before views read them. Views never see a half-updated
world.

## How This Documentation Is Organized

| Section | What you'll find | When to use it |
|---|---|---|
| **[Architecture](architecture/)** | The transferable MVT specification - contracts, constraints, and patterns in language-neutral terms | Understanding the architecture independent of any implementation |
| **[Learn](learn/what-is-mvt.md)** | Sequential introduction from zero to working understanding, using this project's TypeScript + Pixi.js implementation | New to MVT - start here |
| **[Topics](topics/time-management.md)** | In-depth pages on specific subjects (time, composition, testing, hot paths) - any reading order | Going deeper on a particular topic |
| **[Reference](reference/architecture-rules.md)** | Terse lookup pages - rules, style guide, glossary, project structure | Quick lookups while working |
| **[Reactivity](reactivity/)** | Comparative analysis of reactivity strategies (events, signals, polling) | Understanding why MVT uses polling |

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

### Architecture

Want the pure MVT specification without implementation details?

- [Architecture Overview](architecture/) - The problem, the solution, the three layers
- [Architecture Rules](architecture/rules.md) - Universal MVT constraints
- [Heritage](architecture/heritage.md) - The proven patterns MVT assembles

### Reference

Already familiar and need to look something up?

- [Architecture Rules](reference/architecture-rules.md) - All rules on one page
- [Style Guide](reference/style-guide.md) - Code conventions and naming
- [Glossary](reference/glossary.md) - Term definitions
- [Project Structure](reference/project-structure.md) - Directory layout and barrel files

### Common Mistakes

Making something work but not sure if you're doing it right?
[Common Mistakes](topics/common-mistakes.md) covers the most frequent
anti-patterns and how to fix them.

### AI Agents

AI coding agents should start with [AGENTS.md](https://github.com/yortus/mvt-games/blob/main/AGENTS.md)
for compressed orientation.


