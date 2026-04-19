# Glossary

> Alphabetical definitions for all terms used across the MVT documentation.
> Each entry links to the page where the concept is explained in depth.

**Related:** [Architecture Rules](architecture-rules.md) ·
[Style Guide](style-guide.md) · [Project Structure](project-structure.md)

---

| Term | Definition |
| ---- | ---------- |
| **Barrel file** | An `index.ts` that re-exports the public API of a directory module. All cross-directory imports must go through the barrel. [Project Structure](project-structure.md) |
| **Bindings** | A plain object bridging view and model. Contains `get*()` accessors for reading state and `on*()` handlers for relaying user input. [Bindings](../learn/bindings.md) · [Bindings in Depth](../topics/bindings-in-depth.md) |
| **Change detection** | A technique where the view polls a binding each frame and acts only when the value differs from the previous frame. Avoids expensive rebuilds for infrequently changing state. [Change Detection](../topics/change-detection.md) |
| **`deltaMs`** | Milliseconds elapsed since the last tick. The sole mechanism by which time flows into models. [Models](../learn/models.md) · [Time Management](../topics/time-management.md) |
| **Domain units** | Position, distance, and velocity units meaningful to the game domain (tiles, world-units, slots) rather than presentation-layer measures (pixels, points). [Models](../learn/models.md) |
| **Factory function** | A `createXxx(options)` function that returns an object satisfying an interface. Used instead of classes for encapsulation via closures. This is a project convention, not an MVT requirement. [Style Guide](style-guide.md) |
| **Frame sequence** | The strict per-frame order: `model.update(deltaMs)` then `view.update(deltaMs)` (views with state) then `view.refresh()` then the renderer draws. [The Game Loop](../learn/game-loop.md) |
| **GSAP timeline** | A paused GSAP timeline used inside models to tween state over time, advanced manually via `update(deltaMs)`. Never auto-playing. This is a project convention for time management, not an MVT requirement. [Time Management](../topics/time-management.md) |
| **Hot path** | Code that runs every tick (~60fps) - `update()` and `refresh()` and everything they call. Must avoid unnecessary allocations. [Hot Paths](../topics/hot-paths.md) |
| **Leap-safe model** | A model whose `update()` produces correct results for any `deltaMs` size (including large leaps). Purely arithmetic models are typically leap-safe; GSAP-based models with orchestration guards are typically not. [Time Management](../topics/time-management.md) |
| **Model** | A stateful object that owns domain logic and advances via `update(deltaMs)`. Has no knowledge of views or rendering. [Models](../learn/models.md) |
| **MVT** | Model-View-Ticker. An architecture for visual, interactive applications that separates state from presentation with a ticker-driven frame loop. [Architecture Overview](../architecture/index.md) |
| **Presentation state** | State that exists purely for cosmetic transitions that the model doesn't track - the model has no reason to know about them because no domain outcome depends on them. Owned by the view that needs it. When the logic is complex, can be extracted into a view model. [Presentation State](../topics/presentation-state.md) |
| **`refresh()`** | A view's per-frame function that reads bindings and updates the presentation output to match current state. Called after all models have updated. [Views](../learn/views.md) |
| **Skills file** | A self-contained instruction document that an AI agent can load for a specific task (writing a model, writing a view, following code conventions). Located in `docs/ai-agents/`. |
| **Stateful view** | A view that holds presentation state for cosmetic transitions the model doesn't track. Returns `Container & { update(deltaMs): void }` so the ticker can advance its state. [Presentation State](../topics/presentation-state.md) |
| **Ticker** | The frame loop that drives the application: calls `model.update(deltaMs)`, then `view.update(deltaMs)` (views with presentation state), then `view.refresh()`, then the renderer draws. [The Game Loop](../learn/game-loop.md) |
| **`update(deltaMs)`** | A model's per-frame method that advances state based on elapsed milliseconds. The sole mechanism for time to flow into a model. [Models](../learn/models.md) · [Time Management](../topics/time-management.md) |
| **View** | A stateless renderer that reads state through bindings (or model properties, for top-level views) and writes to the presentation output via `refresh()`. [Views](../learn/views.md) |
| **View model** | A plain object that owns extracted presentation state and advances it through `update(deltaMs)`. A technique borrowed from MVVM for cases where a view's presentation logic is complex enough to warrant separate testing. Created and owned by the view that uses it - an internal implementation detail. When two sibling views share a view model, the nearest common parent creates it and passes it to both. [Presentation State](../topics/presentation-state.md) |
| **Watch** | A helper (`watch()`) that accepts a record of named getter functions, polls them each frame, and reports which values changed. Each watched property exposes `changed`, `value`, and `previous`. [Change Detection](../topics/change-detection.md) |
