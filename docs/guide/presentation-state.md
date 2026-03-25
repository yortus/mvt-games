# Presentation State

> In limited cases, a view may maintain internal state for a purely cosmetic
> animation. This is the exception to stateless views - it applies only when
> the model does not need to know about the transition and the state is
> purely presentational.

**Related:** [Views (Learn)](../learn/views.md) ·
[View Composition](view-composition.md)

---

## When It Applies

MVT views are normally stateless - they read model state each frame and update
the presentation to match. Presentation state is the exception. It applies only
when **both** of these conditions hold:

1. The model does not need to know about the transition to enforce domain rules.
2. The internal state is purely cosmetic and does not affect application
   behaviour.

If either condition is not met, the state belongs in the model.

## Example: Animated Score Counter

The model updates `score` in discrete jumps (e.g. 0 to 100 to 250). The view
wants to animate the displayed number smoothly between values:

```
Model state:     0 -------- 100 --------- 250
                    sudden       sudden
                     jump         jump

Displayed value: 0 ~~~~~~~~ 100 ~~~~~~~~ 250
                    smooth       smooth
                    tween        tween
```

The view maintains a `displayedScore` variable and tweens it toward the
model's current score each frame. The model is unaware of this - it only knows
the "real" score.

```ts
function createScoreView(bindings: ScoreViewBindings): Container {
    const view = new Container();
    const label = new Text({ text: '0', style: scoreStyle });
    view.addChild(label);

    let displayedScore = 0;
    let prevClockMs = 0;

    function refresh(): void {
        const clockMs = bindings.getClockMs();
        const deltaMs = clockMs - prevClockMs;
        prevClockMs = clockMs;

        const target = bindings.getScore();
        // Ease toward the model value based on elapsed time
        const t = 1 - Math.pow(0.002, deltaMs / 1000);
        displayedScore += (target - displayedScore) * t;
        if (Math.abs(target - displayedScore) < 1) displayedScore = target;
        label.text = String(Math.round(displayedScore));
    }

    view.onRender = refresh;
    return view;
}
```

This is a valid use of presentation state: the model's score is the source of
truth, and the smooth animation is a purely cosmetic enhancement. Removing the
view would not affect the game's logic.

NOTE: The `getClockMs` binding gives the view access to externally-provided time without
the view inventing its own notion of time. This keeps the animation
deterministic and frame-rate-independent: the same clock progression always
produces the same displayed values, regardless of how often `refresh()` is
called.

## Other Examples

- **Fade in/out** - a model tracks an `isVisible` boolean; the view maintains
  its own `alpha` value that eases toward 0 or 1.
- **Sprite wobble** - a model reports `isHit`; the view plays a brief shake
  animation that decays over a few frames.
- **Score popup** - a model reports a score event; the view spawns a
  floating "+100" label that fades out.

In each case, the model does not track the animation progress. The view
manages a small piece of cosmetic state that exists solely for presentational
polish.

## The Boundary: When to Move State to the Model

If you find a view's internal state doing any of these, it likely belongs
in the model instead:

| Smell                                                               | Remedy                              |
| ------------------------------------------------------------------- | ----------------------------------- |
| Other code depends on the view's internal state                     | Move to the model                   |
| The view's state influences what the model does next                | Move to the model                   |
| The internal state is growing beyond a single tweened value         | Move to the model                   |
| Multiple views need to agree on the same animation progress         | Move to the model                   |
| The animation needs to be paused, replayed, or fast-forwarded       | Move to the model (ticker-driven)   |

The guiding question: **If the view were deleted and rewritten from scratch,
would the application still behave correctly?** If the answer is no, the
state is not purely presentational.

## Guidelines

- Keep presentation state to single values (a tweened number, an alpha
  value, a brief timer).
- Do not let presentation state grow into a complex state machine inside a
  view. If the tweening logic becomes non-trivial, extract it into a
  standalone function that can be unit tested directly - without needing a
  view or rendering context.
- When in doubt, put the state in the model. It is always safe to track
  state in the model; it is only sometimes safe to track it in the view.
- Use a `getClockMs()` binding (or similar) so the view does not hardcode its
  own version of time inside `refresh()`. This keeps presentation animations
  deterministic, frame-rate-independent, and testable.
