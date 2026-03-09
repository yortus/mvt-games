# Pacman

A classic arcade game built with modern web technologies, structured around the
**MVT (Model-View-Ticker)** architecture for clean separation of concerns,
testability, and buttery-smooth animation.

## Tech Stack

| Layer      | Technology                 |
| ---------- | -------------------------- |
| Language   | TypeScript (strict mode)   |
| Rendering  | Pixi.js                    |
| Animation  | GSAP                       |
| Build      | Vite                       |
| Linting    | ESLint + TypeScript ESLint |
| Formatting | Prettier                   |

## Quickstart

```bash
npm install
npm run dev
```

## Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start the Vite dev server with hot reload        |
| `npm run build`        | Type-check with `tsc` then bundle for production |
| `npm run preview`      | Preview the production build locally             |
| `npm run lint`         | Lint `src/` with ESLint                          |
| `npm run format`       | Format all files with Prettier                   |
| `npm run format:check` | Check formatting without writing changes         |

## Architecture

The project follows the **MVT (Model-View-Ticker)** pattern — an architectural
approach designed for visual/interactive applications with frame-based animation:

- **Models** own all state and domain logic, advancing only through explicit
  `update(deltaMs)` calls.
- **Views** are stateless renderers that read model state through a `bindings`
  interface and refresh every frame.
- **Ticker** drives the loop: update models → refresh views → render frame.

See the [MVT Architecture Guide](docs/mvt-guide.md) for full details.

## Documentation

| Document                                      | Description                                                   |
| --------------------------------------------- | ------------------------------------------------------------- |
| [Documentation Hub](docs/README.md)           | Start here — index of all guides with glossary                |
| [MVT Architecture Guide](docs/mvt-guide.md)   | Full MVT pattern reference with diagrams                      |
| [TypeScript Style Guide](docs/style-guide.md) | Coding conventions, naming, project structure                 |
| [AGENTS.md](AGENTS.md)                        | AI agent orientation — architecture & conventions at a glance |

## Project Structure

```
src/
├── main.ts          Entry point — bootstraps app, wires models ↔ views, starts ticker
├── data/            Static data and configuration constants
├── models/          State & domain logic + shared domain types (Direction, TileKind, GamePhase)
├── utils/           General helpers (e.g. change-detection watches)
└── views/           Pixi.js rendering
```

Each directory is a module with a barrel file (`index.ts`) defining its public API.
