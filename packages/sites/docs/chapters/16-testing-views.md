# Testing Views

> A view is easy to set up for a test: pass it stand-in bindings, refresh
> it, and its output shows the state that they return. Checking the output
> is the hard part. A test can assert on the properties of the objects
> that a view writes, or take
> an image of what it shows. Assertions are quick to write, but they check
> how a view is built rather than what the player sees, so for how a view
> looks, an image is usually the better test.

**Related:** [Views](07-views.md) · [Bindings](08-bindings.md) ·
[Presentation State](11-presentation-state.md) ·
[Testing Models](15-testing-models.md) ·
[Visual Tests](17-visual-tests.md)

Here's a test of a bullet's view. It passes the view stand-in bindings for
a bullet in flight, refreshes it, and checks that the bullet shows:

```ts
it('shows a bullet in flight', () => {
    const view = BulletView({
        x: () => 100,
        y: () => 200,
        isInFlight: () => true,
    });

    refreshView(view);

    expect(view.visible).toBe(true);
});
```

It passes. Then a player reports that bullets have gone invisible. The
view sets the bullet's `visible` flag, as the test checks. It also sets
the bullet's `alpha`, and a change last week set that to 0. The test
passed because it checked one property, and the bug was in another.

This chapter is about that gap, between what a test of a view checks and
what the player sees, and how to choose a test that closes it.

## The Steps of a View Test

A view reads everything it shows through its bindings
([Chapter 8](08-bindings.md)), and writes its output in its refresh step
([Chapter 7](07-views.md)). So every view test has the same start.

1. **Build the view with stand-in bindings.** These are getters and
   functions that the test supplies in place of a model's. Each query
   binding returns a value that the test chooses. A relay binding, if the
   test needs one, is a small function that records its calls.
2. **Refresh it,** so it writes its output for that state.
3. **Check the output.**

Steps 1 and 2 are the easy part, and MVT is why. The view doesn't need a
model, a game or a ticker. A binding is a stand-in for whatever the game
would have passed. The view reads `() => 100` exactly as it would read
the bullet's model.

The output depends on the view. A Pixi view writes display objects,
an HTML view writes elements, and an audio view plays sounds. Step 3 is
where the approaches differ. A test can assert on properties of the
output, or it can take an image of it and compare that with an accepted
one.

## Assertions on a View's Output

An assertion checks one property of what the view wrote. Here's another
test of the bullet's view:

```ts
it('moves the bullet to its new position', () => {
    let x = 50;
    const view = BulletView({
        x: () => x,
        y: () => 100,
        isInFlight: () => true,
    });

    refreshView(view);
    expect(view.position.x).toBeCloseTo(50);

    x = 120;
    refreshView(view);
    expect(view.position.x).toBeCloseTo(120);
});
```

This test changes a binding's value between two refreshes. That checks
something that the first test can't: that the view reads `x` again on every
refresh, rather than once when it's built. A view that reads a getter only
once looks right in a single refresh, and only goes wrong when the value
changes.

::: info In this book
`refreshView`, from the renderer packages such as `@mvtjs/pixi`, refreshes
a view and every view inside it
([Chapter 7](07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries)).
It doesn't need a renderer, so tests like these run in Node without
drawing anything.
:::

Stand-in bindings make edge cases easy to reach. What does the score show
at zero? What does the meter show at exactly 1? What happens to a bullet on
the edge of the screen? Each is a one-line binding, and you don't have to
steer a game into that state first.

So assertions are quick to write, and they run fast. But they check less
than they seem to.

## The Limits of Assertions

Look at what assertions on a view's output really check, and what happens
to them as the code changes.

**Would a rewrite pass?** Suppose you rewrite a view from scratch, and it
looks exactly the same. The old view was one sprite. The new one is a
container with two children, and it sets its position on a child, not on
the container. The old tests assert `view.position.x`, so they fail, even
though the view looks identical.

**Would a correct refactor break them?** You rename an internal sprite
from `body` to `hull`, or you fade with a filter instead of `alpha`. The
screen shows the same thing, and the tests break.

**Do they catch real bugs?** If you set `x` where you meant `y`, a
position assertion catches it. But it catches it only because it happens
to check that property. The assertion tests how the view gets its result,
not what the result looks like. A person looking at the screen would spot
the bug at once.

**Are they reliable?** Go back to `expect(view.visible).toBe(true)`. The
bullet can still be invisible to the player for many reasons:

- its `alpha` is 0
- a parent container's `visible` is `false`, or its `alpha` is 0
- it's off the screen
- something else is drawn on top of it
- its scale is 0
- a mask or a filter hides it

The assertion checks one property of one object. Whether the player sees
the bullet depends on the whole tree above it, the order things are drawn
in, and more. A passing test gives false confidence: the flag is `true`,
and the player can't see the bullet.

[§](#try-bullet-view-poses) poses a bullet's view four times with stand-in
bindings, as four tests would pose it. Under each pose are the values its
test's assertions read. Press View code, open `views/bullet-view.ts`, and
set `BULLET_ALPHA` to 0. The bullets disappear, and every `view.visible`
is still `true`.

<TryIt example="bullet-view-poses" file="views/bullet-view.ts" />

## Testing with Images Instead

An image test takes a picture of the view, and compares it with an
accepted picture, called the
[reference image](../appendices/b-glossary.md), kept beside the test.
When the view looks different, the test fails, and shows you where. It
might be a shifted sprite, a missing particle or a wrong tint. It answers
the question you really have: does this view still look right? And it
doesn't depend on anything inside the view, so a rewrite that looks the
same passes.

The bullet with an `alpha` of 0 fails an image test at once, because the
image doesn't have a bullet in it. So does a hidden parent, or a bullet drawn
under the background.

Images have drawbacks. Each test needs a browser to draw in, and runs more
slowly than an assertion. A failure needs someone to look at it and
decide whether the change was meant. And an image can only show what
looks different, so a change that doesn't show, such as the wrong number
in a field that's off screen, passes. [Chapter 17](17-visual-tests.md)
shows how to write image tests, keep their images the same from run to
run, and review a change.

## Where Assertions Still Help

Assertions are the right tool when the thing you care about isn't how the
view looks.

- **A view model.** When a view grows complex,
  [Chapter 18](18-growing-a-complex-view.md) moves its presentation logic
  into plain values, without any display objects, as a view model. Test it
  the way you'd test a model ([Chapter 15](15-testing-models.md)).
- **Coarse structure.** "A list of five items makes five children" is a
  fact about structure, and an assertion states it well.
- **A relay binding.** Whether the view reports a press when the player
  presses is behaviour, not appearance. Pass a function that records its
  calls, simulate the press, and check the record.
- **Exact words and numbers.** An image shows a score, but a test that
  reads the text can report exactly which digit is wrong. Better still, test
  where the text comes from: the model, or the view model.

A view that plays sound doesn't produce an image. Its output is the sounds it
plays, so its test passes a stand-in chip that records each one, and
checks the record. [Chapter 20](20-sound-and-music.md) shows how, along
with how to test a view that plays music.

For a view you can see, the choice comes down to this:

| To check | Use |
| --- | --- |
| Whether a view looks right in a state | An image |
| That a rewrite or refactor didn't change anything on screen | An image |
| Whether something can be seen | An image |
| The number of children | An assertion |
| A relay binding | An assertion on a function that records its calls |
| The exact words and numbers shown | An assertion, best made on where they come from |

## Common Mistakes

### A view test that finds the defaults

A test builds a view and checks its output straight away, and reads the
defaults, not the state that it set up. A view writes its output in its
refresh step, so the output doesn't reflect the bindings until that step
has run.
Refresh once before you check anything.

### A test that passes though the view never follows a change

The test refreshes once, and the view looks right, but in the game it
never moves. A test of a single refresh can't distinguish a view that
follows a getter from one that read it once. If the view must follow a value,
change it and refresh again, as the second bullet test does.

### A visible object that the player can't see

The test checks that `visible` is `true`, and the player can't see the
object. As
the bullet showed, one property says little about what reaches the
screen. Check visibility in an image. Checking every property that could
hide the object is the other way, and a sign that an image would be
simpler.

## Summary

Testing a view starts the same way every time: stand-in bindings, then a
refresh. MVT makes that easy, because a view needs only its bindings.

Checking the result is where you choose. Assertions on the output are
fast and simple, but they're tied to how the view is built, and they check
only what you list. A property can say a bullet is visible while the
player can't see it. Images check what reaches the screen, survive
rewrites, and catch what you didn't think to list, but they need a
browser, and a person to review each change.

Use images for how a view looks. Use assertions for view models, coarse
structure, relay bindings and exact values. Test an audio view by
recording the sounds it plays.
