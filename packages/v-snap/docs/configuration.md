# Configuration

v-snap has two config files. `vitest.config.ts` lists v-snap's projects, and
runs in Node. `vsnap.config.ts` registers the kinds of view, and runs in
the test page, as [Kinds of View](kinds-of-view.md) describes. This page
covers the first.

- [v-snap's Projects](#vsnaps-projects)
- [What the Projects Inherit](#what-the-projects-inherit)
- [Options](#options)
- [Where Files Go](#where-files-go)
- [Changing Layout](#changing-layout)
- [Checks When the Config Loads](#checks-when-the-config-loads)
- [Where a Failed Test's Images Go](#where-a-failed-tests-images-go)

## v-snap's Projects

v-snap's tests run in two Vitest projects, beside a project's unit tests.
They run in a group of their own (Vitest's `sequence.groupOrder`), after the
project's other projects. `vsnap(options)` returns the projects, which the
config lists:

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
                    exclude: [...configDefaults.exclude, '**/visual-tests/**'],
                },
            },
            ...vsnap(),
        ],
    },
});
```

The unit project has `extends: true`, so that it keeps the config's
plugins, as v-snap's projects do. The projects bring v-snap's reporter with
them, which prints the visual tests' summary and checks the reference
images. So there is nothing else to add, and a run without v-snap's
projects, such as `vitest -p unit`, prints no summary.

The unit project leaves out the visual test files, which run in v-snap's
projects instead. Vitest's default `include` matches both kinds of file. A
project also needs dev dependencies on `v-snap` and `vitest`. npm installs
v-snap's peers, Playwright and Vitest's Playwright provider, with it.

## What the Projects Inherit

v-snap's projects inherit the config that they are listed in, as Vitest's
`extends: true` does. So the views compile with the same plugins and
aliases as the rest of the project.

Vitest adds the config's own `include` and `exclude` lists to an
inheriting project's, so keep them in the unit project, as above, not in
the config's `test` block. The same goes for `setupFiles`, which would run
in v-snap's browser pages, where a setup file written for Node, or for a
simulated DOM, fails. A run stops with a message if any of them leak into
v-snap's projects.

## Options

Every option is optional.

| Option | What it sets |
| --- | --- |
| `name` | The start of the projects' names, which end in `-canvas` and `-html`. The default is `visual` |
| `root` | The folder that the other paths are relative to, and that holds `vsnap.config.ts`. The default is the folder Vitest runs in. A run whose Vitest root is elsewhere, such as with `vitest --root`, stops and asks for it, such as `root: import.meta.dirname` |
| `include` | Globs for the test files. See [Where Files Go](#where-files-go) |
| `exclude` | Globs for files that `include` matches but that aren't visual test files, such as fixtures. The default is none |
| `referencePath` | Where each reference image is kept. See [Where Files Go](#where-files-go) |
| `maxPixels` | The size budget, which is the most pixels an image may have. A smooth view over the budget is downsampled to fit: drawn at half its size, a quarter, and so on, so that detail finer than an image pixel is averaged away. The run's summary lists them as downsampled references, with their scales. Pixel art and HTML are drawn at full size, so they fail when over the budget. The default, `DEFAULT_MAX_PIXELS`, is 500,000 |
| `viteConfig` | A Vite config for v-snap's projects to extend, in place of the config they are listed in. A monorepo whose views need a package's own Vite config names it here |
| `vsnapConfig` | The project's `vsnap.config.ts`, which runs in the test page. The default is `vsnap.config.ts` in the root, if there is one. Naming it shows a reader of `vitest.config.ts` where the rest of v-snap's settings are |

A monorepo can call `v-snap` once for each package that has visual tests,
with its own `root` and `name`, and list all their projects in one config.
Two calls can also share a root, with `include` globs that don't overlap.
A test file that the globs of two calls match stops the run.

## Where Files Go

Two options say where a project keeps its visual test files and their
reference images. Both are relative to the root.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['**/visual-tests/*.test.{ts,tsx}']`.
- **`referencePath`** is a template for each reference image's path. Its
  variables are `{testFileDir}`, `{testFileName}`, `{testFileStem}` (the
  name without `.test` or `.spec` and its extension), `{testFilePath}` and
  `{imageName}`. The default, `DEFAULT_REFERENCE_PATH`, is
  `'{testFileDir}/{testFileStem}.{imageName}.png'`.

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
"explorer.fileNesting.patterns": { "*.test.tsx": "${capture}.*.png", "*.test.ts": "${capture}.*.png" }
```

`{imageName}` must appear once, in the file name, and the file name must
end in `.png`. A template that breaks these rules stops the run when the
config loads. Two other layouts are common.

```ts
// Tests beside their views, with each test file's reference images in a
// folder of their own:
//   src/hud/hud-view.visual.test.tsx
//   src/hud/__references__/hud-view.visual.test.tsx/at-the-start.png
vsnap({
    include: ['**/*.visual.test.{ts,tsx}'],
    referencePath: '{testFileDir}/__references__/{testFileName}/{imageName}.png',
});

// Every reference image in one folder, which mirrors the source tree:
//   visual-references/src/hud/visual-tests/hud-view.test.tsx/at-the-start.png
vsnap({ referencePath: 'visual-references/{testFilePath}/{imageName}.png' });
```

The unit project must leave out a layout's test files. For the default
layout, that is `'**/visual-tests/**'` in its `exclude`, and for the first
layout above, `'**/*.visual.test.{ts,tsx}'`. Also, any other PNG whose name
starts with a test file's stem and a dot, beside the test file, would match
the reference path, and the check of every reference image would report
it. Keep such files elsewhere, or name them otherwise.

The package tells its reference images from other PNGs by the hash that
each one carries, and by where its reference path would put an image of
one of its test files. A file that the `include` globs match owns its
images even once it is deleted, so they are reported as unused. A template
without `{testFileName}`, `{testFileStem}` or `{testFilePath}` can't say
which file an image is for, so only the folders that hold a test file have
images, and a run of some test files checks only the images that are
theirs alone. So the check for references that no test uses never deletes
a PNG without a hash, a copy of a reference in another folder such as
`docs`, or the images of another `vsnap` call's tests.

## Changing Layout

To change layout, change the options, then run the visual tests with
Vitest's `-u` once. Each test writes its reference image at the new path,
with the same pixels as before. The old files are at paths that the new
layout doesn't give, so the run leaves them, and they can be deleted by
hand.

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
