# View Preview (spike)

A page for looking at views in isolation, and changing them as you look. It
runs the poses in a site's visual tests, so you don't write anything new to
preview a view. Each literal in a pose becomes a knob that you can change,
and the view can play on from the pose, in real time.

```sh
npm run serve -w @mvtjs/view-preview -- --site puzzles --port 5190
```

Then open the address it prints, such as
`http://localhost:5190/puzzles/__view-preview/`. `--site` is `arcade`,
`demos` or `puzzles`.

## What You Can Do

- **Pick a test.** The left column lists the site's visual test files,
  grouped by entry. Open a file to list its tests, and pick one to run its
  pose.
- **Change its literals.** The right column has a control for each number,
  boolean and string written in the pose. A number gets a slider and a box,
  a colour written as `0xRRGGBB` gets a colour picker, a boolean gets a
  checkbox and a string gets a text box. Each change runs the pose again.
- **Play on from the pose.** Play, Pause and Step move time on from where
  the pose left the view. The models that the pose passed to `advanceTime`
  move on with it, so a celebration or a flight plays to its end.
- **Edit and save.** Saving a test file or a view reloads the page, which
  picks the same test again, with the knobs you changed, as long as their
  literals in the file haven't changed.

## How It Works

`npm run serve` starts a Vite server from the site's own config, so the
tests resolve and transform as they do in the site. It keeps its own
dependency cache, so it can't disturb a dev server that's already running.
Its plugin (`src/node/view-preview-plugin.ts`) changes three things, in the
preview's server only:

- `v-snap` becomes a stand-in (`src/page/vsnap-stand-in.ts`). Its
  `canvasTest` and `htmlTest` record each test's name, options and pose,
  rather than declare a Vitest test. `vitest` becomes a stand-in too, whose
  `describe` names the tests inside it.
- Each literal in a pose becomes a call to `readKnob`, which returns the
  literal until you change its knob (`src/node/instrument-knobs.ts`).
- `advanceTime` reports the models it advances, so play can keep them
  running.

The page (`src/page/`) shows each view as the site's `vsnap.config.ts`
says to treat it. A Pixi view is drawn live on a Pixi renderer of the
page's own. Any other kind of canvas view, such as a three.js one, is
drawn by its kind's own `draw`, each frame that time moves. An HTML view is
added to the page as it is.

## What It Can't Do Yet

- Only literals written in the test's own pose become knobs. A constant, a
  helper's default or a loop's value stays as it is.
- A pose defined elsewhere and passed by name doesn't get knobs.
- A slider's range is a guess from the literal. Type a value in the box to
  go past it.
- What you see isn't the reference image. The browser draws with your
  GPU and fonts, and v-snap draws in its own calibrated browser.
- A view that needs a texture made by v-snap's renderer (`getPixiRenderer`)
  may show it blank, since the preview draws on a renderer of its own.
