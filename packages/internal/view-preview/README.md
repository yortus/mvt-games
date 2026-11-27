# View Preview (spike)

A page for looking at views in isolation, and changing them as you look. It
runs the poses in a site's visual tests, so you don't write anything new to
preview a view. Each literal in a pose becomes a knob that you can change,
and the view can play on from the pose, in real time. The game's tuning
objects get controls too, so you can tune how the game feels while it
plays.

```sh
npm run serve -w @mvtjs/view-preview -- --site puzzles --port 5190
```

Then open the address it prints, such as
`http://localhost:5190/puzzles/__view-preview/`. `--site` is `arcade`,
`demos` or `puzzles`. For any other package with visual tests, give its
folder instead, as `--root packages/sites/site-kit`.

## In VS Code

The extension in `vscode/` puts a **Preview** lens above each `canvasTest`
and `htmlTest` call in a visual test file. Following one opens the preview
in a tab beside the editor, with that test picked. It starts the preview's
server for the test's package the first time, on a free port, and stops it
when VS Code closes. Picking another test of the same package switches the
tab to it, without reloading the page. The link to the source at the top of
the page opens the test in the editor, at its pose.

To try it, build it, then install it from its folder:

```sh
npm run build:vscode -w @mvtjs/view-preview
```

In VS Code, run **Developer: Install Extension from Location...** from the
Command Palette, pick `packages/internal/view-preview/vscode`, and reload
the window. The extension finds the server through the `node_modules` of
the test's package, so open a checkout where `@mvtjs/view-preview` is
installed. **MVT: Preview This File's Visual Tests**, also on the editor's
title bar, opens the preview on the file you're in. The servers' output is
in the **MVT View Preview** output panel. The `mvtViewPreview.node`
setting names the Node.js the servers run on, which must run TypeScript
files, as Node.js 22.18 and later do.

## What You Can Do

- **Pick a test.** The left column lists the site's visual test files,
  grouped by entry. Open a file to list its tests, and pick one to run its
  pose.
- **Change its literals.** The right column has a control for each number,
  boolean and string written in the pose. A number gets a slider and a box,
  a colour written as `0xRRGGBB` gets a colour picker, a boolean gets a
  checkbox and a string gets a text box. Each change runs the pose again.
  A slider's range is a guess. To go past it, hold the thumb against an
  end. After a second, the end moves out, faster the longer you hold, and
  the value follows it. An end that the name's unit fixes stays put, such
  as 0 below an `Ms` or 1 above a `Chance`.
- **Tune the game.** Below the knobs, the Tuning section lists the tuning
  objects that the test imports, however indirectly, with a control for
  each field. A tuning object is a top-level `const` named like
  `SHIP_TUNING`, exported or not, whose value is an object literal, as in
  Galaxy Raiders' models and views. A number's control gets its range from
  the unit its name ends in, such as `Ms`, `PerSecond` or `Chance`. Each
  field shows its doc comment under its name. While time stands still, a change
  runs the pose again, so you see the pose as the new value makes it. While
  the view plays, a change sets the field on the object itself, and the
  models and views that read it see it the next time they use it. Changes
  are kept for the browser's tab, across reloads, and Reset puts a field
  back as the file has it.
- **See the knobs that matter.** Once a pose is shown, the preview checks
  what each knob does to it, which takes a second or two. It runs the pose
  with each knob set to half and one and a half times its value, the other
  value of a boolean, or the opposite colour, and compares the pictures.
  Then each list puts the knobs that change the picture first, with the
  share of the picture they change, such as `2%`, beside their names. The
  knobs that leave the picture the same, and the tuning fields the pose
  doesn't read, are folded away at the bottom, unless you've changed them.
  As the view plays on, a field it reads for the first time, such as a
  dive's timing once a raider dives, moves up out of the folded ones,
  marked `in play`. The line at the top of the panel says how many knobs
  change the pose. A knob holding text isn't checked, since other text may
  be text the code doesn't expect, so it's always shown.
- **Play on from the pose.** Play, Pause and Step move time on from where
  the pose left the view. The models that the pose passed to `advanceTime`
  move on with it, so a celebration or a flight plays to its end.
- **Keep what you see as a test.** Snapshot adds a test to the file, just
  below the one you're previewing. It's a copy of that test, with the knobs
  as you've set them, under a name you choose. Then v-snap writes the new
  test's reference image, as it does on any new test's first run, and the
  page shows it below the knobs. That's the image each run of the test
  compares with, drawn in v-snap's own browser, so you can check it against
  the preview. In VS Code, the extension adds the test through the editor,
  and refuses while the file has changes you haven't saved.
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
- Each tuning object passes through `registerTuning` as it's created
  (`src/node/instrument-tunings.ts`), which returns the same object, so the
  page can change its fields. It returns a stand-in for the object, which
  notes each field the code reads, so the preview knows which fields a
  pose reads. To list a test's tuning objects, the server follows the test
  file's imports through Vite's module graph.

To check what the knobs do (`src/page/knob-effects.ts`), the page runs the
pose off the page, draws it, and reads its pixels, with the live view held
still meanwhile. It runs the pose twice as it is first, to check that it
draws the same picture each time.

The page (`src/page/`) shows each view as the site's `vsnap.config.ts`
says to treat it. A Pixi view is drawn live on a Pixi renderer of the
page's own. Any other kind of canvas view, such as a three.js one, is
drawn by its kind's own `draw`, each frame that time moves. An HTML view is
added to the page as it is.

## What It Can't Do Yet

- Only literals written in the test's own pose become knobs. A constant, a
  helper's default or a loop's value stays as it is.
- A pose defined elsewhere and passed by name doesn't get knobs.
- A change to a tuning object stays in the page. The preview doesn't write
  it back to its file yet.
- A value worked out from a tuning field as its module loads, such as a
  constant at the top of a file, keeps the value it had then, since the
  module doesn't run again.
- The knob check needs a pose that draws the same picture each time it
  runs. A view that uses `Math.random()` rather than a seeded random source
  shows every knob, with a line that says why. So does an HTML view, whose
  pixels the preview can't read.
- The knob check compares each knob at two other values. A knob whose
  effect starts beyond them, such as a delay that only matters once it's
  longer than the pose, is folded away as leaving the pose the same.
- A slider's range is a guess from the literal. Hold the thumb against an
  end to grow it, or type a value in the box.
- What you see isn't the reference image. The browser draws with your
  GPU and fonts, and v-snap draws in its own calibrated browser.
- A view that needs a texture made by v-snap's renderer (`getPixiRenderer`)
  may show it blank, since the preview draws on a renderer of its own.
- An HTML view shares the preview page, so its stylesheets apply to the
  page too, and the page's to it.
- Snapshot copies only a test declared in a statement of its own. A copy of
  a test declared in a loop, or for a table of cases with `.each` or
  `.for`, would declare a test for each turn or case, all with one name.
- Each preview server keeps a dependency cache of its own, so it optimizes
  the dependencies afresh as it starts. The next server to start deletes
  the caches of those that have stopped.
- In VS Code, a lens finds its test by the line its pose starts on, as
  saved. With unsaved changes that move lines, it opens the file without
  picking a test.
