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
tests alone. Only a run that includes v-snap's projects starts a browser.

| Command | What it does |
| --- | --- |
| `vitest run` | Runs every test, unit and visual. Each actual image is compared with its reference image. Except in CI, a new image is written as its reference, and a reference that no test uses any more is deleted, if git tracks it |
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

- **Each reference's pixels match the hash that it carries.** A run
  compares hashes first. So a reference whose pixels were edited, or that
  lost its hash, such as to an image optimiser, could otherwise pass
  unnoticed. Its test fails instead. If the run writes references and the
  pixels match the test's image exactly, the run adds the hash, and the
  test passes. A reference is checked again only once it changes.
- **No two tests of a file share a reference.** Test names that differ
  only in punctuation or case give one image name. The second test fails.

One check is about the run, not a test:

- **Every reference is used by a test.** Renamed and deleted tests leave
  references behind. Outside CI, and with `-u`, the run deletes them as it
  writes new references, so a renamed test leaves nothing behind. In CI,
  the run lists them and fails. A test that didn't run still uses its
  reference, such as one that `.skip`, `.only`, `.todo` or `-t` left out.
  The run also fails if tests in two files share a reference, which only a
  reference path without the test file's stem allows.

A run deletes only what git can bring back, so it deletes only the unused
references that git tracks, those staged but not committed included. It
keeps the others, and its summary lists them as unused references, with
the reason:

- **A reference that git doesn't track,** such as a new one that was
  never added, is kept, since its deletion couldn't be undone. Delete it by
  hand, or add it to git, and the next run deletes it.
- **Every unused reference is kept if git can't say** which files it
  tracks, such as outside a git repository.
- **A rerun in watch mode keeps them all,** since it follows each save,
  and a test may be commented out for only a moment. The first run in
  watch mode deletes them, and so does a rerun that updates references,
  as when `u` is pressed.

A run of every visual test file covers every reference, those of deleted
test files too. A run of some of them, such as a shard (`--shard`), a run
of one file, or a rerun in watch mode, covers the references of the files
that ran, and its summary says so.

A run-level check that fails does three things:

- It prints what it found under a heading of its own, after the summary.
- It makes the run exit with code 1.
- In GitHub Actions, it adds an error annotation.

Such a check isn't a test. So Vitest's own summary, the Vitest UI and
Vitest's other reporters, such as JUnit's, don't show it, just as they
don't show a coverage threshold that failed. A local run deletes unused
references, so this mostly happens in CI, when a change was pushed without
running the visual tests.

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

A test whose image changed fails with a message that names its files.
They are the reference, the actual image in `.vitest/vsnap/`, and a diff,
if the image kept its size. The diff shows the reference dimmed, the
pixels that changed by more than the tolerance in red, and those that
changed by less in dark yellow.

The message ends with a command that accepts this image alone, if the
change was meant: `vitest run <file> -t "^<test's name>$" -u`. It picks the
test by its full name. A shell would change some characters in double
quotes, such as `$` and `"`. For a name with one of those, the message
gives `vitest run <file> -u` instead, which accepts every changed image in
the file. When a test passes again, its files in `.vitest/vsnap/` are
deleted.

The Vitest UI shows the three images side by side. Install `@vitest/ui`,
at the same version as Vitest, run `vitest --ui`, and open the failed
test. Its Visual Regression panel shows the diff, the reference and the
actual image, with a slider between the reference and the actual image.
Look at each change there before accepting it.

v-snap fills the panel in the same way as Vitest's own `toMatchScreenshot`.
Vitest's documentation doesn't promise that way, so a later version of
Vitest may show it differently. The tests' results don't depend on it.

The visual tests run only in a headless browser. A headed one, as with
`--browser.headless=false`, draws differently, so v-snap stops such a run
before any test. To look at a view, open its actual image in
`.vitest/vsnap/`, or the failed test in the Vitest UI.

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
      echo "PLAYWRIGHT_BROWSERS_PATH=$RUNNER_TEMP/ms-playwright" \
          >> "$GITHUB_ENV"
      version=$(node -p 'require("playwright/package.json").version')
      echo "key=playwright-$RUNNER_OS-$RUNNER_ARCH-$version" \
          >> "$GITHUB_OUTPUT"
- uses: actions/cache@v4
  with:
      path: ${{ runner.temp }}/ms-playwright
      key: ${{ steps.playwright.outputs.key }}
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
`vsnap.config.ts` reruns the tests with the new config. A rerun deletes no
unused references, unless it updates references, as
[Checks of the Reference Images](#checks-of-the-reference-images) says.

A new or deleted test file restarts Vitest, since each project gets its
test files when the config loads, and the restart sends a new file to its
kind of page. The browser starts again, which takes a few seconds. A new
file that declares no test yet, such as an empty one, gets a warning, and
restarts Vitest once its first test is written.

An editor's test explorer, such as the one that the Vitest extension adds
to VS Code, reads the projects' test files when it starts. It doesn't see
a new visual test file until it reads them again: press its refresh
button.
