# Troubleshooting

> Something in your game behaves oddly, and you'd like to know why. This
> appendix starts from what you see, grouped by where the trouble shows,
> and points you to the section that explains the cause and the fix. It
> doesn't restate them: each chapter's Common Mistakes section, or the
> section named, has the whole story.

**Related:** [Glossary](b-glossary.md) ·
[MVT on One Page](a-mvt-on-one-page.md) ·
[The Eight Principles](../chapters/25-the-eight-principles.md)

If what you see isn't here, find the part of MVT it touches in
[Appendix A](a-mvt-on-one-page.md), and read the chapter its rule links
to.

## The Model

| Symptom | Where to look |
| --- | --- |
| Resizing the screen, or drawing the game at a different scale, changes how it plays. | [§](../chapters/04-models.md#pixels-in-a-model) |
| The second game starts with odd numbers, or a test passes alone but fails after another. | [§](../chapters/04-models.md#models-that-share-state-through-the-module) |
| You can't test a child model without building the whole game around it. | [§](../chapters/04-models.md#a-child-that-references-its-sibling) |
| Adding touch controls, or a second key for the same thing, means changing the model. | [§](../chapters/04-models.md#a-model-named-after-its-controls) |
| A child model sits still, though the game runs. | [§](../chapters/04-models.md#a-child-that-s-never-updated) |
| You're not sure whether a model may import a data table, a helper or a constant. | [§](../chapters/29-dependency-inversion.md#common-misreadings) |
| A view shows the wrong amount of a transition, or two progress values are both 0, and the model doesn't say which phase is running. | [§](../chapters/06-time-and-phases.md#a-progress-for-each-phase) |
| The model exposes how long a phase has lasted, but the model's own code never reads it. | [§](../chapters/06-time-and-phases.md#a-clock-kept-only-for-a-view) |
| The game can't start a level, or finish a transition, without a view, and tests need a stand-in view. | [§](../chapters/06-time-and-phases.md#a-view-that-calls-the-model-to-move-on) |
| You can't decide whether a piece of state belongs in a model or a view. | [§](../chapters/11-presentation-state.md#when-is-presentation-state-really-domain-state) |
| You're tempted to add a game manager that decides which screen to show. | [§](../chapters/26-separation-of-concerns.md#common-misreadings) |

## Time

| Symptom | Where to look |
| --- | --- |
| Pausing the game doesn't pause something, tests fail now and then, or a bug won't happen the same way twice. | [§](../chapters/04-models.md#a-timer-on-the-wall-clock) |
| After you switch back to the game's tab, objects have passed through walls, or a whole phase has been skipped. | [§](../chapters/05-the-tick.md#an-uncapped-deltams) |
| While the game is paused, a fade finishes, or a light keeps blinking. | [§](../chapters/05-the-tick.md#a-paused-game-that-keeps-moving) |
| An animation runs at different speeds on different screens, or carries on through a pause. | [§](../chapters/11-presentation-state.md#an-animation-that-ignores-the-game-s-speed) |
| The game plays differently at different frame rates, such as a timer or phase that runs slow on a slow phone, or a fast object that passes a wall only at 30 frames a second. | [§](../chapters/06-time-and-phases.md#steps-of-different-sizes) |
| GSAP tweens are added, but the objects don't move, though `update()` is called every tick. | [§](e-timelines-with-gsap.md#forgetting-to-advance-the-timeline) |
| A model that uses GSAP moves on in real time, whatever the ticker does. | [§](e-timelines-with-gsap.md#auto-playing-a-gsap-timeline) |
| A `set()` after a GSAP tween never happens, and the object stops for good. | [§](e-timelines-with-gsap.md#zero-duration-gsap-tweens) |

## Views and Bindings

| Symptom | Where to look |
| --- | --- |
| A sprite runs too fast on a fast screen, keeps moving while the game is paused, or ends up somewhere other than the model's position. | [§](../chapters/07-views.md#a-sprite-that-runs-ahead-of-the-model) |
| The game behaves differently depending on which views exist, or the order they refresh in. | [§](../chapters/07-views.md#a-game-that-depends-on-which-views-exist) |
| Two views disagree for a frame. | [§](../chapters/05-the-tick.md#a-view-that-changes-a-model-during-a-tick) |
| An animation runs at double speed, or a view deep in the tree never moves. | [§](../chapters/13-composing-views.md#a-view-that-runs-twice-or-never) |
| Code that hooks Pixi's `onRender` runs a different number of times from the ticks, or not at all in a test. | [§](../chapters/07-views.md#why-not-pixi-s-onrender) |
| A view is right at first, then shows a stale value after a restart or a new level. | [§](../chapters/08-bindings.md#a-view-that-shows-a-stale-value-after-a-restart) |
| A view's relay binding, such as `onShoot`, means the wrong thing in the next game. | [§](../chapters/08-bindings.md#a-relay-binding-that-means-the-wrong-thing-in-the-next-game) |
| A view quietly falls back to `0` or `''`, and hides a wiring mistake. | [§](../chapters/08-bindings.md#a-view-that-hides-a-wiring-mistake) |
| A reusable view works in one game, but can't be used in another, or tested without a real model. | [§](../chapters/08-bindings.md#a-reusable-view-that-only-works-with-one-model) |
| The game behaves differently, or breaks, when a view is removed or replaced. | [§](../chapters/11-presentation-state.md#a-game-that-changes-when-a-view-is-removed) |
| A view looks right in the game, but is missing pieces in a test. | [§](../chapters/11-presentation-state.md#a-view-that-s-missing-pieces-in-a-test) |
| Something flashes into the wrong state for one frame as its view appears. | [§](../chapters/11-presentation-state.md#a-view-that-flashes-the-wrong-state-as-it-appears) |
| A text field overwrites what the player is typing. | [§](../chapters/11-presentation-state.md#controls-that-are-both-output-and-input) |
| The model receives input for a change that the game made itself, such as a `scroll` or `popstate` event after the view wrote to the page. | [§](../chapters/11-presentation-state.md#controls-that-are-both-output-and-input) |
| In JSX, a property is stuck at its first value, such as a sprite left where the ship started. | [§](../chapters/12-writing-views-in-jsx.md#a-property-stuck-at-its-first-value) |
| A part of a JSX view never appears, or never goes. | [§](../chapters/12-writing-views-in-jsx.md#a-part-of-the-view-that-never-appears-or-never-goes) |
| A sprite flickers between two sizes, or settles on the wrong one. | [§](../chapters/12-writing-views-in-jsx.md#two-attributes-that-write-the-same-state) |
| A JSX view throws as it's built, with a message naming an attribute. | [§](../chapters/12-writing-views-in-jsx.md#a-view-that-throws-as-it-s-built-naming-an-attribute) |
| A middle view's bindings include a value, such as a palette, that it only passes on to its children. | [§](../chapters/13-composing-views.md#a-middle-view-that-passes-on-a-value-it-never-uses) |
| Your view tree has a view for every model, and the backdrop and the transitions don't have an obvious home. | [§](../chapters/13-composing-views.md#a-view-tree-that-copies-the-model-tree) |
| A keyboard handler keeps running after its view is gone, or a `'destroyed'` listener never runs. | [§](../chapters/07-views.md#releasing-a-view-s-resources) |
| You've made a view model for a single fade, and the fade is now harder to find. | [§](../chapters/18-growing-a-complex-view.md#a-view-model-whose-update-does-one-thing) |
| Effects in several sub-views start together, then drift apart. | [§](../chapters/18-growing-a-complex-view.md#effects-that-start-together-then-drift-apart) |
| One-off setup, such as placing particles, repeats every frame, and the particles pile up. | [§](../chapters/18-growing-a-complex-view.md#particles-that-pile-up) |
| Effects stop matching the game when it pauses or slows. | [§](../chapters/18-growing-a-complex-view.md#effects-that-stop-matching-the-game-when-it-pauses) |
| A view model can't be tested without a sprite. | [§](../chapters/18-growing-a-complex-view.md#a-view-model-you-can-t-test-without-a-sprite) |
| Your view has a lot of logic, and you wonder whether that breaks MVT's rules. | [§](../chapters/26-separation-of-concerns.md#common-misreadings) |

## Noticing Changes

| Symptom | Where to look |
| --- | --- |
| A sound sometimes doesn't play, or plays a frame late. | [§](../chapters/09-noticing-changes.md#a-sound-that-sometimes-doesn-t-play) |
| The opening tune never plays, or the first phase's texture is never set. | [§](../chapters/09-noticing-changes.md#an-opening-tune-that-never-plays) |
| A reaction, watcher or computed value throws when it reads its getter. | [§](../chapters/09-noticing-changes.md#a-tool-that-throws-as-it-reads-its-getter) |
| A view misses a thing on a grid that changes its kind. | [§](../chapters/09-noticing-changes.md#a-change-on-a-grid-that-goes-unseen) |
| The second shot in a row doesn't play a sound. | [§](../chapters/09-noticing-changes.md#a-second-shot-that-doesn-t-play-a-sound) |
| Two shots fired in the same tick play one sound. | [§](../chapters/09-noticing-changes.md#several-occurrences-in-one-tick) |
| One moment plays two sounds, because it changed two values. | [§](../chapters/09-noticing-changes.md#two-changes-one-moment) |
| A watcher reports the wrong values, or throws in development. | [§](../chapters/09-noticing-changes.md#a-watcher-that-reports-the-wrong-values) |
| A getter reads as a change on every frame, though the value hasn't changed. | [§](../chapters/09-noticing-changes.md#a-change-is-a-difference-between-two-reads) |
| A reaction keeps watching the old objects after the model replaces them. | [§](../chapters/09-noticing-changes.md#a-tool-s-getters-are-fixed-when-it-s-made) |
| You wonder whether remembering last frame's value is a second copy of the state. | [§](../chapters/27-single-source-of-truth.md#common-misreadings) |

## Lists

| Symptom | Where to look |
| --- | --- |
| A slot shows its first item's look or data after its item changes. | [§](../chapters/14-lists-and-switches.md#a-slot-that-shows-its-first-item-after-the-item-changes) |
| Every getter in an item view checks whether its slot is empty. | [§](../chapters/14-lists-and-switches.md#checks-for-an-empty-slot-in-every-getter) |
| Out-of-range errors, or the wrong item, in a slot's view. | [§](../chapters/14-lists-and-switches.md#out-of-range-errors-or-the-wrong-item-in-a-slot-s-view) |
| A list keeps showing a collection the model has replaced. | [§](../chapters/14-lists-and-switches.md#a-list-that-keeps-showing-a-replaced-collection) |
| A `<Match>` throws, as the view is built or as it first refreshes. | [§](../chapters/14-lists-and-switches.md#a-match-that-throws) |
| A `<Switch>` hides every branch during a new phase. | [§](../chapters/14-lists-and-switches.md#showing-one-of-several-switch) |
| Items jump instead of sliding, or a new item takes over the old one's fade. | [§](../chapters/19-lists-in-motion.md#items-that-jump-instead-of-sliding) |
| A removed item vanishes at once, instead of animating out. | [§](../chapters/19-lists-in-motion.md#a-removed-item-that-vanishes-at-once) |
| A new item slides in from where the last one stood, or arrives half faded. | [§](../chapters/19-lists-in-motion.md#a-new-item-that-slides-in-from-the-last-one-s-place) |
| Mid-drag, the drag jumps to another card, or drops the wrong one. | [§](../chapters/19-lists-in-motion.md#a-drag-that-jumps-to-another-card) |
| Removed items never leave, a slot list fills up, or it throws in development. | [§](../chapters/04-models.md#a-child-that-s-never-updated) |

## Sound

| Symptom | Where to look |
| --- | --- |
| A model's tests need a sound chip, or making a thumbnail makes a noise. | [§](../chapters/20-sound-and-music.md#a-model-s-tests-that-need-a-sound-chip) |
| A sound starts again every frame. | [§](../chapters/20-sound-and-music.md#play-on-a-change-never-on-a-state) |
| A sound plays in the game, but not when the view is refreshed without an update. | [§](../chapters/20-sound-and-music.md#a-sound-that-plays-in-the-game-but-not-in-a-refresh-alone) |
| The game's first sound or song doesn't play. | [§](../chapters/09-noticing-changes.md#an-opening-tune-that-never-plays) |
| Sounds sent as events are missed while a view is made, or the game is paused. | [§](../chapters/20-sound-and-music.md#sounds-sent-as-events-go-missing) |
| A list item's sound never plays when the item is removed. | [§](../chapters/20-sound-and-music.md#sound-for-a-collection) |
| A sound plays when a new item fills a list's slot. | [§](../chapters/20-sound-and-music.md#sound-for-a-collection) |
| A jingle is cut short by the next phase's song. | [§](../chapters/20-sound-and-music.md#music) |
| A repeating sound ignores pausing, or drifts from the game. | [§](../chapters/20-sound-and-music.md#sounds-that-repeat) |
| The music, and sounds already playing, carry on while the game is paused. | [§](../chapters/20-sound-and-music.md#the-clock-that-sound-plays-on) |

## Tests

| Symptom | Where to look |
| --- | --- |
| A test fails, or passes, with the model barely moved. | [§](../chapters/15-testing-models.md#a-test-that-passes-with-the-model-barely-moved) |
| In a test, a phase the model should have reached is never reached. | [§](../chapters/15-testing-models.md#a-phase-the-test-never-reaches) |
| A test fails with `expected 2.0000000000000004 to be 2`. | [§](../chapters/15-testing-models.md#a-position-that-s-off-by-a-hair) |
| A test breaks when a rule moves from one child model to another, though the game plays the same. | [§](../chapters/15-testing-models.md#a-parent-s-test-that-breaks-when-a-rule-moves) |
| A view test finds the defaults, not the state it set up. | [§](../chapters/16-testing-views.md#a-view-test-that-finds-the-defaults) |
| A view test passes, though the view never follows a change. | [§](../chapters/16-testing-views.md#a-test-that-passes-though-the-view-never-follows-a-change) |
| A test checks `visible`, but the player can't see the object. | [§](../chapters/16-testing-views.md#a-visible-object-that-the-player-can-t-see) |
| A visual test fails now and then with a small difference, and passes when it runs again. | [§](../chapters/17-visual-tests.md#an-image-that-differs-on-every-run) |
| A test of a fading or counting view captures the first frame of its transition every time. | [§](../chapters/17-visual-tests.md#a-transition-that-s-always-at-its-first-frame) |
| Every change to the game fails a dozen visual tests. | [§](../chapters/17-visual-tests.md#a-dozen-whole-screen-tests-failing-at-once) |
| A bug has become a reference image. | [§](../chapters/17-visual-tests.md#a-bug-in-a-reference-image) |
| You're adding a method only so a test can reach it, or mocking everything a component uses. | [§](../chapters/33-design-for-testability.md#common-misreadings) |

## Performance

| Symptom | Where to look |
| --- | --- |
| The game stutters now and then, without an obvious cause. | [§](../chapters/23-why-performance-matters.md#garbage-turns-into-pauses) |
| A view makes new text, or redraws a whole grid, every frame, for a value that rarely changes. | [§](../chapters/07-views.md#slow-work-on-every-frame) |
| A JSX getter builds a new string every frame. | [§](../chapters/12-writing-views-in-jsx.md#a-getter-that-builds-a-string-every-frame) |
| An `items` getter builds a new array every frame. | [§](../chapters/14-lists-and-switches.md#an-items-getter-that-builds-a-new-array) |
| Taking a subtree out of the tree to stop it refreshing makes things slower, not faster. | [§](../chapters/14-lists-and-switches.md#a-hidden-subtree-that-makes-things-slower) |
| Hidden views still take time every tick. | [§](../chapters/24-hot-paths.md#hidden-views-that-still-take-time-every-tick) |
| An index loop still makes a closure every tick. | [§](../chapters/24-hot-paths.md#an-index-loop-that-still-makes-a-closure-every-tick) |
| A setup function or a level loader, rewritten with index loops, is harder to read, and isn't any faster. | [§](../chapters/24-hot-paths.md#setup-code-rewritten-for-speed-it-doesn-t-need) |
| You rewrote code because it looked slow, and the game doesn't run any faster. | [§](../chapters/24-hot-paths.md#code-rewritten-for-speed-that-doesn-t-run-any-faster) |
| A page of HTML cards makes frames late when a view measures them in its refresh step. | [§](../chapters/21-reading-layout-back.md#why-not-measure-in-the-refresh-step) |
| Two approaches, timed side by side, produce results that change with their order. | [§](d-measuring-performance.md#one-approach-per-process) |
| A reactive approach looks instant in a benchmark. | [§](d-measuring-performance.md#check-that-the-work-happens) |
| A profile puts almost all the time on one outer function. | [§](d-measuring-performance.md#read-profiles-with-inlining-in-mind) |
| You're not sure whether performance matters for your game at all. | [§](../chapters/23-why-performance-matters.md#when-performance-needs-attention) |
