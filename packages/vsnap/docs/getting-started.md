# Getting Started

This page says what vsnap needs, and how to add it to a project that
already uses Vitest. The [README](../README.md) has the short version.

- [Requirements](#requirements)
- [Adding vsnap to a Project](#adding-vsnap-to-a-project)
- [An Example](#an-example)
- [Your First Test](#your-first-test)

## Requirements

- **Vitest 5.** vsnap runs on Vitest's browser mode, so visual tests are
  Vitest tests. They use Vitest's `describe`, `beforeAll` and the rest of
  its test API. A project's unit tests can use any test runner.
- **Views that Vite can compile.** Vitest compiles the tests, and the views
  that they import, with Vite. A project that builds with Vite points the
  `viteConfig` option at its config. A project that builds with something
  else needs a small Vite config, with the aliases and plugins that its
  views rely on.
- **Playwright 1.63, any patch release,** and Vitest's Playwright
  provider, `@vitest/browser-playwright`, at the same version as `vitest`.
  They are peer dependencies, which npm installs with vsnap. vsnap and
  Vitest must use one copy of Playwright, because vsnap installs the browser
  that Vitest launches, and that browser draws every image. Each run first
  checks the browser's fingerprint, which names its exact build, so a patch
  release that changed the browser would stop the run rather than change
  the images. A newer minor version of Playwright brings a new browser, so
  it needs a new release of vsnap. A project that uses Playwright for other
  tests uses the same version for both, so it upgrades Playwright when vsnap
  does. The first run downloads the browser, Playwright's Chrome Headless
  Shell (about 100 MB), into Playwright's cache. A bare Linux system also
  needs the libraries that the browser uses, which
  `npx playwright install-deps chromium` installs.
  [In CI](running-tests.md#in-ci) shows how to keep the browser between runs.
- **Node 22.17 or later,** where Node's file globbing is stable.
- **No renderer library.** A canvas test can draw with the browser's own
  canvas, and needs no library. vsnap's support for Pixi and three.js views
  draws with the project's own copy of `pixi.js` (8.16 or later) or
  `three` (0.160 or later), so a project that uses it installs only the
  library its views use.

## Adding vsnap to a Project

vsnap's tests run in two Vitest projects of their own, beside the
project's unit tests. Most projects that already use Vitest have one flat
config. These steps turn it into a config with projects.

1. Install `vsnap` as a dev dependency, beside `vitest`. npm also installs
   `playwright` and `@vitest/browser-playwright`, which vsnap needs. A
   package manager that doesn't install peer dependencies needs them
   installed too.
2. Move the config's `test` settings into a project named `unit`, inside
   `test.projects`. That includes `include`, `exclude`, `environment` and
   `setupFiles`. Settings for the whole run, such as `reporters` and
   `coverage`, stay in the `test` block.
3. Add `'**/visual-tests/**'` to the unit project's `exclude`, after
   `...configDefaults.exclude`. Vitest's own `include` matches the visual
   test files, which end in `.test.tsx`, and vsnap's projects run them.
4. List vsnap's projects after the unit project: `...vsnap()`.
5. Create `vsnap.config.ts` beside `vitest.config.ts`, as
   [Kinds of View](kinds-of-view.md) shows, with the kinds of view that the
   tests pose and the `Register` declaration. Add it to `tsconfig.json`'s
   `include`.
6. Add `.vitest/` to `.gitignore`. vsnap writes a failed test's images
   there.
7. Write a test, and run `vitest`, as [Your First Test](#your-first-test)
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
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'vsnap/vitest';

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
                    exclude: [...configDefaults.exclude, '**/visual-tests/**'],
                },
            },
            ...vsnap(),
        ],
    },
});
```

The unit project has `extends: true`, so that it keeps the plugins, as
vsnap's projects do. [Configuration](configuration.md) explains why the
`include`, `exclude` and `setupFiles` settings must stay in the unit
project, and lists `vsnap()`'s options.

And a project whose views are drawn with Pixi has this `vsnap.config.ts`:

```ts
import { defineVsnapConfig } from 'vsnap';
import { pixiViews } from 'vsnap/pixi';

const config = defineVsnapConfig({ views: [pixiViews()], defaultKind: 'pixi' });

// Gives canvasTest's types the kinds of view above, and the default kind.
declare module 'vsnap' {
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
import { canvasTest } from 'vsnap';
import { HudView } from '../hud-view';

canvasTest('at the start', () => HudView({ score: () => 0 }));
```

Then run `vitest`. The first run downloads the browser. The test's image
is new, so vsnap writes it as the test's reference image, beside the test
file, as `hud-view.at-the-start.png`. Look at it, and commit it with the
test. From then on, each run compares the test's image with it.

[Writing Tests](writing-tests.md) covers the rest: tests of views that
change over time, options, tables of cases, and HTML views.
