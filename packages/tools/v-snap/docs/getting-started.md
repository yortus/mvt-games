# Getting Started

This page covers what you need to run v-snap, and how to add it to a
project that already uses Vitest. The [README](../README.md) has the short
version.

- [Requirements](#requirements)
- [Playwright Versions](#playwright-versions)
- [Adding v-snap to a Project](#adding-v-snap-to-a-project)
- [An Example](#an-example)
- [Your First Test](#your-first-test)

## Requirements

- **Vitest 5.** v-snap runs on Vitest's browser mode, so your visual tests
  are Vitest tests. They use Vitest's `describe`, `beforeAll` and the rest
  of its test API. Your unit tests can use another test runner. If they
  do, list v-snap's tests with `vsnapProjects()` instead of using the
  `vsnap()` plugin, and give the config nothing else to test. Otherwise,
  Vitest would run the other runner's test files too.
  [Configuration](configuration.md#listing-v-snaps-projects) shows
  `vsnapProjects()`.
- **Views that Vite can compile.** Vitest compiles the tests, and the
  views that they import, with Vite. v-snap's tests inherit your Vitest
  config, plugins included. So if your unit tests can compile your views,
  so can the visual tests. If your views need a Vite config that your
  Vitest config doesn't include, point v-snap's `viteConfig` option at it.
  If you build with something else, write a small Vite config with the
  aliases and plugins that your views rely on.
- **Playwright 1.64, any patch release,** and Vitest's Playwright
  provider, `@vitest/browser-playwright`, at the same version as `vitest`.
  The provider is the package that lets Vitest drive Playwright's browser.
  They're peer dependencies, so npm installs them along with v-snap. Make
  sure that your project has only one copy of Playwright
  (`npm ls playwright` lists them). v-snap installs the browser that this
  copy launches, and that browser draws every image. A second copy could
  launch a different browser, which would draw different images.
  [Playwright Versions](#playwright-versions) says how v-snap follows
  Playwright's releases.
- **The browser.** v-snap draws in Playwright's Chrome Headless Shell, a
  small build of Chromium that runs without a window (about 100 MB). The
  first run downloads it into Playwright's cache. On a minimal Linux
  system, such as a slim container image, the browser also needs some
  system libraries. `npx playwright install-deps chromium` installs them.
  [In CI](running-tests.md#in-ci) shows how to keep the browser between
  runs, so that CI doesn't download it every time.
- **Node 22.17 or later.** v-snap finds files with Node's built-in
  `fs.globSync`, which became stable in Node 22.17.
- **No renderer library.** A canvas test can draw with the browser's own
  canvas, so it needs no library. v-snap's support for Pixi and three.js
  views draws with your own copy of `pixi.js` (8.16 or later) or `three`
  (0.160 or later). So you install only the library that your views use.

## Playwright Versions

Chromium draws every image, so the build of Chromium decides every pixel.
A new build can draw the same view a little differently. A change to its
2D graphics library, or to SwiftShader, the software renderer that runs
its WebGL, can shift an antialiased edge or a gradient by a few levels.
Nobody would see the difference, but the pixels change, so every
reference made with the old build could fail. The images are the same on
every machine only because every machine draws them with the same build.

Each version of Playwright names one build of Chromium. Playwright moves
to a new build in its minor versions, such as 1.64 to 1.65. Its patch
releases, such as 1.64.1, fix Playwright itself, and keep the build. So
the browser changes with Playwright's minor version, and v-snap follows
Playwright one minor version at a time.

- Each release of v-snap supports one minor version of Playwright, such as
  1.64, with its patch releases.
- When Playwright releases a new minor version, v-snap follows it with a
  release of its own, checked against the new build.
- Each run checks the browser's fingerprint, which names its exact build.
  So if a patch release ever changed the build, the run would stop and
  tell you, rather than quietly change the images.
- If you also use Playwright for other tests, they share v-snap's version.
  So you move them to a new minor version when v-snap moves.

## Adding v-snap to a Project

v-snap's tests are Vitest tests, so `vitest` runs them together with your
unit tests. They run in two Vitest projects of their own. A Vitest project
is a group of test files with its own settings, so the visual tests can
run in a browser while your unit tests stay in Node. The `vsnap()` plugin
adds these projects when Vitest starts, so you don't need to restructure
your config.

1. Install `v-snap` as a dev dependency, beside `vitest`. npm also
   installs `playwright` and `@vitest/browser-playwright`, which v-snap
   needs. If your package manager doesn't install peer dependencies,
   install them yourself.
2. Add `vsnap()`, from `v-snap/vitest`, to your config's `plugins`, as
   [An Example](#an-example) shows.
3. Create `vsnap.config.ts` beside `vitest.config.ts`, and add it to
   `tsconfig.json`'s `include`. It lists the kinds of view that your tests
   use, such as Pixi containers. A kind of view tells v-snap how to
   recognise a view and how to draw it. The file also has a `Register`
   declaration, which tells TypeScript about those kinds.
   [Kinds of View](kinds-of-view.md) explains both.
4. Add `.vitest/` to `.gitignore`. That's where v-snap writes a failed
   test's images, for you to look at, and they don't belong in the
   repository.
5. Write a test, and run `npx vitest`, as
   [Your First Test](#your-first-test) shows.

## An Example

Here's a flat config, which is a config with no `test.projects` list:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
});
```

With v-snap added, it becomes:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { vsnap } from 'v-snap/vitest';

export default defineConfig({
    plugins: [react(), vsnap()],
    test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
});
```

When Vitest starts, the plugin adds v-snap's projects to the run. They
inherit your config, so your views compile with the same plugins. But the
unit tests' own settings, such as `environment` and `setupFiles`, stay
with the unit tests. A setup file written for Node or jsdom would fail in
the browser, so v-snap's projects leave it out. The plugin also leaves the
visual test files out of your unit tests. And it names the unit tests
`unit`, unless your config already names them.

`npx vitest` runs every test, and `npx vitest -p unit` runs the unit tests
alone. To run only the visual tests, give Vitest part of their paths. With
v-snap's default `include`, which finds them in `visual-tests` folders,
that's `npx vitest visual-tests/`. When the plugin adds v-snap's projects,
Vitest's `-p` filter can't pick them by name.
[Configuration](configuration.md#v-snaps-projects) explains why.

You pass v-snap's own options to the plugin, such as
`vsnap({ viewport: { width: 960, height: 600 } })`.
[Configuration](configuration.md#options) lists them.

If your views are drawn with Pixi, the `vsnap.config.ts` beside your
Vitest config looks like this:

```ts
import { defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// Tells TypeScript about the kinds of view above, so that canvasTest
// accepts tests of those kinds and checks their options. It also lets a
// test leave out its kind, to use the default kind.
declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

If your config lists its projects itself, as a monorepo's often does, you
can list v-snap's projects with `...vsnapProjects()` instead.
[Configuration](configuration.md#listing-v-snaps-projects) shows how.
Then you can pick the visual tests by name, such as with
`npx vitest -p "visual-*"`.

## Your First Test

Write a test in a `visual-tests` folder beside its view. For example, the
tests of `src/hud/hud-view.tsx` go in
`src/hud/visual-tests/hud-view.test.tsx`:

```tsx
import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
```

The test has a name, `'at the start'`, and a pose. A pose is the function
in each test that builds the view and returns it. Here, it builds the
score display as it looks at the start of a game.

Then run `npx vitest`. The first run downloads the browser. The test's
image is new, so v-snap writes it as the test's reference image, beside
the test file, as `hud-view.at-the-start.png`. Look at it to check that it
shows what you expect, and commit it with the test. From then on, each run
compares the test's new image with that reference.

[Writing Tests](writing-tests.md) covers the rest, such as tests of views
that change over time, options, tables of cases, and HTML views.
