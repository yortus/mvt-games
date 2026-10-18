# Running the Tests

You run visual tests with Vitest's own commands. This page lists them,
explains what every run checks, and covers failed images, CI and watch
mode.

- [Commands](#commands)
- [Checks of the Reference Images](#checks-of-the-reference-images)
- [The Summary](#the-summary)
- [Reviewing a Failed Image](#reviewing-a-failed-image)
- [In CI](#in-ci)
- [Watch Mode](#watch-mode)

## Commands

You can run every test, or only the unit tests or the visual tests.
Vitest's `-p` (`--project`) filter picks the unit tests. To pick the
visual tests, give Vitest part of their paths. In the commands below,
`<path>` is a part of the paths that all your visual test files share.
With v-snap's default `include`, which finds them in `visual-tests`
folders, that's `visual-tests/`.
[Configuration](configuration.md#v-snaps-projects) explains how filtering
by path works. A browser starts only when v-snap's projects run.

| Command | What it does |
| --- | --- |
| `vitest run` | Runs every test, unit and visual. Each actual image is compared with its reference image. Outside CI, a new image is written as its reference, and a reference that no test uses any more is deleted, if git tracks it |
| `vitest run -p unit` | Runs the unit tests alone, and no browser starts. The `vsnap()` plugin names a flat config's tests `unit`. In a config that lists its projects, use your unit project's own name |
| `vitest run <path>` | Runs the visual tests alone |
| `vitest run -u` | Also writes each new or changed actual image as its reference image, as `-u` does for snapshots. It repairs references too. It renames a reference whose name differs from its test's only in case, and rewrites one whose pixels don't match its hash. On arm64 processors, it leaves a reference alone if the actual image is within the tolerance |
| `vitest run <file> -t "^<test's name>$" -u` | Updates one test's reference image. A failure message gives you this command |
| `vitest run <file> -u` | Updates the reference images of one test file |
| `vitest <path>` | Watches the visual tests, and reruns a test file when it or its view changes. See [Watch Mode](#watch-mode) |
| `vitest run <path> --sequence.shuffle` | Runs the visual tests in a random order. This finds any test that depends on the ones before it. Vitest prints the order's seed, and adding `--sequence.seed=<seed>` repeats that order |

If you list v-snap's projects yourself, with `vsnapProjects()`, you can
also pick them by name, such as `vitest run -p "visual-*"`. With the
`vsnap()` plugin, you can't. The plugin adds v-snap's projects from inside
your config's own projects, so a filter that leaves those out leaves out
v-snap's projects too, and the run stops.
[Configuration](configuration.md#v-snaps-projects) explains why.

## Checks of the Reference Images

Every run of the visual tests also checks your reference images. Most of
the checks fail a test, so you see them wherever you see a failed test:
in Vitest's summary, the Vitest UI, your editor and every reporter.

- **Each reference's pixels match the hash that it carries.** To save
  time, v-snap compares the actual image's hash with the reference's hash
  before it looks at any pixels. So if someone edited a reference's
  pixels, or a tool such as an image optimiser stripped its hash, a
  mismatch could slip through. Instead, its test fails. If the run writes
  references, and the pixels match the test's image exactly, the run adds
  the hash back, and the test passes. A reference is checked again only
  after it changes.
- **No two tests of a file share a reference.** Test names that differ
  only in punctuation or case give the same image name. So the second
  test fails.

One check is about the whole run, not a single test:

- **Every reference is used by a test.** When you rename or delete a
  test, its reference stays behind. Outside CI, and with `-u`, the run
  deletes such references as it writes new ones, so a renamed test leaves
  nothing behind. In CI, the run lists them and fails. A test that didn't
  run still uses its reference, such as one that `.skip`, `.only`,
  `.todo` or `-t` left out. The run also fails if tests in two files
  share a reference. That can only happen with a reference path that
  doesn't name the test file.

A run deletes only what git can bring back. So it deletes only the unused
references that git tracks, including those staged but not yet committed.
It keeps the others, and its summary lists them as unused references,
with the reason:

- **A reference that git doesn't track,** such as a new one that you
  never added, is kept, since deleting it couldn't be undone. Delete it by
  hand, or add it to git, and the next run deletes it.
- **Every unused reference is kept if git can't say** which files it
  tracks, such as outside a git repository.
- **A rerun in watch mode keeps them all.** A rerun follows each save,
  and you might comment a test out for only a moment. The first run in
  watch mode deletes them, and so does a rerun that updates references,
  as when you press `u`.

A run of every visual test file covers every reference, including those
of deleted test files. A run of only some of them, such as a shard
(`--shard`), a run of one file, or a rerun in watch mode, covers only the
references of the files that ran. Its summary says so.

When a check of the whole run fails, v-snap does three things:

- It prints what it found under a heading of its own, after the summary.
- It makes the run exit with code 1.
- In GitHub Actions, it adds an error annotation.

Such a check isn't a test. So Vitest's own summary, the Vitest UI and
Vitest's other reporters, such as its JUnit reporter, don't show it. In
the same way, they don't show a coverage threshold that failed. A local
run deletes unused references, so you'll mostly see this in CI, when
someone pushed a change without running the visual tests.

A sharded run never runs every visual test file, so it never finds the
references of deleted test files. The visual tests are quick, so you can
run them unsharded in a CI job of their own, by a part of their paths as
in [Commands](#commands), and shard only the unit tests, as
`vitest run -p unit --shard=1/4` does.

## The Summary

After Vitest's own summary, v-snap prints its own. It helps you notice a
slow test or a large reference when it's added. A table counts the images
by outcome, and gives each kind of test's median and 95th percentile
times. It also shows how many references there are, and how much space
they take. Then come any references that the run added, deleted or kept
as unused, the slowest tests, and the largest references. Last come any
references that were drawn smaller to fit the size budget (`maxPixels`,
in [Configuration](configuration.md#options)).

A run of only some test files, such as a rerun in watch mode, gets a
shorter summary. It leaves out the references' count, the slowest tests
and the largest references, since it hasn't seen them all. In GitHub
Actions, the summary also goes to the job's summary page.

## Reviewing a Failed Image

When a test's image changed, the test fails with a message that names its
files. They are the reference, the actual image in `.vitest/vsnap/`, and
a diff, if the image kept its size. The diff shows the reference dimmed.
Pixels that changed by more than the tolerance are red, and those that
changed by less are dark yellow.

The message ends with a command that accepts this one image, in case you
meant the change. It's `vitest run <file> -t "^<test's name>$" -u`, which
picks the test by its full name. A shell would change some characters
inside double quotes, such as `$` and `"`. So if the test's name has one
of those, the message gives `vitest run <file> -u` instead, which accepts
every changed image in the file. Once a test passes again, v-snap deletes
its files in `.vitest/vsnap/`.

The Vitest UI shows the three images side by side, which makes a change
easy to judge. Install `@vitest/ui`, at the same version as Vitest, run
`vitest --ui`, and open the failed test. Its Visual Regression panel shows
the diff, the reference and the actual image, with a slider between the
reference and the actual image. Look at each change there before you
accept it.

v-snap fills the panel in the same way as Vitest's own
`toMatchScreenshot`. Vitest's documentation doesn't promise that this way
will keep working, so a later version of Vitest may show it differently.
Your tests' results don't depend on it.

The visual tests run only in a headless browser, which is one with no
window. A headed browser, as with `--browser.headless=false`, draws
differently, so v-snap stops such a run before any test. To look at a
view, open its actual image in `.vitest/vsnap/`, or open the failed test
in the Vitest UI.

## In CI

In CI, Vitest writes no new snapshots. So a test whose image is new
fails, just as one whose image changed does. That way, CI catches a
reference that you forgot to commit. Run the visual tests as you would
any other Vitest run. Keep Playwright's browser in a cache between runs,
so that it isn't downloaded each time. In GitHub Actions:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
      node-version: 22
      cache: npm
- run: npm ci
- name: Where Playwright keeps its browser
  id: playwright
  shell: bash
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
- uses: actions/upload-artifact@v4
  if: failure()
  with:
      name: vsnap-images
      path: .vitest/vsnap/
      if-no-files-found: ignore
```

The step that sets the browser's folder uses `shell: bash`, so it works
on Windows runners too. v-snap installs the browser itself if it's
missing, but a step of its own makes the download easy to spot in the
log. GitHub's runners already have the libraries that the browser needs.
On a bare Linux image, also run `npx playwright install-deps chromium`.

When a test fails, the last step uploads its actual and diff images from
`.vitest/vsnap/`, so that a reviewer can look at them. If your repository
keeps its references in Git LFS (Large File Storage), check them out with
`lfs: true` in `actions/checkout`. Without it, each reference is a small
pointer file instead of an image, and each test fails and says so.

## Watch Mode

In watch mode, Vitest reruns a test file when the file changes, or when a
module that it imports changes, such as its view. A change to
`vsnap.config.ts` reruns the tests with the new config. A rerun deletes
no unused references unless it updates references, as
[Checks of the Reference Images](#checks-of-the-reference-images)
explains.

Adding or deleting a test file restarts Vitest. Each project gets its
list of test files when the config loads, and canvas tests and HTML tests
run in different pages. So Vitest must restart to send a new file to the
right page. The browser starts again, which takes a few seconds. A new
file that declares no test yet, such as an empty one, gets a warning.
Vitest restarts once you write its first test.

An editor's test explorer, such as the one that the Vitest extension adds
to VS Code, reads the projects' test files when it starts. It won't see a
new visual test file until it reads them again, so press its refresh
button.
