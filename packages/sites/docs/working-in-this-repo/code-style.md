# Code Style

> This page holds this repo's code conventions: how things are named, how a
> file is laid out, and a few TypeScript habits, such as never using `null`
> or `this`. They're this repo's choices, not MVT's. MVT's own rules are
> in [Appendix A](../appendices/a-mvt-on-one-page.md), and another MVT
> codebase could follow them with different conventions. Lint checks most
> of what's here, so this page mostly explains why.

**Related:** [MVT on One Page](../appendices/a-mvt-on-one-page.md) ·
[Project Structure](project-structure.md) ·
[Writing Guide](writing-guide.md) ·
[Glossary](../appendices/b-glossary.md)

---

## Quick Reference

| Convention | Example | Section |
| --- | --- | --- |
| File names | `score-model.ts` | [File Naming](#file-naming) |
| Types and interfaces | `ScoreModel`, `TileKind` | [Naming Conventions](#naming-conventions) |
| Functions and variables | `measureLoudness`, `deltaMs` | [Function Names](#function-names) |
| Booleans | `isAlive`, `hasShield`, `canFire` | [Boolean Properties](#boolean-properties) |
| Unused parameters | `_deltaMs` | [Naming Conventions](#naming-conventions) |
| Indentation | 4 spaces | [Formatting](#formatting) |
| Enum-like types | `type TileKind = 'wall' \| 'empty'` | [Enumeration Types](#enumeration-types) |
| Clear names | `kind` not `type`, `phase` not `state` | [Easily Confused Names](#easily-confused-names) |
| No `null` | `undefined` instead | [`undefined`, Not `null`](#undefined-not-null) |
| No `this` | Closures instead | [Closures, Not `this`](#closures-not-this) |
| Function members | `update: (deltaMs: number) => void` | [Function-Valued Properties in Types](#function-valued-properties-in-types) |
| Checks | `assert(loaded, 'call load() first')` | [Assertions](#assertions) |
| JSDoc | On every export | [Documenting Exports](#documenting-exports) |
| Factories | `createScoreModel(options)` | [Factory Functions](#factory-functions) |
| Views | `HudView(bindings)` | [Views and Bindings](#views-and-bindings) |
| Bindings | `score: () => number`, `onFirePressed` | [Views and Bindings](#views-and-bindings) |
| File layout | Interface, Options, Factory, Internals | [Code Organisation](#code-organisation) |
| Imports | Through a directory's barrel, `'./models'` | [Project Structure](project-structure.md#barrel-files) |
| Package imports | `import { updateView } from '@mvtjs/pixi'` | [Between Packages](project-structure.md#between-packages) |
| Prose | Short, complete, plain sentences | [Writing](#writing) |

## Naming Conventions

| Element | Convention | Example |
| --- | --- | --- |
| Files | `lower-kebab-case.ts`, named for the main export | `score-model.ts`, `hud-view.tsx` |
| Types and interfaces | `PascalCase` | `ScoreModel`, `GameViewBindings` |
| Model types | End in `Model` | `ScoreModel`, `ShipModel` |
| View functions | `PascalCase`, ending in `View` | `HudView`, `ShipView` |
| Functions and variables | `camelCase` | `createScoreModel`, `deltaMs` |
| Factory functions | `create` + the noun it makes | `createScoreModel`, `createSlotList` |
| Other functions | Start with a verb | `measureLoudness`, `parseCell`, `toInt16` |
| Boolean properties | `is`, `has` or `can` | `isAlive`, `hasAutoTurn`, `canFire` |
| Query bindings | What they return | `score`, `screenX`, `isAlive`, `tileKindAt` |
| Relay bindings | `on` + what the user did | `onFirePressed`, `onTileTapped` |
| A model's input | What the player means, never the control | `isThrusting`, `startNewRun()` ✅ · `thrustPressed`, `restartPressed` ❌ |
| Enum-like type names | `Kind`, not `Type` | `TileKind` ✅ · `TileType` ❌ |
| Lifecycle properties | `phase`, not `state` | `phase: GamePhase` ✅ · `state: GameState` ❌ |
| Unused parameters | `_` prefix | `update(_deltaMs: number)` |

[Chapter 4](../chapters/04-models.md#actions-say-what-the-player-means)
explains why a model's input says what the player means, rather than
naming the control they used.

### Boolean Properties

A boolean property should read as a yes-or-no question. `is` is the
default prefix. Use `has` or `can` when it fits the meaning better:

| Prefix | When to use it | Example |
| --- | --- | --- |
| **`is`** | A state or condition (the default) | `isAlive`, `isActive`, `isThrusting` |
| **`has`** | Owning something, or something being present | `hasAutoTurn`, `hasShield` |
| **`can`** | A capability or a permission | `canFire`, `canClick`, `canMove` |

When you're unsure, try rewording the name so that `is` works: `isAlive`
rather than `alive`, `isFuelEmpty` rather than `fuelEmpty`.

```ts
// ✅ Preferred - reads as a question
readonly isAlive: boolean;
readonly hasAutoTurn: boolean;
readonly canFire: boolean;

// ❌ Avoid - a bare adjective or noun
readonly alive: boolean;
readonly autoTurn: boolean;
readonly fuelEmpty: boolean;
```

### Function Names

A function's name says what it does, starting with a verb, so that a call
never reads as a value. `songDurationMs(song)` looks like a number until
you see the parentheses. `computeSongDurationMs(song)` can't be mistaken
for one.

| Kind of function | Name | Example |
| --- | --- | --- |
| Most functions | A verb, then what it acts on | `measureLoudness`, `parseCell`, `findSounds` |
| Conversions | `to` + what it converts to, as `toString` does | `toInt16`, `toFrequency` |
| Predicates | `is`, `has` or `can`, as for booleans | `isNoteInRange`, `hasShield` |
| Factories | `create` + the noun it makes | `createScoreModel` |
| Reactions | The effect, then its trigger | `playPumpSoundWhenInflationRises` |

```ts
// ✅ Preferred - reads as an action
const ms = computeSongDurationMs(song);
const lufs = measureLoudness(samples);

// ❌ Avoid - reads as a value
const ms = songDurationMs(song);
const lufs = loudnessOf(samples);
```

A [reaction](../chapters/09-noticing-changes.md#reactions-do-something-when-a-value-changes)
is named for what it does, then when: `playPumpSoundWhenInflationRises`,
`updateTextureWhenPhaseChanges`, never `playPump`. A sound's name says
`Sound`, and a visual's names what it changes.

Three kinds of function keep noun names, because they stand for something
other than an action. A view (`HudView`) is a thing on screen. A query
binding (`score`, `tileKindAt`) is read like a value, so it's named for
what it returns. A relay binding (`onFirePressed`) is named for the event.

## File Naming

Every file name is in `lower-kebab-case`:

```
score-model.ts    ✅
ScoreModel.ts     ❌
scoreModel.ts     ❌
score_model.ts    ❌
```

A file is named for its main export. That way you can go from a name to
its file, or from a file to what it holds, without having to look. Write
the export's name in kebab case. For a factory, leave out `create`: its
file holds the thing it makes, and that thing's interface too.

| Main export | File |
| --- | --- |
| `createScoreModel` (and `ScoreModel`) | `score-model.ts` |
| `HudView` | `hud-view.ts` |
| `measureLoudness` | `measure-loudness.ts` |
| `bounceAudio90Song` | `bounce-audio90-song.ts` |

A number stays joined to the word before it, so `Audio90` becomes
`audio90`.

The folders a file sits in are not part of its name. A file in an
`audio90/` folder that exports `createAudio90Song` is `audio90-song.ts`,
not `song.ts`. Folders change, and you don't see them in a search for a
file or in a list of imports.

Prefer one main export to a file. Short files don't add any noticeable
time or size, in Node or in a bundle. The exception is a small collection
of small, related items, such as a set of constants or a few short
helpers. A file like that takes a name for the collection, such as
`commands.ts` or `notes.ts`. Keep this the exception, not the rule. A
file that grows past about 300 lines is usually doing more than one job,
so look for a place to split it.

When you rename a file's main export, rename the file in the same change,
and its test file too.

## Formatting

Indent with 4 spaces, never tabs. ESLint Stylistic checks the formatting:
`npm run lint` reports what's wrong, and `npm run lint:fix` fixes what it
can.

Wrap JSDoc and comments at about 80 columns, so they read comfortably in
a narrow editor or a side-by-side diff.

## Enumeration Types

Write an enum-like type as a union of string literals. Don't use a
TypeScript `enum`, or an object of constants standing in for one. Name the
type with `Kind`, not `Type`.

```ts
// ✅ Preferred - string-literal union
type TileKind = 'empty' | 'wall' | 'dot' | 'spawn-point';

// ❌ Avoid - const-object enum pattern
const TileType = { Empty: 0, Wall: 1, Dot: 2 } as const;
type TileType = (typeof TileType)[keyof typeof TileType];

// ❌ Avoid - TypeScript enum
enum TileType {
    Empty,
    Wall,
    Dot,
}
```

A union is the simplest thing that's still type-safe, and it doesn't need
any runtime code. Its values explain themselves when you meet them in
a log or a debugger: `'wall'` means something, and `1` doesn't. And
TypeScript narrows a union in a `switch` statement, and checks that you've
handled every case.

## Easily Confused Names

Some everyday words already mean something in programming. When one of
them names something else, the reader has to stop and work out which
meaning you intended. Two are common enough to avoid:

| Avoid | Prefer | Why |
| --- | --- | --- |
| **`type`** | `kind` | It's easily confused with TypeScript's `type` keyword and `typeof`. |
| **`state`** | `phase`, `status`, `mode`, or a name from the domain | Everything a model holds is state, so a property called `state` doesn't say anything. Use `phase` for stages of a lifecycle, `status` for conditions, and `mode` for ways of operating. |

```ts
type EnemyType = 'mole' | 'salamander'; // ❌ clashes with TypeScript's idea of a type
type EnemyKind = 'mole' | 'salamander'; // ✅ clearly means which kind of enemy

type GameState = 'idle' | 'playing' | 'gameover'; // ❌ doesn't say anything
type GamePhase = 'idle' | 'playing' | 'gameover'; // ✅ clearly a stage of the game
```

The same goes for any word. If it already has a common meaning in the
codebase or the language, and you mean something different, choose a word
that the reader won't have to puzzle over.

## `undefined`, Not `null`

Use `undefined`, never `null`. JavaScript's own APIs use `undefined` for a
missing value, such as an array's `find` or a property that isn't there,
so using it everywhere means you check for only one kind of missing
value.

```ts
// ✅ Preferred
function find(id: string): Item | undefined;
let selected: Item | undefined;

// ❌ Avoid
function find(id: string): Item | null;
let selected: Item | null = null;
```

Our own code and APIs never introduce `null`. Some third-party APIs still
return it, such as the DOM's `querySelector`, or a Pixi container's
`parent`. Where one does, be explicit about it where the value arrives,
and convert it before it reaches our own APIs:

```ts
// ✅ Explicit where a third-party value arrives
if (node.parent === null) root.addChild(node);
const nav = document.querySelector('.site-nav') as HTMLElement | null;

// ✅ Converted at the boundary, so our own function never receives null
pick(params.get('view') ?? undefined, VIEWS, 'sprites');

// ❌ Our own API passing null on
function pick(value: string | null, ...): ...
```

Lint checks this with `@mvtjs/no-null`, from this repo's
`packages/internal/eslint-plugin`. It reports `null` as a value. It also
reports `null` in a type outside a function body, such as an interface, a
type alias, a function's signature or a module-level variable. It allows
comparisons and local types. A declaration that has to accept `null` from
outside takes an `eslint-disable-next-line` comment saying why.

## Closures, Not `this`

Don't use `this`. In JavaScript, `this` depends on how a function is
called, not where it's defined, which makes it fragile:

```ts
// ❌ Dangerous - `this` depends on the call site
class Ship {
    x = 0;
    moveRight() { this.x += 1; }
}

const ship = new Ship();
const move = ship.moveRight;
move(); // 💥 `this` is undefined (strict mode) or globalThis
```

That breaks whenever a method is passed as a callback, destructured out of
an object, or stored in a variable. There are workarounds, such as
`.bind()` or arrow functions made in a constructor, but they add ceremony,
and they're easy to forget.

[Factory functions](#factory-functions) and closures avoid `this`
altogether, and they allow patterns that code relying on `this` can't:

```ts
// ✅ Destructuring - take just the methods you need
const { update, reset } = createCounterModel();

// ✅ Passing a method directly - no .bind() needed
ticker.add(model.update);

// ✅ Composition - mix methods from several sources freely
const combined = {
    ...createMovement(options),
    ...createHealth(options),
};
```

These work because every function closes over its own state, instead of
relying on what `this` is at the call site.

Lint checks this with `@mvtjs/no-this`. A few files can't reach their
instance any other way, such as the renderer mixins' methods that are
wrapped onto a library's prototype, and a Rollup plugin's hooks.
`eslint.config.ts` exempts them by name.

## Function-Valued Properties in Types

In interfaces and type declarations, write each function member as a
property that holds a function, not with method syntax. This goes for
every kind of interface: models, bindings and options.

```ts
// ✅ Preferred
interface ToolbarViewBindings {
    selectedTool: () => ToolKind;
    onToolPressed?: (tool: ToolKind) => void;
}

// ❌ Avoid
interface ToolbarViewBindings {
    selectedTool(): ToolKind;
    onToolPressed?(tool: ToolKind): void;
}
```

There are two reasons:

- **The checking is stricter.** TypeScript checks a method signature's
  parameters loosely, even in strict mode. It accepts a function whose
  parameter is narrower than what it will be passed. A function-valued
  property gets the full check.

  ```ts
  interface Loose { onToolPressed?(tool: ToolKind): void }
  interface Strict { onToolPressed?: (tool: ToolKind) => void }

  const handler = (tool: 'sand') => { /* ... */ };
  const a: Loose = { onToolPressed: handler };  // accepted, though 'water' can arrive
  const b: Strict = { onToolPressed: handler }; // ❌ error, as it should be
  ```

- **It says what the member is.** Code in this repo never uses `this`
  ([Closures, Not `this`](#closures-not-this)), so every function member
  is a plain value. You
  can destructure it, pass it as a callback or store it. Property syntax
  says so. Method syntax suggests a method that needs its object.

The rule is about types only. An object literal that implements the
interface may still use method shorthand (`update(deltaMs) { ... }`), and
accessors (`get count()`) aren't affected.

Lint checks this with `@typescript-eslint/method-signature-style`, set to
`'property'`, and `npm run lint:fix` rewrites what it finds.

## Assertions

State a precondition, a postcondition or an invariant with `assert`, from
`@mvtjs/utils`, rather than a hand-written `if` and `throw`. It reads as
the condition that must hold, and TypeScript narrows the type after it.

```ts
// ✅ Preferred
assert(loaded, 'crumb-chase: load() must be called before start()');
assert(texture, () => `Texture '${name}' not found`);

// ❌ Avoid
if (!loaded) throw new Error('crumb-chase: load() must be called before start()');
```

- **Build a message lazily.** When a message is made from values, pass it
  as a function, so it's built only if the check fails.
- **Keep it off hot paths.** In code that runs every frame
  ([Chapter 24](../chapters/24-hot-paths.md)), keep a plain `if` and
  `throw`. That takes only the time to test the condition, without a
  function call or a message function to create.
- **It always checks.** A check that's too slow for a production build
  goes under the caller's own guard for development builds:
  `if (DEV) assert(...)`.

A `throw` that isn't a check, such as "not found" after a search, stays a
`throw`.

## Documenting Exports

Give every export a JSDoc comment: each interface, type, factory, view,
constant, and each of their public members. One line is enough when the
name and type say the rest. Add more for what the types can't say, such
as units, valid ranges, what must hold, side effects, or the order calls
must come in. Someone should be able to use a module from its JSDoc and
types alone, without reading its code.

A few habits keep JSDoc consistent:

- **Start a factory's JSDoc with "Creates",** and say what a function
  returns or does, not who calls it. The
  [Writing Guide](writing-guide.md#describing-an-api) has more on
  describing an API.
- **Say so when a model falls short at some step sizes.** Every model must
  produce the same results at any step size up to the ticker's cap
  ([Chapter 6](../chapters/06-time-and-phases.md#steps-of-different-sizes)),
  so a caller doesn't need to know anything else about its steps. If one can't
  yet, such as a timer that drops the time left over when it ends, its
  JSDoc says what goes wrong, until someone fixes it.
- **Document a side effect** in the public API. Then it's clear what
  counts as a breaking change.

## Factory Functions

This repo writes models, and its other objects with state, as factory
functions that return plain records, never as classes. That's this repo's
convention, not an MVT requirement: a class can meet every MVT rule too.
[Chapter 4](../chapters/04-models.md#writing-a-model-as-a-factory) shows
a model written this way, and
[Why Factory Functions, Not Classes](#why-factory-functions-not-classes)
explains the choice.

- **Describe the public API as an interface,** and export it. Other code
  depends on the interface, never on the object that implements it.
- **Write a factory, `createXxx`, that takes one options object,** and
  returns an object of the interface's type. Required inputs go in the
  options object too: `createJsx({ target, elements })`, never
  `createJsx(target, elements)`.
- **Implement the interface with a plain record.** Keep private state in
  the factory's closure.

```ts
interface CounterModel {
    readonly count: number;
    readonly rate: number;
    increment: () => void;
    update: (deltaMs: number) => void;
}

interface CounterModelOptions {
    readonly initialCount?: number;
    readonly rate?: number;
}

function createCounterModel(options: CounterModelOptions = {}): CounterModel {
    const { initialCount = 0, rate = 1 } = options;
    let count = initialCount;
    let elapsedMs = 0;

    const model: CounterModel = {
        get count() { return count; },
        rate,
        increment() {
            count += 1;
        },
        update(deltaMs) {
            elapsedMs += deltaMs;
        },
    };

    return model;
}
```

Why an options object, rather than a list of parameters? An ordered list
is fragile. Two arguments of the same type can be swapped without a type
error, a call site doesn't say which value is which, and a new parameter
can only go on the end, or break every caller. A named property can be
added, made optional or given a default without touching any call site.

The private state, `count` and `elapsedMs` here, lives in the closure,
where code outside the factory can't reach it. `readonly` on the
interface means that other code may read a property but not change it,
and the getter lets the model change it from inside.

A model file exports the model's interface, its options type, its
factory, and any domain types its interface uses, such as `GamePhase` or
`TileKind`. Its helpers, and the types for its own mutable state, stay
inside the file.

### Why Factory Functions, Not Classes

Here's the same counter written as a class, for comparison:

```ts
class CounterModel {
    readonly rate: number;
    #count: number;
    #elapsedMs = 0;

    constructor(options: CounterModelOptions = {}) {
        this.#count = options.initialCount ?? 0;
        this.rate = options.rate ?? 1;
    }

    get count() { return this.#count; }

    increment() { this.#count += 1; }

    update(deltaMs: number) { this.#elapsedMs += deltaMs; }
}
```

It's a little shorter, and almost any programmer can read it at a glance,
because classes are what most languages and courses teach first. Its
methods also exist once, on the class's prototype, and every instance
shares them. Those are real advantages. This repo still writes factories,
for two reasons: one class makes several separate decisions at once, and
the easiest way to write a class leads to habits that this book warns
against.

A class declaration decides all of these at once:

| Decision | In a class | With a factory |
| --- | --- | --- |
| The shape that other code depends on | The class, which is also a type | An `interface` |
| How an object is made | `new`, which always makes a new instance of that class | `createXxx(options)`, which can return any object that matches the interface |
| The implementation | The class's method bodies | The record that the factory returns |
| Private state | `private` and `#` fields, which are part of the class's type | Variables in the factory's closure, which aren't part of any type |
| Sharing code between kinds of object | Implementation inheritance with `extends` | Composing smaller pieces |
| Grouping related functions | `static` members | A module's exports |
| Which object a method works on | `this`, which each call site sets | The closure, which each call to the factory makes |

[Separation of Concerns](../chapters/26-separation-of-concerns.md)
(SoC) asks for each decision to be made in one place, so that it can
change without touching the others. A class ties them together under one
name. Code that writes `new CounterModel()` depends on how the counter is
made, on its type and on its implementation, all at once. A factory
separates them. Callers depend on the interface and the factory's
signature, and everything else stays inside the factory's file.

The easiest way to write a class goes wrong in three places:

- **Inheritance is one keyword away.** `extends` reuses code with less
  typing than composition does, so it's what a class invites. A subclass
  then depends on its parent's internals, and a change to the parent
  reaches every subclass. This is the fragile base class problem, which
  the [Composite Reuse Principle](../chapters/30-composite-reuse.md)
  (CRP) appendix describes. A factory has no `extends`, so its shortest
  path to reuse is composition: a parent holds the pieces it uses.
- **The implementation leaks into the contract.**
  [Design by Contract](../chapters/31-design-by-contract.md) (DbC)
  keeps a contract to what callers may rely on. A class's type includes
  its implementation, private fields too. A test's stand-in object with
  every public member of `CounterModel` still isn't a `CounterModel`, and
  won't type-check without a cast. `protected` members add a second
  contract, with every subclass, which is easy to widen without noticing.
  You can give a class a separate interface, with `implements`, but
  nothing makes callers use it, and most code ends up naming the class.
  With a factory, the interface is the whole contract, and the record
  behind it can change freely.
- **How objects are made is fixed at every call site.** `new` always
  makes a new instance of one class. It can't return an object from a
  pool, choose a different implementation, or wait for something
  asynchronous. A factory can do any of these, without its callers
  changing. Falling Sand's
  [`createGrainGrid`](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/falling-sand/models/grain-grid/grain-grid.ts)
  returns one of three implementations of its `GrainGrid` interface,
  depending on how the demo is asked to store its grains. Turning a
  `new` into a factory later means editing every caller.

A class's methods also rely on `this`, which breaks when a method is
passed on as a callback.
[Closures, Not `this`](#closures-not-this) shows how.

Factories have drawbacks too:

- **Each instance makes its own functions.** A class's instances share
  one copy of each method, through the prototype. Each call to a factory
  creates a new function for every method in its record, which takes more
  memory and more time for each object. For a few hundred models, the
  difference doesn't matter. For thousands of small objects, such as
  Falling Sand's grains or Neon Monsoon's bullets, this repo stores their
  data in arrays that one model updates, so no functions are made for
  each object.
- **The pattern is less familiar.** A reader who knows classes from Java
  or C# has to learn to read a closure's variables as private state. Every
  model in this repo is laid out the same way, which helps.
- **`instanceof` doesn't work.** To tell kinds of object apart, give each
  a `kind` property, with a
  [string-literal union](#enumeration-types) as its type.
- **Debugging tools show less.** A heap snapshot lists a factory's records
  as `Object`, not by a class name. A debugger shows the private state
  only in each function's closure scope, not as the object's fields.

### Getter / Setter Pairs

When other code may set a model's property, give the interface a property
that can be both read and written, implemented with a getter and a
setter. Don't pair a read-only property with a `setX()` method. A setter
is JavaScript's own way of doing this, and it keeps the interface small.

```ts
// ✅ Preferred - a property that can be read and written
interface FlockModel {
    separation: number;        // readable and writable
    readonly maxSpeed: number; // readable only
}

// ❌ Avoid - a getter and a setX() method
interface FlockModel {
    readonly separation: number;
    setSeparation: (value: number) => void;
}
```

In the factory, use `get` and `set` accessors over a closure variable:

```ts
const model: FlockModel = {
    get separation() { return separation; },
    set separation(value) { separation = value; },
    // ...
};
```

When setting the property has to do more, the setter does it. Setting
`boidCount`, for example, adds or removes boids:

```ts
get boidCount() { return boids.length; },
set boidCount(count) {
    const target = Math.max(0, Math.round(count));
    while (boids.length < target) boids.push(randomBoid());
    while (boids.length > target) boids.pop();
},
```

## Views and Bindings

A view is a function named `XxxView`, never a `createXxxView` factory. It
takes one bindings object and returns what it draws: a Pixi container, a
three.js object or a DOM element, depending on its renderer. The same
function works as a JSX tag and as a plain call, so any code can use a
view without an adapter.
[Chapter 7](../chapters/07-views.md#the-role-of-a-view) teaches views, and
[Chapter 8](../chapters/08-bindings.md) teaches bindings.

```ts
export interface ShipViewBindings {
    screenX: () => number;
    screenY: () => number;
    isAlive: () => boolean;
}

export function ShipView(bindings: ShipViewBindings): Container { /* ... */ }
```

| Element | Rule | Example |
| --- | --- | --- |
| View function | `PascalCase` noun ending in `View`. A JSX tag calls your own function only if its name starts with a capital letter | `HudView`, `TerrainView` |
| Bindings type and parameter | `XxxViewBindings`, and the parameter is `bindings`. Never `props`, even in a JSX file | `HudViewBindings` |
| Query binding | Named for what it returns, with no `get` prefix | `score`, `screenX`, `phase` |
| Boolean query binding | `is`, `has` or `can`, as for [boolean properties](#boolean-properties) | `isAlive`, `canFlip` |
| Query binding with a position or index | Ends in `At` | `tileKindAt(row, col)`, `isSolidAt(col, row)` |
| Query binding with a key | Ends in `For` | `colorFor(kind)` |
| Relay binding | `on` + what the user did, not what it should cause | `onFirePressed` ✅ · `onShoot` ❌ |
| View model option or member | Named as a query or relay binding is, since a view model is fed from its view's bindings and read the same way | `count`, `idAt(index)`, `xFor(cell)` |

In JSX, a view's bindings are written as attributes. Other JSX libraries
call the same object *props*. This repo doesn't, because MVT's word for
it is *bindings*, and because an attribute on a built-in element, such as
`<sprite>`, sets one of its properties.

A query binding's type says whether the view follows its value as it
changes: `() => T` is read every refresh, `T` is read once, and
`ValueOrGetter<T>` accepts either. Never declare a function and read it only
once. [Chapter 8](../chapters/08-bindings.md#fixed-values-and-getters)
explains each form, and when to choose it.

A top-level view takes its model as its one binding, a fixed value, so its
signature matches every other view's: `GameView({ model })`.
[Chapter 8](../chapters/08-bindings.md#when-to-pass-the-whole-model) says
why.

### Writing the Body

A view's body can be JSX, in a `.tsx` file that starts
`/** @jsxImportSource @mvtjs/pixi */` (or `@mvtjs/three` or
`@mvtjs/html`), or plain TypeScript. MVT doesn't require either, and
callers can't tell which one a view uses. Choose whichever reads better for the
view. JSX tends to suit a tree of display objects whose properties follow
the model. Plain TypeScript tends to suit a view that mostly draws, or
manages its own display objects, such as a pool.
[Chapter 12](../chapters/12-writing-views-in-jsx.md#choosing-between-jsx-and-plain-typescript)
compares the two.

### Releasing Resources

A view that holds a resource that isn't destroyed with its display
objects, such as a `window` listener, releases it on Pixi's `'destroyed'`
event, or with the `onDestroyed` attribute in a JSX body. Never replace
`destroy` on an instance.
[Chapter 7](../chapters/07-views.md#releasing-a-view-s-resources) shows
how.

## Code Organisation

### File Sections

Each model or view file is laid out in the same sections, each headed by a
banner, so you always know where to look:

```ts
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// The public interface

// ---------------------------------------------------------------------------
// Options (if needed)
// ---------------------------------------------------------------------------

// The factory's options type

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// The createXxx() factory

// ---------------------------------------------------------------------------
// Internals (if needed)
// ---------------------------------------------------------------------------

// Types, constants and helpers used only inside this file
```

A view file names its first section `Bindings`, for its `XxxViewBindings`,
and its third `View`, for the `XxxView` function.

The order puts what a reader needs first. They see the public contract,
then what can be configured, then the implementation, and only then the
details.

Every export goes above every internal declaration. Internal types and
internal values, such as constants and helper functions, go at the
bottom, below the last export.

Among the exports, a main type comes before the helper types it uses. If
`DebrisModel` has a list of `DebrisParticle`s, `DebrisModel` comes first:

```ts
// ✅ Main interface first, helper type second, internal type last
export interface DebrisModel {
    readonly particles: readonly DebrisParticle[];
    /* ... */
}

export interface DebrisParticle {
    readonly x: number;
    /* ... */
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableParticle { /* ... used only inside the factory ... */ }
```

### Declaration Order Within Functions

Inside a factory, or any function long enough to need it, put the big
picture first:

1. **Set-up** at the top: the state, and the child models.
2. **The public record,** and the `return`.
3. **The helpers that build the parts,** such as child models.
4. **Small, low-level helpers** at the bottom, such as maths functions.

That's the same order that the file follows, interface before factory, and it
lets a reader see what the function is for without scrolling. JavaScript
hoists function declarations, so you can declare helpers below the
`return`, in the order that explains them best.

```ts
export function createGameModel(options: GameModelOptions): GameModel {
    const { arenaWidth, arenaHeight } = options;

    // --- Set-up -------------------------------------------------------------
    const ship = buildShip();
    let asteroids: AsteroidModel[] = [];

    // --- Public record ------------------------------------------------------
    const model: GameModel = {
        get ship() { return ship; },
        get asteroids() { return asteroids; },
        update(deltaMs: number): void { /* main loop */ },
    };

    return model;

    // --- Child construction -------------------------------------------------

    function buildShip(): ShipModel { /* ... */ }

    // --- Helpers ------------------------------------------------------------

    function distSq(x1: number, y1: number, x2: number, y2: number): number {
        /* ... */
    }
}
```

## Enforcement

`npm run lint` checks most of these conventions, and `npm run lint:fix`
fixes what it can. Most of the rules come from this repo's own plugin, in
`packages/internal/eslint-plugin`, and `eslint.config.ts` sets which
files each one covers.

| Convention | Lint rule |
| --- | --- |
| Formatting | ESLint Stylistic |
| No `null` | `@mvtjs/no-null` |
| No `this` | `@mvtjs/no-this` |
| No em-dashes, in code or prose | `@mvtjs/no-em-dash` |
| Function-valued properties | `@typescript-eslint/method-signature-style` |
| A view is `XxxView(bindings)`: no `createXxxView`, no `XxxViewProps`, and no `get` prefix in `XxxViewBindings`, `XxxViewModel` or `XxxViewModelOptions` | `no-restricted-syntax` |
| A model's members say what the player means, not the control | `@mvtjs/no-control-names` |
| Imports go through barrels, and never into your own or an ancestor's | `@mvtjs/no-deep-imports`, `no-restricted-imports` ([Project Structure](project-structure.md#barrel-files)) |
| Every import is a declared dependency | `import/no-extraneous-dependencies` ([Between Packages](project-structure.md#between-packages)) |

The same plugin checks some of MVT's own rules, such as no wall-clock time
in a model (`@mvtjs/no-wall-clock`), and the way reactions and watchers
are used. Lint can't check everything here, such as whether a name says
what a thing is. That's left to you, and to whoever reviews your change.

## Writing

The rules for prose, in docs, READMEs, JSDoc, comments, test names and
error messages, are in the [Writing Guide](writing-guide.md).
