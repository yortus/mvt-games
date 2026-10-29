# Configuration

Your project has two config files for v-snap. `vitest.config.ts` adds
v-snap's projects to Vitest, and runs in Node. `vsnap.config.ts` registers
the kinds of view that your tests pose, and runs in the test page, as
[Kinds of View](kinds-of-view.md) describes. This page covers the first.

- [v-snap's Projects](#v-snaps-projects)
- [Listing v-snap's Projects](#listing-v-snaps-projects)
- [What the Projects Inherit](#what-the-projects-inherit)
- [Options](#options)
- [Checks When the Config Loads](#checks-when-the-config-loads)
- [Where Files Go](#where-files-go)
- [Changing Layout](#changing-layout)
- [Where a Failed Test's Images Go](#where-a-failed-tests-images-go)

## v-snap's Projects

v-snap's tests run in Vitest projects of their own, beside your unit
tests. A Vitest project is a group of test files with its own settings.
That's what lets the visual tests run in a browser while your unit tests
stay in Node. v-snap makes a project for your canvas tests and another
for your HTML tests, if you have tests of that kind. Vitest runs them
after your other projects, in a group of their own (Vitest's
`sequence.groupOrder`).

You add them with the `vsnap()` plugin, as
[Getting Started](getting-started.md#an-example) shows. v-snap's options
go in the call. Here, `react()` stands for the plugins that your views
need:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

export default defineConfig({
    plugins: [react(), vsnap({ viewport: { width: 960, height: 600 } })],
    test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
});
```

When Vitest starts, the plugin does three things:

- **It adds v-snap's projects to the run.** They bring v-snap's reporter
  with them, which prints the visual tests' summary and checks the
  reference images. So you don't need to add anything else.
- **It leaves the visual test files out of your config's own tests,** by
  adding v-snap's `include` globs to their `exclude`. If your config lists
  its projects, the plugin does this for each project listed inline.
- **It names your unit tests `unit`,** if your config is a flat config
  (one with no `test.projects` list) and doesn't name them already. Then
  `vitest -p unit` runs them alone.

The plugin works through the projects that Vitest starts with, since
Vitest calls a plugin only through a project that carries it. A project in
a config file of its own, such as one that a glob like `'packages/*'`
names, doesn't carry the plugin. So it must leave out the visual test
files itself. And if every project is in a file of its own, the plugin
never runs, and the visual tests are silently missing. In that case, list
v-snap's projects with `vsnapProjects()` instead, as the next section
shows.

`vitest` runs every test. To run only the visual tests, give Vitest part
of their paths, since it runs the test files whose paths contain what you
give it. With v-snap's default `include`, the visual tests are in
`visual-tests` folders, so `vitest visual-tests/` runs them alone. If you
changed `include`, use a part of the paths that your visual test files
share.

You can't pick the plugin's projects by name with Vitest's `-p`
(`--project`) filter. That's because the plugin adds them from inside
your config's own projects. A filter such as `-p "visual-*"` leaves those
projects out, so the plugin never runs, and Vitest finds nothing to run.
Vitest then stops, and says that no projects matched the filter. v-snap
usually explains first, and suggests filtering on the paths instead. It
can't explain when it can't tell which projects carry the plugin, such as
when one of them has no name. If you want to pick v-snap's projects by
name, list them yourself, as the next section shows.

## Listing v-snap's Projects

If your config lists its projects, you can list v-snap's projects there
too, with `vsnapProjects(options)`, which returns them. This suits a
monorepo that wants to see every project in one place, or to pick v-snap's
projects by name, as `vitest -p "visual-*"` does. It's also what to use
when all your projects are in config files of their own.

```ts
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnapProjects } from 'v-snap/vitest';

export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    exclude: [
                        ...configDefaults.exclude,
                        '**/visual-tests/*.test.{ts,tsx}',
                    ],
                },
            },
            ...vsnapProjects(),
        ],
    },
});
```

The unit project has `extends: true`, so it keeps the config's plugins,
as v-snap's projects do. Vitest's default `include` matches the visual
test files too, so the unit project must leave them out itself. They run
in v-snap's projects instead.

Use either `vsnap()` or `vsnapProjects()` for a set of visual tests, not
both.

## What the Projects Inherit

v-snap's projects inherit the config that adds them, as Vitest's
`extends: true` does. So your views compile with the same plugins and
aliases as the rest of your project. The projects also get settings such
as `alias` and `server` from your config's `test` block.

Your unit tests' own settings don't reach v-snap's projects. Each project
keeps its own `include`, `exclude`, `setupFiles` and `browser`, and drops
the config's `includeSource`, `environment` and `environmentOptions`.
Without this, Vitest would join your lists to the projects' own. Then the
projects would pick up your unit test files, and a setup file written for
Node or a simulated DOM would fail in the browser page. Your `browser`
settings would also run each visual test a second time, in a browser that
v-snap didn't set up.

A `globalSetup` in your config's `test` block runs once for the whole
run, in Node. Vitest never passes a root config's `globalSetup` on to the
projects that inherit it. So a server that it starts for your unit tests
isn't started again for each of v-snap's projects.

## Options

`vsnap(options)` and `vsnapProjects(options)` take the same options, and
every option is optional.

| Option | What it sets |
| --- | --- |
| `name` | The start of the projects' names, which end in `-canvas` and `-html`. The default is `visual`, which gives `visual-canvas` and `visual-html` |
| `root` | The folder that holds `vsnap.config.ts`, which the other paths are relative to. With `vsnap()`, the default is Vitest's root, and a relative `root` is relative to it. With `vsnapProjects()`, the default is the folder that you run Vitest in, and a relative `root` is relative to that. If Vitest's root is elsewhere, such as with `vitest --root`, the run stops and asks you to set it, such as `root: import.meta.dirname` |
| `include` | Globs for your visual test files. See [Where Files Go](#where-files-go) |
| `exclude` | Globs for files that `include` matches but that aren't visual test files, such as fixtures. The default is none |
| `referencePath` | The path template for each reference image. See [Where Files Go](#where-files-go) |
| `maxPixels` | The size budget, which is the most pixels an image may have. It keeps your references small and your tests quick. A smooth view over the budget is drawn at half its size, or a quarter, and so on, until it fits. Detail finer than an image pixel is then averaged away, and the run's summary lists the image. Pixel art and HTML are always drawn at full size, so their tests fail when they're over the budget. The default, `DEFAULT_MAX_PIXELS`, is 500,000 |
| `viteConfig` | A Vite config for v-snap's projects to extend, in place of the config that adds them. Use it in a monorepo whose views need a package's own Vite config |
| `vsnapConfig` | Your `vsnap.config.ts`, which runs in the test page. The default is `vsnap.config.ts` in the root, or `vsnap.config.mts`, `.js` or `.mjs`, if there is one. Naming it shows anyone reading `vitest.config.ts` where the rest of v-snap's settings are |
| `viewport` | The test page's viewport, as `{ width, height }` in CSS pixels. An HTML view must fit inside it, and a test's own `viewport` can't be bigger. The default, `DEFAULT_VIEWPORT`, is 1280 by 800 |
| `colorScheme` | What the page's `prefers-color-scheme` media queries see, `'light'` or `'dark'`, unless a test's own `colorScheme` says otherwise. The default is `'dark'` |

In a monorepo, you can add v-snap's projects once for each package that
has visual tests, each with its own `root` and `name`. Use a `vsnap()`
plugin for each package, or a `vsnapProjects()` call for each, all in one
config. Two packages can also share a root, if their `include` globs
don't overlap. If a test file matches the globs of two of them, the run
stops.

## Checks When the Config Loads

When the config loads, v-snap reads `vsnap.config.ts` as text, without
running it, since the file is meant to run in the test page. It checks
two things:

- **The file has a default export.** v-snap reads its config from that
  export, so a file without one stops the run.
- **The file gives its config's type to v-snap,** with `Register` or
  `bindCanvasTest`. If it doesn't, you get a warning. Without the type,
  `canvasTest` doesn't know your kinds of view, so every test of a kind
  that you registered is a type error.

## Where Files Go

Two options say where you keep your visual test files and their reference
images. Both are relative to the root.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['**/visual-tests/*.test.{ts,tsx}']`.
- **`referencePath`** is a template for each reference image's path. The
  default, `DEFAULT_REFERENCE_PATH`, is
  `'{testFileDir}/{testFileStem}.{imageName}.png'`.

Here's what each of the template's variables gives, for a test named
`at the start` in `src/hud/visual-tests/hud-view.test.tsx`:

| Variable | What it gives | Example |
| --- | --- | --- |
| `{testFileDir}` | The test file's folder | `src/hud/visual-tests` |
| `{testFileName}` | The test file's name | `hud-view.test.tsx` |
| `{testFileStem}` | The name without `.test` or `.spec` and its extension | `hud-view` |
| `{testFilePath}` | The test file's path | `src/hud/visual-tests/hud-view.test.tsx` |
| `{imageName}` | The test's image name, made from its full name | `at-the-start` |

So by default, a view's folder looks like this:

```
src/hud/
  hud-view.tsx
  visual-tests/
    hud-view.test.tsx
    hud-view.at-the-start.png
    hud-view.a-high-score.png
    poses.ts
```

If two test files in one folder have the same stem, such as
`hud-view.test.ts` and `hud-view.test.tsx`, they would share their images.
So v-snap leaves the second one out, and says why. The visual tests then
fail until you rename one of them.

In VS Code, you can fold each test file's images under it in the explorer,
which keeps a busy folder easy to scan. Add these settings:

```json
"explorer.fileNesting.enabled": true,
"explorer.fileNesting.patterns": {
    "*.test.tsx": "${capture}.*.png",
    "*.test.ts": "${capture}.*.png"
}
```

A template must follow these rules, or the run stops when the config
loads:

- It uses only the variables in the table above.
- `{imageName}` appears once, in the file name.
- The file name ends in `.png`.
- The path is relative to the root, and stays inside it.

Two other layouts are common.

```ts
// Tests beside their views, with each test file's reference images in a
// folder of their own:
//   src/hud/hud-view.visual.test.tsx
//   src/hud/__references__/hud-view.visual.test.tsx/at-the-start.png
vsnap({
    include: ['**/*.visual.test.{ts,tsx}'],
    referencePath:
        '{testFileDir}/__references__/{testFileName}/{imageName}.png',
});

// Every reference image in one folder, which mirrors the source tree:
//   visual-references/src/hud/visual-tests/hud-view.test.tsx/at-the-start.png
vsnap({ referencePath: 'visual-references/{testFilePath}/{imageName}.png' });
```

Your unit tests must leave out the visual test files. The `vsnap()`
plugin adds the `include` globs to their `exclude` for you. With
`vsnapProjects()`, add them yourself: `'**/visual-tests/*.test.{ts,tsx}'`
for the default layout, or `'**/*.visual.test.{ts,tsx}'` for the first
layout above.

Keep your other PNGs out of the places where the reference path puts
references. With the default layout, that means a PNG beside a test file
whose name starts with the file's stem and a dot. If a test's image had
that name, the test would compare its actual image with that PNG.

v-snap tells its reference images apart from your other PNGs in two ways.
First, each reference carries a hash of its pixels. Second, it must be at
a path where the reference path would put an image of one of your test
files. This has these effects:

- When you delete a test file, its images still belong to it, as long as
  the `include` globs would match it. So they count as unused, and a run
  outside CI deletes the ones that git tracks.
- A template without `{testFileName}`, `{testFileStem}` or
  `{testFilePath}` can't say which test file an image belongs to. So an
  image counts as a reference only in a folder that holds a test file.
  When you run only some test files, v-snap checks only the images that
  no other test file could own.
- The check for unused references never deletes a PNG without a hash. It
  also leaves alone a copy of a reference in another folder, such as
  `docs`, and the images of another `vsnap()` or `vsnapProjects()` call's
  tests.

## Changing Layout

To change the layout, change the options, then run the visual tests once
with Vitest's `-u` flag. Each test writes its reference image at the new
path, with the same pixels as before. The run leaves the old files alone,
since the new layout would never put a reference there. Once you've
checked the new references, delete the old files by hand.

## Where a Failed Test's Images Go

When a test fails, v-snap writes its actual image to `.vitest/vsnap/` at
the root of your repository. If the image changed but kept its size, a
diff goes beside it. The folders there mirror the reference's path, so
you can find a test's images easily. Outside a git repository, the
`.vitest/vsnap/` folder is in the folder that you run Vitest in. Add
`.vitest/` to `.gitignore`, so that you don't commit these images.

The failure points at the test's `canvasTest` or `htmlTest` line in its
file, just as a failed assertion points at its line. If the pose (the
function that arranges your view for the test) threw an error, the
failure points at the pose's own code instead.
