# Skill: Reviewing Code

> Load before reviewing a change in this repo. The rules and conventions a
> review checks are in the book and in Working in This Repo, and each
> section below links to them. This file adds what is particular to a
> review: the order to work in, what to look for that lint can't catch, how
> to report findings, and the tone.

---

## Review Philosophy

A code review is an opportunity to improve the codebase, not just approve
changes. Report findings as concrete recommendations with rationale, not
vague suggestions. Each finding should explain **what** to change, **why**
it matters, and **how** to fix it.

Organise findings by importance: architectural and correctness issues
first, style nits last. The reviewer's attention budget mirrors the
reader's, so the most impactful feedback should land first.

Lint already checks much of the style (see
[Code Style: Enforcement](../working-in-this-repo/code-style.md#enforcement)).
Spend your attention on what it can't check.

## Before You Review

- Run `npm run lint`, `npx tsc -b` and `npm run test:unit`. For a change
  to views, also `npm run test:visual`, and open every new or changed
  reference image. Report any failure as Critical.
- Read the change in full, then the code around it that it depends on.

---

## Review Checklist

Work through these categories in order.

### 1. MVT Architecture Compliance

These are non-negotiable. Violations produce incorrect code. The rules
are in [Appendix A](../appendices/a-mvt-on-one-page.md); name the rule in
the finding.

| Rules | What to check | Common violation |
| ---- | ------------- | ---------------- |
| [Model rules](../appendices/a-mvt-on-one-page.md#model-rules): M-time, M-isolation, M-domain, M-composition | Models own all domain state; advance via `update(deltaMs)` only; no view or ticker references; domain-level coordinates and terms, input included; parent delegates to children | Model importing a view type; model using `Date.now()`; model storing pixel coordinates; a `restartPressed` flag the model watches for a press |
| [View rules](../appendices/a-mvt-on-one-page.md#view-rules): V-stateless to V-tree | No domain state; `refresh()` idempotent and read-only; getter bindings re-read every refresh; presentation state only when purely cosmetic, and valid from construction | View caching a binding value at construction; `refresh()` mutating model state; domain logic in a view; display objects added in `update()` |
| [Ticker rules](../appendices/a-mvt-on-one-page.md#ticker-rules): T-sequence to T-control | Update models, update views, refresh views, draw; `deltaMs` capped; no domain logic in the loop | Loop performing collision checks; a view forwarding `update` or `refresh` to its children |
| [Binding rules](../appendices/a-mvt-on-one-page.md#binding-rules): B-contract to B-wiring | Query bindings carry state in, relay bindings carry input out; leaf views use bindings; relay bindings optional; wired at the construction site | View reaching into model internals; a query binding declared as a function but read only at construction |
| [Hot-path rules](../appendices/a-mvt-on-one-page.md#hot-path-rules): H-cost, H-alloc, H-loops, H-change | No per-tick allocations; index loops; change detection for slow, infrequent work | `array.map()` in `refresh()`; template-string keys in `update()` |

### 2. Software Engineering Principles

These principles apply broadly and keep the codebase maintainable. Each
has a page of its own, introduced in
[Chapter 25, The Principles Behind MVT](../chapters/25-the-principles-behind-mvt.md),
with a checklist. Name the principle in a finding, so the author can read
why it matters. This section keeps only what is specific to reviewing.

#### Isolation and clear interfaces

See [Separation of Concerns](../chapters/26-separation-of-concerns.md)
and [Design by Contract](../chapters/31-design-by-contract.md).

Every part of the system should be understandable, testable, and
replaceable with minimal knowledge of its surroundings. Look for directory
modules connected through typed interfaces and barrels, files of a
readable length ([Code Style: File Naming](../working-in-this-repo/code-style.md#file-naming)),
narrow public contracts, and JSDoc on every export
([Code Style: Documenting Exports](../working-in-this-repo/code-style.md#documenting-exports)).

When reviewing, ask: *Could someone understand this module by reading only
its public interface, without looking at anything else?*

**Common finding:** A module exposes internal helpers or types that
callers don't need. **Fix:** move them below the exports or into a private
helper file; tighten the barrel's re-exports.

**Common finding:** An exported interface or factory lacks JSDoc, so
callers have to read the implementation. **Fix:** add at least a one-line
summary to every export and public member, and document units,
constraints and side effects the types don't convey.

**Common finding:** A new value export of `@mvtjs/utils`, a renderer's
package, `audio90` or the playground's `playground` module is on no cheat
sheet. The cheat sheets' test fails on it. **Fix:** add an entry to the
sheet for its task, in `packages/sites/playground/cheat-sheets/`, or add it
to `LEFT_OUT` there with the reason no project needs it.

#### Single responsibility (pragmatic, not dogmatic)

See [Separation of Concerns: Cohesion and Coupling](../chapters/26-separation-of-concerns.md#applied-to-mvt-cohesion-and-coupling).

Each function, file, or module should "do one thing", but avoid the
extremes:

- **Too coarse:** A very long function performing many steps with all
  details inline. Hard to read, test, or modify in isolation.
- **Too fine:** Many tiny functions requiring the reader to jump between
  files to understand a single flow. The extra indirection outweighs the
  benefit of the abstraction.

The happy medium: a function's steps can be read apart. Putting steps in
order is a job in itself, so a function that only calls a short list of
named steps has enough to do. That works when each step can be understood
from its name, without reading its code or the code around it. Steps that
only make sense together belong in one function.

**Common finding:** A function lists its steps, but writes some of them
out in full, so the reader has to wade through the detail to follow the
order. **Fix:** move each step that can be understood from its name into a
named helper, and keep the function as a readable sequence of steps. Leave
steps that only make sense together where they are.

#### Explicit dependencies, minimal side effects

See [Dependency Inversion](../chapters/29-dependency-inversion.md)
and [Command-Query Separation](../chapters/28-command-query-separation.md).

Functions should operate on their declared inputs and return their result.
Prefer pure computations. Flag these during review:

- Functions that read or modify external state not passed as arguments.
- Methods that implicitly share instance state (a reason that this repo
  prefers factory functions over classes).
- Functions that mutate their input parameters.
- Code that depends on display-object structure not documented as stable
  in a public interface.

Where side effects are unavoidable, they **must** be documented in the
public API via JSDoc, so that it is clear what counts as a breaking change.

**Common finding:** A helper reaches into a parent's state through a
closure, without that dependency being visible in its signature. **Fix:**
pass the needed value as a parameter, or document the coupling in the
interface contract.

#### Contract-driven coupling

See [Design by Contract](../chapters/31-design-by-contract.md).

Review for over-specified contracts that guarantee more than callers need,
under-specified ones that leave callers to depend on observed behaviour,
and code that depends on another module's internals rather than its
documented interface.

**Common finding:** A view reads a model property that isn't in the
model's public interface. **Fix:** add it to the interface if it is a
genuine requirement, or route it through a binding.

### 3. MVT Patterns and Practices

Beyond the hard rules, review for good use of the patterns the book
teaches. Link the section in the finding.

| Look for | Read |
| --- | --- |
| A model's `update` advances everything first, then orchestrates; sequencing lives in `schedule*()` helpers | [Chapter 6](../chapters/06-time-and-phases.md#advance-then-orchestrate) |
| Parents delegate `update` to children; cross-model work in the parent | [Chapter 4](../chapters/04-models.md#trees-of-models) |
| A model produces the same results at any step size up to the ticker's cap: timers and phases carry leftover time, collisions are checked along the way, and every event that came due in a step happens | [Chapter 6](../chapters/06-time-and-phases.md#steps-of-different-sizes) |
| A test moves time in steps no bigger than the cap (`advanceTime`), never one big `update` | [Chapter 15](../chapters/15-testing-models.md#advancing-time) |
| A moment that repeats is a count, not an event | [Chapter 9](../chapters/09-noticing-changes.md#counts-moments-that-repeat) |
| Views build display objects once, and change properties in `refresh()` | [Chapter 7](../chapters/07-views.md#the-refresh-contract) |
| Change detection for slow work; reactions called every step and named effect-then-trigger | [Chapter 9](../chapters/09-noticing-changes.md#the-four-rules-of-change-detection) |
| Presentation state only when cosmetic; complex logic in a view model | [Chapter 11](../chapters/11-presentation-state.md#when-is-presentation-state-really-domain-state), [Chapter 18](../chapters/18-growing-a-complex-view.md#extract-a-view-model) |
| Bindings wired by the parent; view tree free to differ from the model tree | [Chapter 13](../chapters/13-composing-views.md#parent-views-wire-their-children) |
| Audio views play on a change, never a state | [Chapter 20](../chapters/20-sound-and-music.md#play-on-a-change-never-on-a-state) |

The order inside a model's `update` (advance, then orchestrate) is not the
same thing as `updateView`'s parents-first walk, which is only how every
view's update is found.

### 4. Code Style

These are project conventions, in
[Code Style](../working-in-this-repo/code-style.md) (its
[Quick Reference](../working-in-this-repo/code-style.md#quick-reference)
is the checklist) and
[Project Structure](../working-in-this-repo/project-structure.md#barrel-files).
Flag violations, but rank them below architecture and engineering
concerns. Lint has already caught most of what can be checked
mechanically, so look for:

- Names that don't say what a thing is or does, a function that doesn't
  start with a verb, `type` or `state` as a name, a boolean without
  `is`/`has`/`can`.
- A file not named for its main export, or an export renamed without its
  file and test.
- File sections, export order and declaration order
  ([Code Organisation](../working-in-this-repo/code-style.md#code-organisation)).
- A factory with ordered parameters instead of one options object.
- Missing JSDoc on exports.

Do not flag a view for having a plain TypeScript body rather than JSX, or
the reverse: either is fine. Suggest the other only where it would clearly
read better, as a low-priority note.

#### Writing

Review the prose too: docs, READMEs, JSDoc, comments, test names and error
messages, against the [Writing Guide](../working-in-this-repo/writing-guide.md).
Give a rewrite for each finding. The usual ones are a clipped voice that
never speaks to the reader, long sentences joined by colons or
semicolons, fragments, terms used before they're explained, in-house names
in a package, and API docs that say who calls a function rather than what
it does.

### 5. Hot-Path Awareness

Code in `update()` and `refresh()` runs every tick. Check it against
[Chapter 24's rules](../chapters/24-hot-paths.md#the-hot-path-rules) and
[its quick test](../chapters/24-hot-paths.md#a-quick-test-for-each-line). Flag
allocations per tick (`map`, `filter`, `slice`, spread, template-string
keys, a new closure, a new object from destructuring), and repeated work
that could be done once.

### 6. Originality

Games and demos may be inspired by classics, but must not copy them. Check
against the Originality section of
[Adding an Entry](../../arcade/src/entries/README.md#originality). Flag:

- **Art without an origin in the repo:** new or changed images that no
  generator script in a site's `scripts/` folder produces and no
  view draws, or anything traced from or closely following other artwork.
- **Borrowed names:** a title, character name or enemy kind taken from an
  existing game, in code, data, comments or docs, other than the credit in
  an entry's `inspiredBy`.
- **Copied layouts:** mazes, levels or patterns transcribed from another
  game.
- **Clone wording:** prose that calls a game a clone of a named game,
  rather than describing its genre.

These block a merge: ask for original art, names or layouts.

---

## Report Structure

Organise review output in this order:

1. **Summary** - one-paragraph assessment of the change. Is it correct?
   Does it follow the architecture? Any high-level structural
   observations?

2. **Critical** - architecture violations, correctness bugs, failing
   checks, or broken contracts that must be fixed before the code is
   acceptable.

3. **Structural improvements** - opportunities to improve isolation,
   simplify responsibilities, tighten contracts, or reduce coupling.
   Always include a concrete recommendation for each.

4. **Style** - naming, ordering, formatting, and convention issues.
   Important for consistency but not blocking.

5. **Observations** - optional. Patterns worth noting for future
   reference, questions about design intent, or places where tests would
   add value.

Within each section, list findings as bullet points with:

- **What:** the specific issue or opportunity.
- **Where:** file and location.
- **Why:** the principle or rule it relates to, linked.
- **How:** concrete fix or recommendation.

---

## Tone

- Direct, constructive, and specific. No vague praise or unfounded
  criticism.
- Frame findings as improvements to the code, not critiques of the author.
- When a trade-off exists (e.g. simplicity vs flexibility), acknowledge it
  and recommend a direction with rationale.
- Use "consider" for genuinely optional suggestions; use "should" or
  "must" for rule violations.
