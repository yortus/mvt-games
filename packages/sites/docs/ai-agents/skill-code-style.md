# Skill: Code Style

> Load before writing or changing TypeScript in this repo. The conventions,
> and why each one exists, are in
> [Code Style](../working-in-this-repo/code-style.md). This file is the
> checklist to work through, and what must pass before you hand over.

---

## Before You Write

Read [Code Style](../working-in-this-repo/code-style.md) if you haven't
this session. Its [Quick Reference](../working-in-this-repo/code-style.md#quick-reference)
table is the short form. For imports, read
[Project Structure: Barrel Files](../working-in-this-repo/project-structure.md#barrel-files)
and [Between Packages](../working-in-this-repo/project-structure.md#between-packages).

## Checklist

- **Names** follow the [naming table](../working-in-this-repo/code-style.md#naming-conventions):
  `is`/`has`/`can` booleans, functions start with a verb, `Kind` not
  `Type`, `phase` not `state`, `_` for unused parameters. Reactions are
  named effect-then-trigger.
- **Files** are named for their main export, in kebab case, whatever the
  folder ([File Naming](../working-in-this-repo/code-style.md#file-naming)).
  Renaming an export renames its file and test in the same change.
- **Types**: string-literal unions, never `enum`. Function members as
  properties (`update: (deltaMs: number) => void`). No `null`: convert a
  third-party one with `?? undefined` where it arrives. No `this`.
- **Factories** take one options object, required inputs included, and
  return a plain record. A settable property is a getter/setter pair, not
  `setX()` ([Factory Functions](../working-in-this-repo/code-style.md#factory-functions)).
- **Views** are `XxxView(bindings)` ([Views and Bindings](../working-in-this-repo/code-style.md#views-and-bindings));
  load the `mvt-view` skill for the rest.
- **Layout**: the file's sections and declaration order follow
  [Code Organisation](../working-in-this-repo/code-style.md#code-organisation).
  Exports above internals.
- **Checks** use `assert` from `@mvtjs/utils`, with a lazy message; a
  plain `if`/`throw` on hot paths ([Assertions](../working-in-this-repo/code-style.md#assertions)).
- **JSDoc** on every export and public member
  ([Documenting Exports](../working-in-this-repo/code-style.md#documenting-exports)).
- **Imports** go through barrels, never your own or an ancestor's; other
  packages by name; the view tick API from the renderer package; every
  import a declared dependency.
- **Prose** in comments, test names and messages follows the
  [Writing Guide](../working-in-this-repo/writing-guide.md). No em-dashes.

## Before You Hand Over

- `npm run lint` passes. `npm run lint:fix` fixes formatting, method
  signatures and em-dashes. The rules it runs are listed in
  [Enforcement](../working-in-this-repo/code-style.md#enforcement).
- `npx tsc -b` type-checks, and `npm run test:unit` passes.
- Lint can't judge whether a name says what a thing is. Check that
  yourself.
