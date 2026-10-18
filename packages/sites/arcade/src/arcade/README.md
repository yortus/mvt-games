# The Arcade

> The site's home page: every game and demo as a card, to search and to play
> in the page. It is an MVT application rather than a game, written in HTML
> JSX, and it shows parts of MVT the games never needed: a model whose only
> clock is a transition, async loading, view models with tests of their own,
> and a page that hosts entries on any renderer in one loop. This README is a guided
> path through those lessons, each pointing at the code that shows it.

**Related:** [Adding an Entry](../entries/README.md) ·
[Architecture Rules](../../../docs/architecture/rules.md) ·
[Presentation State](../../../docs/building-with-mvt/adding-visual-polish/presentation-state.md)

---

## The Pieces

| Where | What |
| --- | --- |
| [`main.ts`](./main.ts) | The page: makes the model, the views and the entry host, and runs the one loop |
| [`models/arcade-model.ts`](./models/arcade-model.ts) | `ArcadeModel`: the search, the tags chosen, the phase, the entry launched |
| [`models/arcade-query.ts`](./models/arcade-query.ts) | The search as a URL query, and back |
| [`models/highscores-model.ts`](./models/highscores-model.ts) | `HighscoresModel`: every game's highscore table, and a score that places in one, from asking for initials to showing the table |
| [`models/sound-settings.ts`](./models/sound-settings.ts) | The visitor's sound settings, their defaults, and how they are saved and read back |
| [`data/sounds.ts`](./data/sounds.ts) | The Arcade's own sound effects, and the pause menu's two previews |
| [`data/way-in.ts`](./data/way-in.ts) | How long each part of the way into an entry takes, which the model and the transition share |
| [`views/arcade-view.tsx`](./views/arcade-view.tsx) | The top-level view: takes the model, wires the rest |
| [`views/card-wall-view.tsx`](./views/card-wall-view.tsx), [`card-view.tsx`](./views/card-view.tsx) | The wall of cards, and one card |
| [`views/card-wall-layout.ts`](./views/card-wall-layout.ts) | View model: where each card goes, in columns, and how it moves there |
| [`views/entry-transition-view-model.ts`](./views/entry-transition-view-model.ts), [`entry-transition-view.tsx`](./views/entry-transition-view.tsx) | View model and view: the way into an entry and back out |
| [`views/search-bar-view.tsx`](./views/search-bar-view.tsx), [`search-suggestions.ts`](./views/search-suggestions.ts) | The search box, its tag tokens and suggestions |
| [`views/runner-view.tsx`](./views/runner-view.tsx), [`pause-menu-view.tsx`](./views/pause-menu-view.tsx) | The bar over a running entry, and the pause menu |
| [`views/placing-view.tsx`](./views/placing-view.tsx), [`highscore-table-view.tsx`](./views/highscore-table-view.tsx) | The prompt for a player's initials when their score places, and a game's highscore table, in the pixel font |
| [`views/resume-offer-view.tsx`](./views/resume-offer-view.tsx) | The offer to resume a game the visitor left part way through, or to restart it |
| [`../storage/`](../storage/) | `LocalStore`: what the page keeps in the browser between visits, read and written without ever throwing |
| [`views/*-audio-view.ts`](./views/) | The views that play the Arcade's own sounds and the pause menu's previews of the volumes. They load on the visitor's first press |
| [`../runner/`](../runner/) | The entry host, which runs one entry of any renderer |

The rest are smaller views (the marquee, the info panel, the About note) and
their helpers.

## 1. A Model Whose Only Clock Is the Way In

Almost everything the Arcade's model owns changes only when the visitor
does something: the search text, the tags chosen, which entry is chosen,
whether it is paused. A menu, a form or a search is as much a model as a
maze chase. MVT does not need every model to be a simulation. It needs
every model to change only through its own methods, so that views can read
it every frame without asking what changed.

One thing in it does move with time: the way into an entry.
[`createArcadeModel`](./models/arcade-model.ts)'s `update(deltaMs)` times
it, and nothing else. Section 5 explains why that clock belongs to the
model, not to the views that draw it.

## 2. Domain State and Presentation State

Which state belongs to the model, and which to the views?

- **In the model:** the search text, the tags chosen (in the order chosen),
  the phase (`'browsing' | 'launching' | 'revealing' | 'playing'`) and how
  long it has lasted, the entry launched, whether it is paused, and which info panel is open (an entry's,
  or the Arcade's own; one at a time). These are what the visitor asked for.
  The URL is a projection of them: `main.ts` writes the query and the path
  from the model (`writeUrl`), and reads them back on load. An entry's path
  is the Arcade's with the entry's id added (`arcade/crumb-chase/`). Going
  into an entry adds a history step, so Back returns to the wall, and so does
  opening an info panel on the wall (`writePanelStep`), so Back closes it, as
  a phone's back button is expected to. An entry's info panel opened over
  the entry, from the runner's (i), adds none: Back from an entry leaves it. The model also holds the visitor's sound
  settings. These are a volume for the music and one for the effects, the
  level each had when it was turned off, and whether all sound is muted. It
  holds the visitor's favourites too, which the wall shows first, and
  whether a saved game is offered for resuming. The page saves the settings
  and the favourites in `localStorage`, through a `LocalStore`
  ([`../storage/`](../storage/)), whenever they change, and reads them back
  on load. A started entry stands still while it is revealed, and runs once
  the reveal is over.
- **In the views:** which card is selected (`selected` in
  [`card-wall-view.tsx`](./views/card-wall-view.tsx)), where each card is
  and where it is sliding to (the layout), and every frame of the way in and
  out (the transition). None of it changes what the Arcade *does*; it
  changes how it looks while doing it.

The selection is the one to argue about. Selecting a card launches nothing,
and losing it on a reload loses nothing, so it is presentation. If the
selection drove something else, say a preview playing in the card, it would
move to the model.

## 3. Async Loading, Made Safe

Launching an entry loads its code, which takes time, and the visitor can
leave before it arrives. `launch` in
[`arcade-model.ts`](./models/arcade-model.ts) counts launches:

```ts
const launch = ++launchCount;
loadEntry(entry).then((loaded) => {
    if (launch !== launchCount || phase !== 'launching') return;
    starter = loaded;
});
```

`exit` increments the count too, so a load that finishes after the visitor
has left, or after a newer launch, is ignored. The promise is the only
wall-clock thing in the model. All it may do is hand over the entry it
loaded, if nothing has happened since. The phase moves on in `update`, at
the next tick, as section 5 shows.

## 4. View Models, Tested on Their Own

Six parts of the views are complex enough to test without a browser, so
each is a view model or a pure helper, with its own tests:

| View model | Test | What it decides |
| --- | --- | --- |
| [`card-wall-layout.ts`](./views/card-wall-layout.ts) | [`card-wall-layout.test.ts`](./views/card-wall-layout.test.ts) | Columns from the wall's width; each card in the shortest column; where cards slide as the search changes |
| [`entry-transition-view-model.ts`](./views/entry-transition-view-model.ts) | [`entry-transition-view-model.test.ts`](./views/entry-transition-view-model.test.ts) | The way in (the wall burns, the picture floats to the play area, the screen powers on) and out, and the quiet fade for reduced motion |
| [`search-suggestions.ts`](./views/search-suggestions.ts) | [`search-suggestions.test.ts`](./views/search-suggestions.test.ts) | Which tags match what was typed, and which one the arrow keys move to |
| [`card-wall-keys.ts`](./views/card-wall-keys.ts) | [`card-wall-keys.test.ts`](./views/card-wall-keys.test.ts) | Which card the arrow keys move to, across columns |
| [`attract-view-model.ts`](./views/attract-view-model.ts) | [`attract-view-model.test.ts`](./views/attract-view-model.test.ts) | Attract mode: which card plays its entry live, once it has stayed selected a second |
| [`initials-view-model.ts`](./views/initials-view-model.ts) | [`initials-view-model.test.ts`](./views/initials-view-model.test.ts) | The initials prompt: the three letters, the blinking cursor, and what each key does to them |

The transition is the clearest example. It is a few hundred lines of
phases, read by the transition view each frame. On the way in, it draws
whatever part the model's phase and time say it has reached. On the way
out, it keeps its own clock. Its tests set the model's phase and time to
each moment of a launch, reduced motion included, and never draw anything.

## 5. A Transition That Decides When Play Starts

The way into an entry decides when the entry starts and when it runs. The
entry mustn't start while the picture is still floating to the play area,
or it would show behind the picture. And it mustn't run before the visitor
can see it, or a game would have moved on before they could take it in.
That timing changes what happens in the Arcade, so the model owns it, and
the views follow, as they would any phase. Its phases are an open-ended
one and a timed one:

```ts
update(deltaMs) {
    elapsedMs += deltaMs;
    if (phase === 'launching' && starter !== undefined && elapsedMs >= launchMs) startEntry();
    else if (phase === 'revealing' && elapsedMs >= REVEAL_MS) enter('playing');
},
```

- **`'launching'` is open-ended.** It lasts until the entry has loaded,
  and for at least `LAUNCH_MS`, the time the wall takes to burn away. So
  an entry that loads at once can't cut the burn short. A visitor who came
  by a link to the entry has no wall to leave, so `launch(id, { isDirect:
  true })` waits for the load alone.
- **`'revealing'` is timed.** The entry starts as it begins, and stands
  still (`isEntryFrozen`) for `REVEAL_MS`. Over that time the picture
  recedes, the entry's screen powers on, and its first frame shows still.
- **`'playing'`:** the entry runs.

The durations are in [`data/way-in.ts`](./data/way-in.ts), and the
transition view model fits its drawing to them. It reads the model's phase
and `elapsedMs` through bindings, and works out which part to draw:

```ts
const transition = createEntryTransitionViewModel({
    arcadePhase: () => model.phase,
    arcadeElapsedMs: () => model.elapsedMs,
    // ...
});
```

(`arcade-view.tsx`.) Nothing in the views calls the model to move it on.
So the model's tests step it through a whole launch with `advanceTime`, and
no views at all. A visitor who asked for less motion gets fades over the
same parts of the model's time, so the entry runs at the same moment for
everyone.

The way out is different. Leaving changes nothing the model waits for: the
model goes back to `'browsing'` at once, and the transition plays the
entry's last frame powering off by its own clock.

## 6. One Loop, Any Renderer

[`main.ts`](./main.ts) runs the page's one loop, in the MVT order:

```ts
model.update(deltaMs);                // the Arcade's model
followModel();                        // start or stop the entry's session as the model starts or leaves it
host.tick(timeMs, deltaMs);           // the entry: its models, its views, its renderers
sound.pageControls.update(deltaMs);   // the page's own chip: advance its clock
updateView(document.body, deltaMs);   // the Arcade's views, its tools in the site's nav among them
refreshView(document.body);
sound.pageControls.flush();           // the page's own chip: send what the views wrote
```

The entry host ([`../runner/entry-host.ts`](../runner/entry-host.ts)) runs
an entry of either kind. A Pixi entry draws on a stage the host owns, whose
ticker the loop steps; an `element` entry (three.js, Pixi and HTML, or any
mix) gives the host the roots of its views, and the host updates and
refreshes exactly those, then asks the entry to render. The view tick API is
the same set of functions for every renderer, so one loop drives them all.
The entry's element sits out the page's own `updateView` and `refreshView`
(its steps return `SKIP_DESCENDANTS`), so nothing is ticked twice.

`followModel` uses `watch` to see the model start the entry
(`isEntryStarted`) or leave it, and starts or ends the entry's session then:
the page, not the model, owns sessions, since they hold renderers. The
session starts in the same tick as the model's `'revealing'`, before the
Arcade's views draw, so its first frame is ready behind the receding
picture.

The page runs a second entry host too, for attract mode: a card that stays
selected for a second plays its entry live over its photo. The wall's
attract view model says which card (`onLiveWanted`); the page loads the
entry and plays it in a host that takes no input (`playLive` in `main.ts`),
ticked in the same loop; the card shows it, scaled and cropped as its
photo. The model never knows: which card plays is presentation.

The page's sound loads late too. Browsers play no sound before the
visitor's first press, so none of it is in the page's first load. On that
press, the page loads the chips (`PageSound.prepare`) and the views that play
the Arcade's own sounds (`loadArcadeAudioViews`). Until the chips load, they
drop every write. The audio views reach `ArcadeView` through a binding,
`audioViews`, which is undefined until they load. A `<Switch>` adds them to
the view tree once the binding is defined. An entry that is launched waits
for the chips to load.

## 7. Measurements as Input

Where a card goes depends on how tall it is, which only the browser knows
once it has laid the card out. The wall measures with a `ResizeObserver`
([`card-wall-view.tsx`](./views/card-wall-view.tsx)) and reports what it
sees to the layout view model as input:

```ts
if (index === undefined) layout.setWidth(record.contentRect.width);
else layout.setCardHeightAt(index, record.borderBoxSize[0]?.blockSize ?? record.contentRect.height);
```

The layout decides positions from those numbers, and the cards' refresh
steps write them. Until a card has been measured, the layout uses an
estimate (`estimatedHeightAt`). The measuring happens in the observer's
callback, between frames, never in a refresh: a refresh that read layout
after writing it would make the browser lay out the page there and then.

## 8. Highscores: A Model Whose Answers Arrive Late

Each game with a score has a highscore table, kept by a server on
Cloudflare that everyone's browser reaches
([`highscores-worker/`](../../highscores-worker/README.md)).
[`createHighscoresModel`](./models/highscores-model.ts) holds the tables,
and a score that places in one. The Arcade's model makes it, and holds it
as `model.highscores`.

Nothing in it moves with time. Its answers
come from the server whenever they arrive, so it guards them as `launch`
does (section 3). Each request is counted, and an answer is taken only if
nothing has happened since it was asked for. A table asked for before a
score was entered is not taken after it. Otherwise it could put back the
table without the visitor's new row.

A game does not know about tables. Its session reports its score, and
whether its run is over, as two query bindings (`scoring`). The page watches
`isOver` turn true, and tells the model the score. If the score would place,
the model asks for initials, and the game stands still behind the prompt.
The Arcade's model says so with `isEntryFrozen`, which the page passes to
the entry host. A frozen game also gets no keys. So the Enter that closes
the prompt cannot restart the game behind it.

The prompt itself is presentation. Its letters, its blinking cursor and
what each key does are a view model
([`initials-view-model.ts`](./views/initials-view-model.ts)). The letters
become the visitor's initials only when they are sent. The page remembers
the last initials in `localStorage`, so the next time the prompt opens on
them.

## 9. Saved Games: The Page Saves, the Model Offers

A game can be saved as the visitor leaves it, and resumed next time. A
session that supports it has two methods: `saveGame()` returns the game as
a value JSON can hold, or undefined when there is nothing worth resuming,
and `loadGame(saved)` restores one, returning whether it could. Most of the
games have them. The [entries' guide](../entries/README.md#saving-a-game)
says what each kind of game saves.

The page saves the game at three moments. It saves every five seconds of
play (`SAVE_EVERY_MS`), counting only time the entry is not frozen. It saves
as the visitor leaves the game. And it saves as the page is hidden or
closed, since a phone may close it without warning. A browser that crashes
gives no warning at all, which is why the page saves as the game plays. A
save is a small JSON string, so saving that often costs little. A save that
returns undefined, from a run that is over, removes the save instead.
Only the page's own host saves:
attract mode and thumbnails run in hosts of their own, so they never save
or load.

The model never sees a saved game. It is asked one question,
`hasSavedGame(id)`, as an entry starts. If the answer is yes, it offers to
resume (`isResumeOffered`), and the entry stands still until the visitor
chooses. The page loads the saved game into the new session at once, so it
shows behind the offer. Resume closes the offer. Restart is a restart, and
the page removes the save. A save the session cannot load, from an older
version of the game say, is removed, and the offer closes.

## Where It Bends the Rules

Four places do something the rules would usually rule out. Each is
deliberate:

- **Reading a drawn pose back from the page.** When the way in starts, it
  needs the exact pose of the card's polaroid, which may be part way through
  a CSS transition as the card is selected. `photoPoseOf`
  ([`card-view.tsx`](./views/card-view.tsx)) reads it from the page
  (`getComputedStyle`, `getBoundingClientRect`), once, as the transition
  starts. Presentation output becomes input, but only at that one moment,
  and only to start presentation state.
- **Views with their own `window` listeners.** The page's keys (`/` for the
  search, Escape to close a panel, pause or leave, the pause menu's arrows,
  R and X) are not events on any one element, and the JSX runtime has no
  attribute for `window`. The views that need them add a listener and remove
  it in `onDestroyed` (`arcade-view.tsx`, `about-view.tsx`,
  `pause-menu-view.tsx`, and `wall-effect-view.ts` for `resize`).
- **The transition writes to the runner's stage.** The screen powering on
  squashes the entry's own picture, which is in the stage element the entry
  host owns. `drawStage` ([`entry-transition-view.tsx`](./views/entry-transition-view.tsx))
  sets that element's `transform` while it plays, and clears it after.
- **Turning the runner with CSS.** On a phone held upright, a game wider
  than tall plays turned a quarter turn, for the phone turned on its side.
  The page decides (`isRunnerTurned` in `main.ts`), and `ArcadeView` marks
  the page with a class, which turns each of the runner's layers in the
  stylesheet. The entry never knows. Pixi finds the pointer from the
  canvas's box in the page, which a turn breaks, so the entry host maps the
  pointer through the turn itself
  ([`../runner/pixi-stage.ts`](../runner/pixi-stage.ts)). That is why only
  games on the host's Pixi stage are turned. The way in floats the polaroid
  to the play area turning as it goes.

## In the Guide

The guide answers, in general, the questions that building the Arcade
raised, with the Arcade's code as its example:

- [Reading Layout Back](../../../docs/building-with-mvt/presenting-the-world/reading-layout.md):
  measurements as input (section 7), and reading a pose once (`photoPoseOf`,
  above).
- [Open-Ended Phases, "When a Transition Decides When Play Starts"](../../../docs/building-with-mvt/animating-transitions/open-ended-phases.md#when-a-transition-decides-when-play-starts):
  why the model times the way into an entry (section 5), and the views
  follow.
- [Reduced Motion](../../../docs/building-with-mvt/adding-visual-polish/reduced-motion.md):
  why `isMotionReduced` is a binding that only the views see, and why the
  quiet way in follows the model's time.
- [Presentation State, "Controls that are both output and input"](../../../docs/building-with-mvt/adding-visual-polish/presentation-state.md#controls-that-are-both-output-and-input):
  why `onHistoryStep`, in `main.ts`, skips the history steps the page takes
  itself.
