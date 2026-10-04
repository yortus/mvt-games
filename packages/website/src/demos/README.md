Interactive demonstrations of techniques and patterns used in the MVT architecture.

Each demo is a self-contained module under `packages/website/src/demos/<name>/` that exports a
`createXxxEntry(): DemoEntry` factory. Demos are registered in `packages/website/src/demos/index.ts`
and appear in the HTML gallery at `/demos/`.

See `demo-entry.ts` for the `DemoEntry` and `DemoSession` interfaces.
