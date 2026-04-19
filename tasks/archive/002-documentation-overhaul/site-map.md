# Documentation Site Map

Current documentation structure as of 2026-04-17, traced from the entry point
through all navigation paths and into each page's heading hierarchy.

---

## Entry Point

### [docs/index.md](../../docs/index.md) - MVT Games Documentation

- The Three Layers
- Choose Your Path
    - Learn MVT (8 pages)
    - Reference
    - AI Agents
- Contributing
- Design Philosophy

---

## Learn Section

Sequential path through MVT fundamentals. Pages are linked
Previous/Next in this order:

### [docs/learn/what-is-mvt.md](../../docs/learn/what-is-mvt.md) - What is MVT?

- The Problem
- The Solution
- What You Get
- How MVT Relates to Patterns You Know
- What This Project Is
- **Next:** Architecture Overview

### [docs/learn/architecture-overview.md](../../docs/learn/architecture-overview.md) - Architecture Overview

- The Big Picture
- Component Summary
- The Frame Loop
- Key Constraints at a Glance
- **Previous:** What is MVT? | **Next:** Models

### [docs/learn/models.md](../../docs/learn/models.md) - Models

- What is a Model?
- A Minimal Model
- What MVT Requires of Models
- The `update(deltaMs)` Contract
- Testing a Model
- What Belongs in a Model
- What Does NOT Belong in a Model
- Domain-Level Coordinates
    - Grid-based example
    - Continuous-space example
- The Factory Function Pattern
- **Previous:** Architecture Overview | **Next:** Views

### [docs/learn/views.md](../../docs/learn/views.md) - Views

- What is a View?
- A Minimal View
- What MVT Requires of Views
- The `refresh()` Contract
- Scene Graphs in Pixi.js
- What Does NOT Belong in a View
- Presentation State
- Two Kinds of Views
- **Previous:** Models | **Next:** The Ticker

### [docs/learn/ticker.md](../../docs/learn/ticker.md) - The Ticker

- What is the Ticker?
- The Frame Sequence
- Where `deltaMs` Comes From
- Why This Order Matters
- What the Ticker Does NOT Do
- **Previous:** Views | **Next:** Bindings

### [docs/learn/bindings.md](../../docs/learn/bindings.md) - Bindings

- What are Bindings?
- A Minimal Example
- `get*()` Reads State, `on*()` Relays Input
- Why Not Just Pass the Model?
- Wiring Bindings
- Bindings Must Be Re-read Every Frame
- When to Use Bindings vs Direct Model Access
- **Previous:** Ticker | **Next:** Walkthrough

### [docs/learn/walkthrough.md](../../docs/learn/walkthrough.md) - Walkthrough: Asteroids

- Why Asteroids?
- Directory Structure
- Constants Layer
- The Models
    - Domain types
    - A child model: ShipModel
    - The root model: GameModel
    - Model hierarchy
- The Views
    - A leaf view: ShipView
    - The top-level view: GameView
    - Dynamic child views
- The Entry Point
- How It All Fits Together
- **Previous:** Bindings | **Next:** Next Steps

### [docs/learn/next-steps.md](../../docs/learn/next-steps.md) - Next Steps

- Deepen Your Understanding (links to guide/ pages)
- Build Something
- Look Things Up
- Understand the Background
- For AI Agents

---

## Guide Section

Self-contained topic pages. Can be read in any order after completing the Learn
path. Each cross-links to relevant Learn and Reference pages.

### [docs/guide/time-management.md](../../docs/guide/time-management.md) - Time Management

- The `deltaMs` Contract (Recap)
- Forbidden Time Mechanisms
- GSAP Timeline Recipe
    - Step 1 - Create once
    - Step 2 - Append tweens
    - Step 3 - Advance in `update()`
- Structuring `update()` - Advance then Orchestrate
- GSAP Best Practices
    - Use `autoRemoveChildren` and explicit positioning
    - Prefer `timeline.set()` over `onComplete`
    - Guard against zero-duration tweens
- Time Leap Safety
- Testing Time-Dependent Models
    - Helper: stepping through time
- **Related:** Models, Hot Paths, Common Mistakes

### [docs/guide/hot-paths.md](../../docs/guide/hot-paths.md) - Hot Paths

- What Counts as a Hot Path
- Patterns to Avoid
- Quick Litmus Test
- Examples
    - Iterating a child model list
    - Grid coordinate lookups
    - Avoiding repeated traversal
    - Text updates in `refresh()`
- **Related:** Models (Learn), Views (Learn), Change Detection

### [docs/guide/presentation-state.md](../../docs/guide/presentation-state.md) - Presentation State

- When Is State "Cosmetic"?
- Views With Presentation State
    - Example: Death Flash
    - Receiving Time
- Extracting a View Model
    - When to extract
    - Example: Match Effects View Model
    - View model guidelines
- The Boundary: When to Move State to the Model
- Summary
- **Related:** Views (Learn), View Composition

### [docs/guide/bindings-in-depth.md](../../docs/guide/bindings-in-depth.md) - Bindings in Depth

- Optional `on*()` Bindings
- Optional `get*()` Bindings
- Reactive Bindings
- Choosing How Views Access State
    - Decision criteria
    - Why top-level views skip bindings
    - Why leaf views use bindings
- **Related:** Bindings (Learn), Views (Learn), View Composition

### [docs/guide/change-detection.md](../../docs/guide/change-detection.md) - Change Detection

- The Problem
- Manual Previous-Value Tracking
- The `watch()` Helper
- When to Use Change Detection
- Change Detection as Consumer-Defined Events
- Dynamic Child Lists
- **Related:** Bindings (Learn), Bindings in Depth, Hot Paths

### [docs/guide/model-composition.md](../../docs/guide/model-composition.md) - Model Composition

- Parent-Child Delegation
- Model Tree Structure
- Cross-Model Concerns
- Keeping Child Models Independent
- Sharing State Between Children
- Testing Composed Models
- **Related:** Models (Learn), View Composition, Testing

### [docs/guide/view-composition.md](../../docs/guide/view-composition.md) - View Composition

- Parent Views Wire Child Bindings
- View Hierarchy
- Multiple Views, One Model
    - Example: Same property, different reactions
    - Adding views without changing existing ones
- Dynamic Child Views
- Model-View Mapping
    - When 1:1 is natural
    - When 1:1 breaks down
- **Related:** Views (Learn), Model Composition, Bindings in Depth

### [docs/guide/testing.md](../../docs/guide/testing.md) - Testing

- Testing Philosophy
- Testing Models
    - A simple model test
    - Helper: stepping through time
    - Testing helper: factory with defaults
- Testing Composed Models
- Testing Views
    - Scene graph assertions
    - Snapshot testing
- What Not to Test
- Summary
- **Related:** Models (Learn), Views (Learn), Model Composition

### [docs/guide/adding-a-game.md](../../docs/guide/adding-a-game.md) - Adding a Game

- Overview
- The `GameEntry` and `GameSession` Interfaces
- Directory Structure
- Step 1: Define Constants
- Step 2: Create Models
- Step 3: Create Views
- Step 4: Create the Entry Point
- Step 5: Register with the Cabinet
- Checklist
- **Related:** Walkthrough, Models (Learn), Views (Learn), Testing

### [docs/guide/common-mistakes.md](../../docs/guide/common-mistakes.md) - Common Mistakes

- Mistake Reference
    1. Using `setTimeout` in a model
    2. Caching a binding at construction
    3. Pixel coordinates in a model
    4. Per-tick allocations in `refresh()`
    5. Forgetting to advance the timeline
    6. Zero-duration GSAP tweens
    7. Auto-playing a GSAP timeline
    8. Domain logic in a view
    9. View holding domain state
- **Related:** Time Management, Hot Paths, Bindings in Depth

---

## Reference Section

Quick-lookup pages for rules, conventions, and terminology.

### [docs/reference/architecture-rules.md](../../docs/reference/architecture-rules.md) - Architecture Rules

- Model Rules (M1-M5)
- View Rules (V1-V9)
- Ticker Rules (T1-T4)
- Bindings Rules (B1-B4)
- Hot-Path Rules (H1-H4)
- **Related:** Architecture Overview, Style Guide, Glossary

### [docs/reference/style-guide.md](../../docs/reference/style-guide.md) - Style Guide

- Quick Reference (table of conventions)
- Naming Conventions
- File Naming
- Formatting
- Enumeration Types
- Easily Confused Names
- No `null`
- Factory Functions
    - Getter / Setter Pairs
- Code Organisation
    - File Sections
    - Declaration Order Within Functions
- **Related:** Architecture Rules, Project Structure, Glossary

### [docs/reference/project-structure.md](../../docs/reference/project-structure.md) - Project Structure

- Directory Layout
- Barrel Files
    - Why Barrel Files Matter
    - Import Rules
    - Barrel File Contents
    - No Self-Imports Through the Barrel
- Game Module Structure
- **Related:** Style Guide, Architecture Rules, Adding a Game

### [docs/reference/glossary.md](../../docs/reference/glossary.md) - Glossary

- Alphabetical definitions: Barrel file, Bindings, Change detection, deltaMs,
  Domain units, Factory function, Frame sequence, GSAP timeline, Hot path,
  Leap-safe model, Model, MVT, Presentation state, refresh(), Skills file,
  Stateful view, Ticker, update(), View, View model, Watch
- **Related:** Architecture Rules, Style Guide, Project Structure

---

## Foundations Section

Background and academic context for the architecture.

### [docs/foundations/proven-patterns.md](../../docs/foundations/proven-patterns.md) - Proven Patterns Behind MVT

- The Patterns Behind MVT
    - The Game Loop (Ticker)
    - Deterministic Simulation (Models)
    - Passive View (Bindings)
    - Stateless Rendering (Views)
    - Dirty Checking (Watch)
    - Hierarchical Composition
- Why These Patterns Fit Together
- Further Reading
- **Related:** Architecture Overview, Architecture Rules, Glossary

---

## AI Agents Section

Compressed orientation and task-specific skills for AI coding agents.

### [docs/ai-agents/index.md](../../docs/ai-agents/index.md) - AI Agent Orientation

- Architecture: MVT (Model-View-Ticker)
- Critical Rules (6 rules)
- Project Structure
- Cabinet Architecture
- Key Conventions
- File Organisation Within a Module
- Commands (npm scripts)
- Tech Stack
- Skills Files
- Detailed Documentation

### [docs/ai-agents/skill-mvt-model.md](../../docs/ai-agents/skill-mvt-model.md) - Skill: Writing MVT Models

- File Structure
- The `update(deltaMs)` Contract
    - Forbidden Time Mechanisms
- GSAP Timeline Recipe
    - Step 1 - Create
    - Step 2 - Append tweens
    - Step 3 - Advance
    - GSAP Gotchas
- Advance-then-Orchestrate Pattern
- Time Leap Safety
- Domain Coordinates, Not Pixels
- Factory Function Pattern
- What to Export
- Forbidden Patterns - Quick Reference
- Full References

### [docs/ai-agents/skill-mvt-view.md](../../docs/ai-agents/skill-mvt-view.md) - Skill: Writing MVT Views

- File Structure
- Two Kinds of Views
- The `refresh()` Contract
- Bindings Pattern
    - Binding Rules
- Scene Graph Construction
- Using `onRender`
- Change Detection (Watch)
- Presentation State
- Hot-Path Rules for `refresh()`
- Forbidden Patterns - Quick Reference
- Complete Minimal Example
- Full References

### [docs/ai-agents/skill-code-style.md](../../docs/ai-agents/skill-code-style.md) - Skill: Code Style Conventions

- Naming Rules (table)
- File Naming
- Formatting
- Barrel File Rules
- String-Literal Unions
- No `null`
- No Classes
- Easily Confused Names
- Boolean Properties
- File Sections
- Declaration Order Within Functions
- Full Reference

### [docs/ai-agents/skill-code-review.md](../../docs/ai-agents/skill-code-review.md) - Skill: Reviewing Code

- Review Philosophy
- Review Checklist
    1. MVT Architecture Compliance (M1-M5, V1-V9, T1-T4, B1-B4, H1-H4)
    2. Software Engineering Principles
    3. MVT Patterns and Practices
    4. Code Style
    5. Hot-Path Awareness
- Report Structure
- Tone
- Full Reference

### [docs/ai-agents/skill-documentation.md](../../docs/ai-agents/skill-documentation.md) - Skill: Writing and Updating Documentation

- Documentation Structure (6 sections)
- Page Template
- Writing Rules
    - Tone
    - Structure
    - Technical Terminology
- Key Distinctions
    - MVT Architecture vs Code Style
    - Presentation-Agnostic Language
    - GSAP Is a Convention, Not a Requirement
- Code Examples in Documentation
    - Hot-Path Safety
    - Style Compliance
- Cross-Linking Checklist
- Keeping AI Agent Files in Sync
- Diagram Conventions
- VitePress Compatibility
- Full Reference

---

## Reactivity Section

Supplementary guide comparing reactivity approaches. Self-contained with its own
sequential navigation.

### [docs/reactivity/index.md](../../docs/reactivity/index.md) - Reactivity in TypeScript/JavaScript

- Who This Guide Is For
- What This Guide Covers
- Table of Contents (6 pages)
- How to Read This Guide
- Conventions Used
- Quick Orientation (4 common scenarios)

### [docs/reactivity/push-vs-pull.md](../../docs/reactivity/push-vs-pull.md) - Push vs Pull Reactivity

- The Core Question
- Push: The Source Notifies
- Pull: The Consumer Checks
- Hybrid: Push Notification, Pull Value
- State vs Change
- Where Each Approach in This Guide Falls
- Other Approaches Worth Knowing
    - Observable Streams (RxJS)
    - Proxy-Based Observation (MobX, Vue 3)
    - Dirty Flags / Version Stamps
- **Next:** Events

### [docs/reactivity/events.md](../../docs/reactivity/events.md) - Events (Pub/Sub)

- How It Works
- Minimal Working Example
- Common Implementations in TS/JS
    - Typed Event Emitter Pattern
- Benefits (4 items)
- Drawbacks (6 items)
- Design Considerations
    - Aggregate Values (Arrays and Objects)
- When Events Are a Good Fit
- When Events Are a Poor Fit
- Testing Considerations
- **Next:** Signals

### [docs/reactivity/signals.md](../../docs/reactivity/signals.md) - Signals

- How It Works
- Minimal Working Example
- Key Concepts
    - Signals: Readable/Writable State
    - Computed / Memo: Derived State
    - Effects: Side Effects
    - Batching
- Benefits (5 items)
- Drawbacks (7 items)
- Design Considerations
    - Aggregate Values (Arrays and Objects)
- When Signals Are a Good Fit
- When Signals Are a Poor Fit
- Testing Considerations
- **Next:** Watchers

### [docs/reactivity/watchers.md](../../docs/reactivity/watchers.md) - Watchers (Poll-Based Change Detection)

- How It Works
- The Basic Concept
- Implementing the `watch` helper
- Minimal Working Example
- Design Considerations
    - Aggregate Values (Arrays and Objects)
- Benefits (7 items)
- Drawbacks (5 items)
- When Watchers Are a Good Fit
- When Watchers Are a Poor Fit
- Testing Considerations
- **Next:** Comparison & Decision Framework

### [docs/reactivity/comparison.md](../../docs/reactivity/comparison.md) - Comparison & Decision Framework

- Side-by-Side Summary (table)
- Key Insights (4 core points)
- Performance Characteristics
    - Cost shapes
    - Benchmarks (table)
- Correctness Properties
    - Consistency (Freedom from Glitches)
    - Lifecycle Safety
    - Accessor Transparency
- Testability
- Maintainability
- Programming Model
    - Events
    - Signals
    - Watchers
- Architectural Fit
    - Tick-Based Games and Simulations
    - UI-Driven Web Applications
    - Interactive Simulations and Visualisations
    - Loosely-Coupled and Plugin Architectures
- Common Pitfalls Across All Approaches
- **Next:** Worked Examples

### [docs/reactivity/examples.md](../../docs/reactivity/examples.md) - Worked Examples

- Example 1: Score Display (Pac-Man)
    - Events / Signals / Watchers / Observations
- Example 2: Ghost State Transitions (Pac-Man)
    - Events / Signals / Watchers / Observations
- Example 3: GSAP Tween Integration (Breakout)
    - Events / Signals / Watchers / Observations
- Example 4: Asteroid Field (Asteroids)
    - Events / Signals / Watchers / Summary (comparison table)
- Quick-Reference: Which Approach for Which Pattern?
- **Back to:** Overview / Comparison

---

## Contributing

### [docs/contributing.md](../../docs/contributing.md) - Contributing to the Documentation

- Documentation Philosophy (4 principles)
- Audience Model
    - Two audiences (human engineers, AI agents)
    - Two use cases (Learn, Reference)
- Section Purposes (table of content areas)
- Page Template
- Tone and Style Rules
- MVT Architecture vs Code Style
- Presentation-Agnostic Language
- Hot-Path-Safe Code Examples
- GSAP Is Not an MVT Requirement
- VitePress Compatibility
- Adding a New Page
- Updating Existing Pages
- Keeping AI Agent Files in Sync
- Diagram Conventions

---

## Navigation Summary

| Path          | Navigation  | Pages |
| ------------- | ----------- | ----- |
| Learn         | Sequential  | 8     |
| Guide         | Any order   | 10    |
| Reference     | Any order   | 4     |
| Foundations    | Standalone  | 1     |
| AI Agents     | By task     | 6     |
| Reactivity    | Sequential  | 7     |
| Contributing  | Standalone  | 1     |
| **Total**     |             | **37** |
