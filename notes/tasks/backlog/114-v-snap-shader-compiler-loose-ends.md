# v-snap: Loose Ends From Comparing Across Shader Compilers

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-24 |
| Updated  | 2026-11-24 |

## Description

[113](../../archive/113-v-snap-on-machines-that-draw-differently.md) made
v-snap compare across SwiftShader's two shader compilers, Subzero on x64
and LLVM on arm64, by the one-sample rule. It left these questions open.
They don't block anything today, since every image in the repo passes.

- **Ubuntu on arm64 instead of macOS in CI.** `ubuntu-24.04-arm` draws
  the same images as `macos-latest`, and it usually starts faster. But
  the macOS runner also checks that macOS composites HTML the same way, so
  it may still earn its place in `visual.yml`.
- **Clipping and the Arcade Hall's edge.** 20 pixels along one shallow
  edge of the nearest cabinet moved by one sample on LLVM. That cabinet
  runs out of the frame toward the camera, so the clipper cuts it. One
  probe, a shape crossing the near plane, drawn with both shader
  compilers, would say whether clipping is the cause. If it is, it's a
  reason to skip such a test on one shader compiler, not a rule for
  scenes.
- **Should the summary say when a run checked a reference only by the
  rule?** It would remind a team without a runner for each shader
  compiler. It would also be noise for a team that has one.
- **Should the tolerance within one shader compiler stay at 2 levels?**
  Within x64 it's never been needed, but it costs little.
- **A second reference for each shader compiler** (`eachShaderCompiler`,
  113 section 5) was set aside, since every case found so far has a
  better fix. Build it only if a real test needs it.
- **The x64 difference that 113 couldn't explain.** An Intel laptop once
  drew the Arcade Hall's control panel differently from GitHub's x64
  runners. The spike couldn't make it happen again.

## Acceptance criteria

- [ ] `visual.yml` runs on the arm64 runner chosen, with the reason in its
      comment.
- [ ] The clipping probe has run, and v-snap's docs say what it found, if
      it changes any advice.
- [ ] The summary question and the tolerance question are decided, and
      recorded here.

## Progress Log

- 2026-11-24: Created from 113's open questions, as 113 was archived.
