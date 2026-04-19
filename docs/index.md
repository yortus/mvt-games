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
| **[Building with MVT](learn/quickstart.md)** | Progressive guide from quickstart to advanced topics - models, views, bindings, reactivity, testing, and more | Learning MVT and building with it |
| **[Reference](reference/architecture-rules.md)** | Terse lookup pages - rules, style guide, glossary, project structure | Quick lookups while working |
| **[Reactivity](reactivity/)** | Comparative analysis of reactivity strategies (events, signals, polling) | Understanding why MVT uses polling |

### Architecture

Want the pure MVT specification without implementation details?

- [Architecture Overview](architecture/) - The problem, the solution, the three layers
- [Architecture Rules](architecture/rules.md) - Universal MVT constraints
- [Heritage](architecture/heritage.md) - The proven patterns MVT assembles

### Building with MVT

The progressive guide takes you from a working example to advanced topics:

1. [Quickstart](learn/quickstart.md) - build a bouncing ball in under 5 minutes
2. [The Game Loop](learn/game-loop.md) - the frame sequence your code lives inside
3. **Simulating the World** - [Models](learn/models.md), [Time Management](topics/time-management.md), [Model Composition](topics/model-composition.md)
4. **Presenting the World** - [Views](learn/views.md), [Bindings](learn/bindings.md), [View Composition](topics/view-composition.md)
5. **Reacting to Changes** - [Change Detection](topics/change-detection.md)
6. **Adding Visual Polish** - [Presentation State](topics/presentation-state.md)
7. **Iterating with Confidence** - [Testing](topics/testing.md)
8. **Avoiding Pitfalls** - [Common Mistakes](topics/common-mistakes.md), [Hot Paths](topics/hot-paths.md)

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


