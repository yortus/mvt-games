# Getting Started

This page says what v-snap needs, and how to add it to a project that
already uses Vitest. The [README](../README.md) has the short version.

- [Requirements](#requirements)
- [Playwright Versions](#playwright-versions)
- [Adding v-snap to a Project](#adding-v-snap-to-a-project)
- [An Example](#an-example)
- [Your First Test](#your-first-test)

## Requirements

- **Vitest 5.** v-snap runs on Vitest's browser mode, so visual tests are
  Vitest tests. They use Vitest's `describe`, `beforeAll` and the rest of
  its test API. A project's unit tests can use any test runner.
- **Views that Vite can compile.** Vitest compiles the tests, and the views
  that they import, with Vite. A project that builds with Vite points the
  `viteConfig` option at its config. A project that builds with something
  else needs a small Vite config, with the aliases and plugins that its
  views rely on.
- **Playwright 1.64, any patch release,** and Vitest's Playwright
  provider, `@vitest/browser-playwright`, at the same version as `vitest`.
  They are peer dependencies, which npm installs with v-snap. The project
  must have only one copy of Playwright. v-snap installs the browser that
  that copy launches, and that browser draws every image.
  [Playwright Versions](#playwright-versions) says how v-snap follows
  Playwright's releases.
- **The browser,** Playwright's Chrome Headless Shell (about 100 MB). The
  first run downloads it into Playwright's cache. A bare Linux system also
  needs the libraries that the browser uses, which
  `npx playwright install-deps chromium` installs.
  [In CI](running-tests.md#in-ci) shows how to keep the browser between
  runs.
- **Node 22.17 or later,** where Node's file globbing is stable.
- **No renderer library.** A canvas test can draw with the browser's own
  canvas, and needs no library. v-snap's support for Pixi and three.js views
  draws with the project's own copy of `pixi.js` (8.16 or later) or
  `three` (0.160 or later), so a project that uses it installs only the
  library its views use.

## Playwright Versions

Chromium draws every image, so the build of Chromium decides every pixel.
A new build can draw the same view a little differently. A change to its
2D graphics library, or to SwiftShader, which runs its WebGL, can shift an
antialiased edge or a gradient by a few levels. Nobody would see the
difference, but the pixels change, so every reference made with the old
build could fail. The images are the same on every machine only because
every machine draws them with the same build.

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
  So if a patch release ever changed the build, the run would stop, rather
  than change the images.
- A project that also uses Playwright for other tests uses the same version
  for both, so it moves to a new minor version when v-snap does.

## Adding v-snap to a Project

v-snap's tests run in two Vitest projects of their own, beside the
project's unit tests. Most projects that already use Vitest have one flat
config, with no projects. `withVsnap()` adds v-snap's projects to it, so
the config keeps its shape.

1. Install `v-snap` as a dev dependency, beside `vitest`. npm also installs
   `playwright` and `@vitest/browser-playwright`, which v-snap needs. A
   package manager that doesn't install peer dependencies needs them
   installed too.
2. Wrap the config in `withVsnap()`, from `v-snap/vitest`, inside
   `defineConfig`, as [An Example](#an-example) shows.
3. Create `vsnap.config.ts` beside `vitest.config.ts`, as
   [Kinds of View](kinds-of-view.md) shows, with the kinds of view that the
   tests pose and the `Register` declaration. Add it to `tsconfig.json`'s
   `include`.
4. Add `.vitest/` to `.gitignore`. v-snap writes a failed test's images
   there.
5. Write a test, and run `vitest`, as [Your First Test](#your-first-test)
   shows.

## An Example

This flat config:

```ts
export default defineConfig({
    plugins: [react()],
    test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
});
```

becomes:

```ts
import { defineConfig } from 'vitest/config';
import { withVsnap } from 'v-snap/vitest';

export default defineConfig(withVsnap({
    plugins: [react()],
    test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
}));
```

`withVsnap()` does three things to the config:

- It moves the unit tests' settings, such as `environment` and
  `setupFiles`, into a project named `unit`, which leaves out the visual
  test files.
- It adds v-snap's projects after it.
- It leaves the rest where it is. That includes settings for the whole
  run, such as `reporters` and `coverage`, and Vite's settings, such as
  `plugins`, which v-snap's projects inherit.

`vitest -p unit` runs the unit tests alone, and `vitest -p "visual-*"` runs
the visual tests alone. v-snap's own options go in the config, under a
`vsnap` key, such as `vsnap: { root: import.meta.dirname }`.
[Configuration](configuration.md#options) lists them.

A project whose views are drawn with Pixi has this `vsnap.config.ts`
beside it:

```ts
import { defineVsnapConfig } from 'v-snap';
import { pixiViews } from 'v-snap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// Gives canvasTest's types the kinds of view above, and the default kind.
declare module 'v-snap' {
    interface Register {
        config: typeof config;
    }
}

export default config;
```

A config can also list v-snap's projects itself, with `...vsnap()`, as
[Configuration](configuration.md#v-snaps-projects) shows. A project might
do that to see every project in its config. Written that way, the example
above becomes this, which is what `withVsnap()` makes of it:

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    setupFiles: ['./test-setup.ts'],
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

The unit project has `extends: true`, so that it keeps the plugins, as
v-snap's projects do. [Configuration](configuration.md) explains why the
`include`, `exclude` and `setupFiles` settings must stay in the unit
project.

## Your First Test

Write a test in a `visual-tests` folder beside its view, such as
`src/hud/visual-tests/hud-view.test.tsx` for `src/hud/hud-view.tsx`:

```tsx
import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
```

Then run `vitest`. The first run downloads the browser. The test's image
is new, so v-snap writes it as the test's reference image, beside the test
file, as `hud-view.at-the-start.png`. Look at it, and commit it with the
test. From then on, each run compares the test's image with it.

[Writing Tests](writing-tests.md) covers the rest: tests of views that
change over time, options, tables of cases, and HTML views.
