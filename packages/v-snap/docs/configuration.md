# Configuration

v-snap has two config files. `vitest.config.ts` lists v-snap's projects, and
runs in Node. `vsnap.config.ts` registers the kinds of view, and runs in
the test page, as [Kinds of View](kinds-of-view.md) describes. This page
covers the first.

- [v-snap's Projects](#v-snaps-projects)
- [What the Projects Inherit](#what-the-projects-inherit)
- [Options](#options)
- [Checks When the Config Loads](#checks-when-the-config-loads)
- [Where a Failed Test's Images Go](#where-a-failed-tests-images-go)
- [Where Files Go](#where-files-go)
- [Changing Layout](#changing-layout)

## v-snap's Projects

v-snap's tests run in two Vitest projects, beside a project's unit tests.
Vitest runs them after the project's other projects, in a group of their
own (Vitest's `sequence.groupOrder`). There are two ways to add them.

The first is `withVsnap(config)`, which adds them to a config as it is, as
[Getting Started](getting-started.md#an-example) shows. v-snap's options go
in the same config, under a `vsnap` key. `withVsnap()` takes them out of
the config that it returns, so Vitest never sees them.

```ts
export default defineConfig(withVsnap({
    vsnap: { root: import.meta.dirname },
    plugins: [/* the plugins that the project's views need */],
    test: { environment: 'jsdom' },
}));
```

What `withVsnap()` does depends on the config's shape:

- **A flat config,** with no projects, gets a project named `unit`, with
  `extends: true`. Its unit test settings move into that project: `name`,
  `include`, `exclude`, `includeSource`, `environment`,
  `environmentOptions`, `setupFiles` and `browser`. The project's
  `exclude` also leaves out the visual test files. The rest of the config
  stays where it is.
- **A config that has projects** keeps them, and v-snap's are added after
  them. Its own projects must leave out the visual test files themselves.

The second way is `vsnap(options)`, which returns the projects, for a
config that lists them itself:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

export default defineConfig({
    plugins: [/* the plugins that the project's views need */],
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
            ...vsnap(),
        ],
    },
});
```

The unit project has `extends: true`, so that it keeps the config's
plugins, as v-snap's projects do. It leaves out the visual test files,
which run in v-snap's projects instead, since Vitest's default `include`
matches both kinds of file.

Either way, v-snap's projects bring v-snap's reporter with them. The
reporter prints the visual tests' summary and checks the reference images.
So there is nothing else to add. A run without v-snap's projects, such as
`vitest -p unit`, prints no summary.

## What the Projects Inherit

v-snap's projects inherit the config that they are listed in, as Vitest's
`extends: true` does. So the views compile with the same plugins and
aliases as the rest of the project.

Some settings must not reach v-snap's projects, so they belong in the unit
project, not in the config's `test` block:

- **`include` and `exclude`.** Vitest adds the config's own lists to an
  inheriting project's, so v-snap's projects would pick up the unit
  tests' files.
- **`setupFiles`.** A setup file would run in v-snap's browser pages,
  where one written for Node, or for a simulated DOM, fails.

`withVsnap()` moves them into the unit project. A run stops with a message
if any of them reach v-snap's projects.

A `globalSetup` in the config's `test` block can stay there, and
`withVsnap()` leaves it. Vitest runs it once for the whole run, in Node,
not once for each project, since it never passes a root config's
`globalSetup` on to the projects that inherit it.

## Options

`vsnap(options)` and the `vsnap` of `withVsnap()`'s config take the same
options. Every option is optional.

| Option | What it sets |
| --- | --- |
| `name` | The start of the projects' names, which end in `-canvas` and `-html`. The default is `visual` |
| `root` | The folder that the other paths are relative to, and that holds `vsnap.config.ts`. The default is the folder Vitest runs in. A run whose Vitest root is elsewhere, such as with `vitest --root`, stops and asks for it, such as `root: import.meta.dirname` |
| `include` | Globs for the test files. See [Where Files Go](#where-files-go) |
| `exclude` | Globs for files that `include` matches but that aren't visual test files, such as fixtures. The default is none |
| `referencePath` | Where each reference image is kept. See [Where Files Go](#where-files-go) |
| `maxPixels` | The size budget, which is the most pixels an image may have. A smooth view over the budget is drawn at half its size, or a quarter, and so on, until it fits. Detail finer than an image pixel is then averaged away, and the run's summary lists the image. Pixel art and HTML are always drawn at full size, so their tests fail when over the budget. The default, `DEFAULT_MAX_PIXELS`, is 500,000 |
| `viteConfig` | A Vite config for v-snap's projects to extend, in place of the config they are listed in. A monorepo whose views need a package's own Vite config names it here |
| `vsnapConfig` | The project's `vsnap.config.ts`, which runs in the test page. The default is `vsnap.config.ts` in the root, or `vsnap.config.mts`, `.js` or `.mjs`, if there is one. Naming it shows a reader of `vitest.config.ts` where the rest of v-snap's settings are |
| `viewport` | The test page's viewport, as `{ width, height }` in CSS pixels. An HTML view must fit inside it, and a test's own `viewport` can't be bigger. The default, `DEFAULT_VIEWPORT`, is 1280 by 800 |
| `colorScheme` | `'light'` or `'dark'`: what the page's `prefers-color-scheme` media queries see, unless a test's own `colorScheme` says otherwise. The default is `'dark'` |

A monorepo can call `vsnap()` once for each package that has visual tests,
with its own `root` and `name`, and list all their projects in one config.
Two calls can also share a root, with `include` globs that don't overlap.
A test file that the globs of two calls match stops the run.

## Checks When the Config Loads

When the config loads, v-snap checks `vsnap.config.ts` by its text, without
running it. A file with no default export stops the run. A file that never
gives its config's type to v-snap, with `Register`, gets a warning, since
then `canvasTest`'s types don't know its kinds of view.

## Where a Failed Test's Images Go

When a test fails, v-snap writes its actual image, and a diff for a changed
image, to `.vitest/vsnap/` at the root of the repository, in folders that
mirror the reference's path. Add `.vitest/` to `.gitignore`. The failure
points at the test's `canvasTest` or `htmlTest` line in its file, as a
failed assertion points at its line. An error that the pose threw points at
the pose's own code.

## Where Files Go

Two options say where a project keeps its visual test files and their
reference images. Both are relative to the root.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['**/visual-tests/*.test.{ts,tsx}']`.
- **`referencePath`** is a template for each reference image's path. The
  default, `DEFAULT_REFERENCE_PATH`, is
  `'{testFileDir}/{testFileStem}.{imageName}.png'`.

The template's variables give these values, for a test named `at the start`
in `src/hud/visual-tests/hud-view.test.tsx`:

| Variable | What it gives | Example |
| --- | --- | --- |
| `{testFileDir}` | The test file's folder | `src/hud/visual-tests` |
| `{testFileName}` | The test file's name | `hud-view.test.tsx` |
| `{testFileStem}` | The name without `.test` or `.spec` and its extension | `hud-view` |
| `{testFilePath}` | The test file's path | `src/hud/visual-tests/hud-view.test.tsx` |
| `{imageName}` | The test's image name, from its full name | `at-the-start` |

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

Two test files in one folder with one stem, such as `hud-view.test.ts` and
`hud-view.test.tsx`, would share their images, so v-snap leaves the second
out, and says why. In VS Code, the explorer can fold each test file's
images under it, with these settings:

```json
"explorer.fileNesting.enabled": true,
"explorer.fileNesting.patterns": {
    "*.test.tsx": "${capture}.*.png",
    "*.test.ts": "${capture}.*.png"
}
```

A template follows these rules, or the run stops when the config loads:

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

The unit project must leave out a layout's test files. `withVsnap()` adds
the `include` globs to its `exclude` itself. A config that lists the
projects by hand adds them: `'**/visual-tests/*.test.{ts,tsx}'` for the
default layout, and `'**/*.visual.test.{ts,tsx}'` for the first layout
above.

Keep other PNGs out of the places where the reference path puts
references. With the default layout, that is a PNG beside a test file
whose name starts with the file's stem and a dot. A test whose image has
that name would compare with it.

v-snap tells its reference images from other PNGs in two ways. Each
reference carries a hash of its pixels. And the reference path would put
an image of one of its test files there. That has these effects:

- When a test file is deleted, its images still belong to it, if the
  `include` globs would match it. So they count as unused, and a run
  outside CI deletes them.
- A template without `{testFileName}`, `{testFileStem}` or
  `{testFilePath}` can't say which file an image is for. So images can
  only be in folders that hold a test file. A run of some of the test
  files looks only at the images that no other file could own.
- The check for unused references never deletes a PNG without a hash. It
  also leaves a copy of a reference in another folder, such as `docs`, and
  the images of another `vsnap` call's tests.

## Changing Layout

To change layout, change the options, then run the visual tests once with
Vitest's `-u`. Each test writes its reference image at the new path, with
the same pixels as before. The run leaves the old files alone, since the
new layout would never put a reference there. Delete them by hand.
