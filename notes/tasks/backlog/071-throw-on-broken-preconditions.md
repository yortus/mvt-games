# Throw on Broken Preconditions

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-06 |
| Updated  | 2026-10-21 |

## Description

Proposal [070](../../archive/070-principles-docs.md) settled how a model
treats an action called when it can't run (section 12, question 5): a
broken precondition throws. Quietly ignoring the call instead widens the
contract for good, since callers come to rely on the quiet (Hyrum's Law), and
it hides the caller's bug.

The work is in sorting each guard into one of two cases:

- **A precondition.** The call means nothing in that state, such as
  `spin()` while the reels spin. The model documents the precondition, gives
  it a matching `can*` query (below), and throws with `assert` from
  `@mvtjs/utils` when it is broken. Callers that may hit the state in normal
  play (a tap racing a phase change) check the query first. The model is
  [`fruit-machine-model.ts`](../../../packages/sites/arcade/src/entries/fruit-machine/models/fruit-machine-model.ts):
  `canSpin`, `canStop` and their asserts.
- **Documented behaviour.** The call has a game meaning, and the game's rule
  is that nothing happens, such as pressing fire while the gun cools down.
  Keep the early return, and document it on the action as behaviour the model
  guarantees.

### The `can*` convention

Every action with a precondition has a matching query, and the query *is*
the precondition:

- **Named for the action:** `spin()` and `canSpin`, `startDive()` and
  `canStartDive`. Unless a query the model already has states the
  precondition exactly, under another name: `SlotList`'s `insert()` needs
  `!isFull`, and a `canInsert` would only repeat it.
- **The whole precondition, nothing more.** The action asserts exactly it:
  `assert(model.canSpin, ...)`. So the precondition is defined once (SSOT),
  and callers never repeat it as `enemy.phase === 'formation'`.
- **A property when the precondition depends only on state; a function
  taking the action's arguments when it depends on them:**
  `canPlaceTile(row, col)` for `placeTile(row, col)`.
- **No query for an action without a precondition.** One that is always
  `true` is noise, and a guarantee that can never be withdrawn. Adding it
  later, with the precondition, breaks callers anyway, so there is nothing
  to prepare for.

This is Meyer's precondition availability rule: a caller must be able to
check a precondition before calling, or it cannot be blamed for breaking
it. It also gives views a uniform way to show an action as unavailable (a
greyed-out spin button). Exceptions may turn up during the audit; record
each one and why in the progress log, and in the DbC page if it generalises.

Only public actions are in scope: methods on a model's interface that a
parent model, the wiring or a view's relay can call. Guards inside `update`
and private helpers are logic, not contract. A grep for early-return guards
in models finds 144 lines across 44 files, so most of the audit is ruling
guards out.

Known candidates, found while writing 070:

- `destabilize()` in [`burrow-bust/models/rock-model.ts`](../../../packages/sites/arcade/src/entries/burrow-bust/models/rock-model.ts)
  returns unless `'stable'`.
- `startDive()` in [`galaxy-raiders/models/enemy-model.ts`](../../../packages/sites/arcade/src/entries/galaxy-raiders/models/enemy-model.ts)
  returns unless `'formation'`.

Do not start before the Design by Contract page of 070 is published, so the
code can link to the explanation.

## Acceptance Criteria

- Every public action on every model in `packages/sites/arcade/src/entries/`
  and `packages/sites/arcade/src/arcade/` audited, and each guard sorted
  into one of the two cases.
- Each precondition documented in the action's JSDoc, given a matching
  `can*` query following the convention above, and checked with
  `assert(model.canX, ...)`.
- Each "does nothing" case documented in the action's JSDoc.
- Callers that relied on a quiet return, or repeated a precondition inline,
  now check the `can*` query.
- The convention added to the [style guide](../../../packages/sites/docs/reference/style-guide.md)
  and the [model skill](../../../packages/sites/docs/ai-agents/skill-mvt-model.md).
- A test for each new throw.
- `npm test`, `npm run lint` and `npm run build` pass, and every game still
  plays.

## Progress Log

- 2026-10-06: Created from 070. Added the `can*` convention.
- 2026-10-21: Renumbered 071 (was 069) on reaching `vnext`, where 069 was
  taken.
