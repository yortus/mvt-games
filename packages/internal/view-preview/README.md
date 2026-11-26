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
