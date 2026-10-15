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
tests alone, and only a run that includes v-snap's projects starts a
browser.

| Command | What it does |
| --- | --- |
| `vitest run` | Runs every test, unit and visual. Each actual image is compared with its reference image. Except in CI, a new image is written as its reference, and a reference that no test uses any more is deleted |
| `vitest run -p unit` | Runs the unit tests alone. No browser starts |
| `vitest run -p "visual-*"` | Runs the visual tests alone |
| `vitest run -u` | Also writes each new or changed actual image as its reference image, as `-u` does for snapshots. It also repairs references: it renames one whose name differs from its test's only in case, and rewrites one whose pixels don't match its hash. On arm64 processors, it leaves the reference of an image within the tolerance as it is |
| `vitest run <file> -t "^<test's name>$" -u` | Updates one test's reference image. A failure message gives this command |
| `vitest run <file> -u` | Updates the reference images of one test file |
| `vitest -p "visual-*"` | Watches the visual tests, and reruns a test file when it or its view changes. See [Watch Mode](#watch-mode) |
| `vitest run -p "visual-*" --sequence.shuffle` | Runs the visual tests in a random order, which finds any test that depends on the ones before it. Vitest prints the order's seed, and adding `--sequence.seed=<seed>` repeats that order |

## Checks of the Reference Images

Every run of the visual tests also checks the reference images. Most of
the checks fail a test, so they show wherever a failed test does: in
Vitest's summary, the Vitest UI, an editor and every reporter.

- **Each reference's pixels match the hash it carries.** A run compares
  hashes first, so a reference whose pixels were edited, or that lost its
  hash, such as to an image optimiser, would otherwise pass unnoticed. Its
  test fails, unless its pixels match the test's image exactly and the run
  writes references, in which case the run adds the hash. A reference is
  checked again only once it changes.
- **No two tests of a file share a reference.** Test names that differ
  only in punctuation or case give one image name. The second test fails.

One check is about the run, not a test:

- **Every reference is used by a test.** Renamed and deleted tests leave
  references behind. Outside CI, and with `-u`, the run deletes them, as it
  writes new references, so a renamed test leaves nothing behind. In CI,
  the run lists them and fails. A test that didn't run, because `.skip`,
  `.only`, `.todo` or `-t` left it out, still uses its reference. Tests in
  two files that share a reference, which only a reference path without the
  test file's stem allows, also fail the run.

A run of every visual test file covers every reference, those of deleted
test files too. A run of some of them, such as a shard (`--shard`), a run
of one file, or a rerun in watch mode, covers the references of the files
that ran, and its summary says so.

A run-level check that fails does three things:

- It prints what it found under a heading of its own, after the summary.
- It makes the run exit with code 1.
- In GitHub Actions, it adds an error annotation.

It isn't a test, so Vitest's own summary, the Vitest UI and Vitest's other
reporters, such as JUnit's, don't show it, as they don't show a coverage
threshold that failed. Since a local run deletes unused references, this
mostly happens in CI, when a change was pushed without running the visual
tests.

A sharded run never runs every visual test file, so it never finds the
references of deleted test files. The visual tests are quick, so CI can
run them in a job of their own, unsharded, as
`vitest run -p "visual-*"`, and shard the rest.

## The Summary

After Vitest's own summary, v-snap prints its own. A table counts the
images by outcome, gives each kind of test's median and 95th percentile
times, and the references' count and size. Then come the slowest tests,
the largest references, and any references that were drawn smaller to fit
the size budget (`maxPixels`, in [Configuration](configuration.md#options)).
In GitHub Actions, the summary also goes to the job's summary page.

## Reviewing a Failed Image

A test whose image changed fails with a message that names its files: the
reference, the actual image in `.vitest/vsnap/`, and, for an image that
kept its size, a diff. The diff shows the reference dimmed, the pixels that
changed by more than the tolerance in red, and those that changed by less
in dark yellow. The message ends with the command that accepts this image
alone, `vitest run <file> -t "^<test's name>$" -u`, which picks the test by
its full name. A name with a character that a shell would change in double
quotes, such as `$` or `"`, gets `vitest run <file> -u` instead, which
accepts every changed image in the file. The files of a test that passes
again are deleted.

The visual tests run only in a headless browser. A headed one, as with
`--browser.headless=false`, draws differently, so v-snap stops such a run
before any test. To look at an image, open it in `.vitest/vsnap/`, or the
failed test in the Vitest UI.

The Vitest UI shows them side by side. Install `@vitest/ui`, at the same
version as Vitest, run `vitest --ui`, and open the failed test. Its Visual
Regression panel shows the diff, the reference, the actual image, and a
slider between the reference and the actual image. Look at each change
there before accepting it.

v-snap fills the panel as Vitest's own
`toMatchScreenshot` does, in a way that Vitest's documentation doesn't
promise, so a later version of Vitest may show it differently. The tests'
results don't depend on it.

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
can upload for the reviewer. A repository that keeps its references in Git
LFS checks them out with `lfs: true` in `actions/checkout`. Without it,
each reference is a pointer file, and each test fails and says so.

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
