# Releasing the libraries

The four libraries, `@mvtjs/utils`, `@mvtjs/pixi`, `@mvtjs/three` and
`@mvtjs/html`, are released together from this repo with
[Changesets](https://github.com/changesets/changesets). They share one
version: a change to any of them releases all four.

v-snap, the visual testing package, is released from here too, on a
version of its own. A change file for it names `v-snap` alone.

Each `.md` file here, other than this one, is a change waiting to be released:
how big a bump it needs, and a line for the changelogs.

## Day to day

Nothing is required per commit. When a change deserves a changelog line,
`npx changeset` asks for the bump and a one-line summary, and writes a file
here to commit with the change. The summary can also wait until release time.

## To release

1. `npx changeset`, if no change files are waiting.
2. `npm run release`: bumps every library to the new version, updates the
   ranges between them, writes each `CHANGELOG.md`, deletes the used change
   files, and updates `package-lock.json`.
3. Commit, and push to `main`.

The `release` workflow (`.github/workflows/release.yml`) then builds and
tests, and publishes any version not yet on npm, through npm's trusted
publishing, with provenance. It pushes a git tag for each package published.
On a push with no new version, it publishes nothing.

## The first release

npm can only trust a workflow to publish a package that already exists, so
each library's first version, 0.1.0, is published by hand, once:

1. `npm login`, as an owner of the `@mvtjs` npm organisation.
2. `npm run build:packages`, then `npx changeset publish`. It asks for a 2FA
   code, publishes the four libraries, and tags each version.
3. `git push --follow-tags`.
4. On npmjs.com, for each package: Settings, Trusted publishing, GitHub
   Actions, repository `yortus/mvt-games`, workflow `release.yml`.

From then on, releases go through the workflow.

v-snap's first version on npm, 0.0.0, is a placeholder that was published
by hand, so the package already exists. Its trusted publishing is set the
same way (step 4), and its first real version, 0.1.0, goes through the
workflow. Once that is out, the placeholder is deprecated:
`npm deprecate v-snap@"<0.1.0" "A placeholder. Use 0.1.0 or later."`
