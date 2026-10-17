# Playground: Swap the Views, Keep the Model

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

MVT keeps all state in the models, and views only read it. So when a
visitor changes only views, the playground could swap the old views for new
ones while the model keeps running. The ball keeps bouncing, the game keeps
its score, and the new colour appears on the next frame. It's the
architecture's main promise, shown in a way no slide can. Of 052's later
ideas (its section 10.1), this is the strongest case for an MVT playground,
so it comes first.

Today, each run gets a fresh sandbox document (052 section 5.1), and a
change to any file restarts the project.

### What it needs

- **A run that keeps its document.** The changed view modules are loaded
  again, under new blob URLs, and the modules that didn't change are kept.
- **A `main.ts` that builds the views apart from the models,** so the
  playground can call one without the other. Perhaps an optional `views`
  function beside `start`, given the models that `start` returned. The
  starters, the examples, Help and the project API would change to match.
- **A rule for which edits count as "only views".** For example, a file in
  `views/` that nothing in `models/` imports. Anything else restarts the
  project, as now.

### Things to decide

- How a project that doesn't split its views out behaves: it restarts on
  every change, as now.
- What happens to a view's presentation state, such as a tween in
  progress, when it's swapped.
- How the swap shows in the page, so a visitor sees that the model kept
  running.

## Acceptance Criteria

- [ ] A design for the split, the swap and the "only views" rule, agreed
      with the owner. A proposal if it grows.
- [ ] Changing a view in a running project swaps it in on the next frame,
      with the model's state kept.
- [ ] Any other change restarts the project, as now.
- [ ] The starters, examples, Help and docs show the split.
- [ ] Lint, type checks, unit tests and visual tests pass.

## Progress Log

### 2026-10-17

Created from 052's section 10.1, when 052 was archived.
