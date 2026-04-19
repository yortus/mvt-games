# Testing Views

> Views turn state into pixels. Testing them means answering: does this
> view produce the right visual output for a given set of inputs? The
> answer is less straightforward than it sounds.

**Related:** [Views (Learn)](../presenting-the-world/views.md) -
[Presentation State](../adding-visual-polish/presentation-state.md) -
[Testing Models](testing-models.md)

---

*Assumes familiarity with [Views](../presenting-the-world/views.md) and
[Bindings](../presenting-the-world/bindings.md).*

## The Challenge

Model tests are simple: call methods, assert values. Views are harder
because their output is a scene graph - a tree of display objects with
positions, scales, alphas, textures, tints, and visibility flags. The
"correct" output is a visual judgement, not a scalar value.

Two approaches exist: asserting on scene graph properties
programmatically, and comparing visual snapshots. They have very
different tradeoff profiles.

## Scene Graph Assertions

The idea: create a view with mock bindings, trigger a refresh, then
assert properties of the resulting display objects.

```ts
it('hides the entity when not visible', () => {
    const view = createEntityView({
        getX: () => 100,
        getY: () => 200,
        isVisible: () => false,
    });

    view.onRender();

    expect(view.visible).toBe(false);
});
```

```ts
it('positions the sprite at the bound coordinates', () => {
    let x = 50;
    const view = createEntityView({
        getX: () => x,
        getY: () => 100,
        isVisible: () => true,
    });

    view.onRender();
    expect(view.position.x).toBeCloseTo(50);

    x = 120;
    view.onRender();
    expect(view.position.x).toBeCloseTo(120);
});
```

Mock bindings make it easy to test edge cases: what happens when the
score is zero? When the entity is at the boundary? When progress is
exactly 1.0?

### The value problem

Scene graph assertions look useful, but consider what they actually
verify and what happens when you change the code.

**Would a reimplementation pass?** Suppose you rewrite a view from
scratch - same visual result, different scene graph structure. Maybe the
old view used a single sprite; the new one uses a container with two
children. The old tests assert `view.position.x` - but the new view sets
position on a child, not the root. The tests fail even though the view
looks identical.

**Would a correct refactor break them?** You rename an internal sprite
from `body` to `hull`, or switch from setting `alpha` to using a
`ColorMatrixFilter`. Same pixels on screen - broken tests.

**Do they catch real bugs?** If you accidentally set `x` instead of `y`,
a position assertion catches it. But the assertion is tightly coupled to
the implementation - it's testing *how* the view achieves its result, not
*what* the result looks like. A human reviewer would spot the visual bug
instantly; the programmatic test only catches it if it happens to assert
the exact property that changed.

**Are they reliable?** Consider this common assertion: `expect(entity.visible).toBe(true)`.
Suppose it passes. But the entity might be invisible to the player for any of these reasons:

- `entity.alpha` is 0
- A parent container's `visible` is `false`
- A parent container's `alpha` is 0
- The entity's position is off-screen
- Another display object is drawn on top of it
- The entity has zero scale
- A mask or filter hides it

The assertion checks one property on one node. Actual visibility is a
product of the entire scene graph hierarchy, draw order, and rendering
state. A passing test gives false confidence - the property is `true`
but the player sees nothing. A visual snapshot would catch all of these
because it tests what actually reaches the screen.

**Are they just snapshot tests with extra steps?** A scene graph
assertion manually encodes what a snapshot would capture automatically -
the current state of the output. But the assertion is partial (you only
check properties you thought to list) and brittle (coupled to the
internal structure). A snapshot captures everything and couples to
nothing internal.

## Visual Snapshot Testing

Visual snapshot testing captures a rendered image of the view and
compares it pixel-by-pixel (or perceptually) against a stored baseline.
When the view's appearance changes, the diff shows exactly what changed -
a shifted sprite, a missing particle, a wrong tint.

### How it works

1. **Render the view** in a headless environment. Pixi.js renders to a
   canvas or WebGL context; the test captures the result as a PNG.
2. **Compare against the baseline.** On first run, the image is stored as
   the baseline. On subsequent runs, the new image is compared to the
   stored one. If they differ beyond a tolerance threshold, the test
   fails and produces a diff image highlighting the changed pixels.
3. **Update baselines** when the change is intentional. Review the diff,
   confirm it looks correct, and accept the new baseline.

### What snapshots verify

A snapshot answers the question: **does this view still look the same as
last time I checked?** It captures everything - position, scale, alpha,
colour, texture, text, particle effects - without knowing or caring about
the internal scene graph structure.

| Property | Scene graph assertions | Visual snapshots |
|---|---|---|
| **Coupling** | Tied to internal structure | Tied to visual output |
| **Coverage** | Only what you assert | Everything visible |
| **Refactor tolerance** | Breaks on structural changes | Survives if pixels match |
| **Failure diagnosis** | Assertion message | Diff image |
| **Maintenance** | Update code | Review and accept new image |
| **Setup cost** | Low (unit test) | Higher (headless browser) |
| **Speed** | Fast | Slower (rendering + comparison) |

### Managing snapshots

Visual snapshots require discipline to avoid becoming noise:

- **Controlled inputs.** Always use fixed bindings values, fixed canvas
  size, and fixed random seeds (if randomness is involved). Non-
  deterministic inputs produce non-deterministic pixels and flaky tests.
- **One scenario per snapshot.** Each snapshot should test a single visual
  state: idle, active, disabled, animating at 50% progress. Combining
  states in one snapshot makes failures hard to diagnose.
- **Review diffs carefully.** When a snapshot fails, the diff image shows
  what changed. If the change is intentional, update the baseline. If
  not, you found a bug. Blindly accepting new baselines defeats the
  purpose.
- **Keep baselines in version control.** They are the "expected output"
  of your tests. Reviewing baseline changes in a pull request gives
  reviewers a visual diff of the view's behaviour.

### Testing views with presentation state

Views with `update(deltaMs)` (those holding
[presentation state](../adding-visual-polish/presentation-state.md)) need time advanced before
the snapshot is taken. Use the same small-step approach as model tests:

```ts
test('door view - halfway through fade-in', async ({ page }) => {
    await page.goto('/test-harness?view=door&isOpen=true&advanceMs=200');
    await expect(page.locator('canvas')).toHaveScreenshot('door-fade-50.png');
});
```

The harness advances the view's `update(deltaMs)` by the specified
amount, calls `refresh()`, renders, and waits for capture.

## Choosing an Approach

| Scenario | Recommended approach |
|---|---|
| View model (plain values, no scene graph) | Unit test with value assertions |
| Visibility / existence / child count | Scene graph assertion |
| Visual correctness of a rendered view | Visual snapshot |
| Regression safety during refactors | Visual snapshot |
| Fast feedback during development | Scene graph assertion (faster) |

Most view testing value comes from visual snapshots. They catch real
visual regressions, survive refactors, and require no knowledge of the
view's internal structure. Scene graph assertions are a lighter-weight
complement for coarse structural checks and view model testing.

## Summary

- **Scene graph assertions** check individual properties of display
  objects. They are fast and simple but tightly coupled to internal
  structure. Best limited to visibility, child count, and view model
  values.
- **Visual snapshots** capture the rendered output and compare against a
  baseline image. They verify what the user actually sees, survive
  refactors, and catch regressions that programmatic assertions miss.
- Use controlled, deterministic inputs for both approaches. Fixed
  bindings, fixed canvas size, fixed seeds.
- Review snapshot diffs carefully. The value comes from the review
  process, not from blind acceptance.
