# Running the Tests

Visual tests run with Vitest's own commands. This page lists them, says
what every run checks, and covers failed images, CI and watch mode.

- [Commands](#commands)
- [Checks of the Reference Images](#checks-of-the-reference-images)
- [The Summary](#the-summary)
- [Reviewing a Failed Image](#reviewing-a-failed-image)
- [In CI](#in-ci)
- [Watch Mode](#watch-mode)

## Commands

Vitest's `-p` (`--project`) filter picks the unit tests or the visual
tests alone, and only a run that includes vsnap's projects starts a
browser.

| Command | What it does |
| --- | --- |
| `vitest run` | Runs every test, unit and visual. Each actual image is compared with its reference image. A new image is written as its reference, except in CI |
| `vitest run -p unit` | Runs the unit tests alone. No browser starts |
| `vitest run -p "visual-*"` | Runs the visual tests alone |
| `vitest run -u` | Also writes each new or changed actual image as its reference image, as `-u` does for snapshots |
| `vitest run <file> -u` | Updates the reference images of one test file. A failure message gives this command |
| `vitest -p "visual-*"` | Watches the visual tests, and reruns a test file when it or its view changes. See [Watch Mode](#watch-mode) |
| `vitest run -p "visual-*" --sequence.shuffle` | Runs the visual tests in a random order, which finds any test that depends on the ones before it. Vitest prints the order's seed, and adding `--sequence.seed=<seed>` repeats that order |

## Checks of the Reference Images

Every run of the visual tests also checks the reference images, in two
ways, after the tests:

- **Each reference's pixels match the hash it carries.** A run compares
  only the hashes, so this catches a reference whose pixels were edited
  without its hash. A reference that passed before, unchanged since, isn't
  decoded again.
- **Every reference is used by a test.** Renamed and deleted tests leave
  references behind. Without `-u`, the run lists them and fails. With `-u`,
  it deletes them. A test that didn't run, because `.skip`, `.only`, `.todo`
  or `-t` left it out, still uses its reference.

A run of every visual test file checks every reference, those of deleted
test files too. A run of some of them, such as a shard (`--shard`), a run
of one file, or a rerun in watch mode, checks the references of the files
that ran, and its summary says so. A check that fails prints what it found
under a heading of its own, after the summary, and the run exits with
code 1. In GitHub Actions, it also adds an error annotation.

## The Summary

After Vitest's own summary, vsnap prints its own. A table counts the
images by outcome, gives each kind of test's median and 95th percentile
times, and the references' count and size. Then come the slowest tests,
the largest references, and any references that were drawn smaller to fit
the size budget (`maxPixels`, in [Configuration](configuration.md#options)).
In GitHub Actions, the summary also goes to the job's summary page.

## Reviewing a Failed Image

A test whose image changed fails with a message that names its files: the
reference, the actual image in `.vitest/vsnap/`, and, for an image that
kept its size, a diff, which shows the reference dimmed and the pixels that
changed in red. The message ends with the command that accepts the change,
`vitest run <file> -u`. The files of a test that passes again are deleted.

The Vitest UI shows them side by side. Install `@vitest/ui`, at the same
version as Vitest, run `vitest --ui`, and open the failed test. Its Visual
Regression panel shows the diff, the reference, the actual image, and a
slider between the reference and the actual image. Look at each change
there before accepting it.

## In CI

In CI, Vitest writes no new snapshots, so a test whose image is new fails,
as does one whose image changed. Run the visual tests as any other Vitest
run, and keep Playwright's browser between runs, so that it isn't
downloaded each time. In GitHub Actions:

```yaml
- run: npm ci
- name: Where Playwright keeps its browser
  id: playwright
  run: |
      echo "PLAYWRIGHT_BROWSERS_PATH=$RUNNER_TEMP/ms-playwright" >> "$GITHUB_ENV"
      echo "version=$(node -p 'require("playwright/package.json").version')" >> "$GITHUB_OUTPUT"
- uses: actions/cache@v4
  with:
      path: ${{ runner.temp }}/ms-playwright
      key: playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.version }}
- run: npx playwright install chromium-headless-shell
- run: npx vitest run
```

GitHub's runners already have the libraries that the browser needs. A
bare Linux image also needs `npx playwright install-deps chromium`. A
failed test's actual and diff images are in `.vitest/vsnap/`, which a step
can upload for the reviewer.

## Watch Mode

In watch mode, Vitest reruns a test file when the file changes, or when a
module that it imports changes, such as its view. A change to
`vsnap.config.ts` reruns the tests with the new config.

A new or deleted test file restarts Vitest, since each project gets its
test files when the config loads, and the restart sends a new file to its
kind of page. The browser starts again, which takes a few seconds. A new
file that declares no test yet, such as an empty one, gets a warning, and
restarts Vitest once its first test is written.

An editor's test explorer, such as the one that the Vitest extension adds
to VS Code, reads the projects' test files when it starts. It doesn't see
a new visual test file until it reads them again: press its refresh
button.
