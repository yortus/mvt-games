# Getting Started

This page says what v-snap needs, and how to add it to a project that
already uses Vitest. The [README](../README.md) has the short version.

- [Requirements](#requirements)
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
- **Playwright 1.63, any patch release,** and Vitest's Playwright
  provider, `@vitest/browser-playwright`, at the same version as `vitest`.
  They are peer dependencies, which npm installs with v-snap. v-snap and
  Vitest must use one copy of Playwright, because v-snap installs the browser
  that Vitest launches, and that browser draws every image. Each run first
  checks the browser's fingerprint, which names its exact build, so a patch
  release that changed the browser would stop the run rather than change
  the images. A newer minor version of Playwright brings a new browser, so
  it needs a new release of v-snap. A project that uses Playwright for other
  tests uses the same version for both, so it upgrades Playwright when v-snap
  does. The first run downloads the browser, Playwright's Chrome Headless
  Shell (about 100 MB), into Playwright's cache. A bare Linux system also
  needs the libraries that the browser uses, which
  `npx playwright install-deps chromium` installs.
  [In CI](running-tests.md#in-ci) shows how to keep the browser between runs.
- **Node 22.17 or later,** where Node's file globbing is stable.
- **No renderer library.** A canvas test can draw with the browser's own
  canvas, and needs no library. v-snap's support for Pixi and three.js views
  draws with the project's own copy of `pixi.js` (8.16 or later) or
  `three` (0.160 or later), so a project that uses it installs only the
  library its views use.

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

`withVsnap()` moves the unit tests' settings, such as `environment` and
`setupFiles`, into a project named `unit`, which leaves out the visual
test files, and adds v-snap's projects after it. The rest stays where it
is: settings for the whole run, such as `reporters` and `coverage`, and
Vite's settings, such as `plugins`, which v-snap's projects inherit.
`vitest -p unit` runs the unit tests alone, and `vitest -p "visual-*"` the
visual tests. v-snap's own options go in the config, under `vsnap`, such
as `vsnap: { root: import.meta.dirname }`.
[Configuration](configuration.md#options) lists them.

A config that has projects already lists v-snap's projects itself, after
its own, with `...vsnap()`, as
[Configuration](configuration.md#vsnaps-projects) shows. So does a project
that would rather see the projects in its config. `withVsnap()` turns the
example above into this:

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
                    exclude: [...configDefaults.exclude, '**/visual-tests/*.test.{ts,tsx}'],
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

And a project whose views are drawn with Pixi has this `vsnap.config.ts`:

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
