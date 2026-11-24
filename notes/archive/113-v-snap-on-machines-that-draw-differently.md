# Proposal: v-snap on machines that draw differently

> A reference image made on any machine is meant to pass on every other.
> On arm64, 3D scenes don't. A few pixels along the edges of shapes
> differ, by up to 50 levels. The stopgap now on `main` passes such an
> image if those pixels are few and scattered. But its limits were fitted
> to the first seven failures, and the next change to a scene broke them.
>
> A spike found the cause. SwiftShader, the software GPU that v-snap draws
> with, has two shader compilers: Subzero on x64 and LLVM on arm64. They
> round some arithmetic differently, but each shader compiler draws
> exactly the same images on every machine that uses it. v-snap can read
> which shader compiler a machine uses from the WebGL renderer string.
>
> This proposal compares exactly when the reference and the image come
> from the same shader compiler, as v-snap does today. Across shader
> compilers, a pixel may change as much as one sample crossing an edge
> could change it. That limit comes from how drawing works, not from our
> images. For the rare scene that needs more, a test keeps a second
> reference for the other shader compiler, compared exactly too.

**Status:** done 2026-11-24. Stages 0, 1 and 3 shipped: v-snap reads and
records shader compilers, compares across them by the one-sample rule in
place of the stopgap, and its docs say so. Stage 2's second reference for
each shader compiler was set aside, since every case found has a better
fix (section 5). Only its `shaderCompiler` export was built, for skipping
a test as a last resort, with a rule in Limits and Rules to hash with
integers in shaders. Tips on poses were left out, since nothing yet shows
which poses help. The open questions moved to task
[114](../tasks/backlog/114-v-snap-shader-compiler-loose-ends.md).

**Written:** 2026-11-23, on `main` after the CI runs `45186956553` and
`45191352852`, from their macOS and Ubuntu artifacts, prototypes of four
comparison rules run over those failures, and the same rules run over 228
real changes to reference images in git history. Revised 2026-11-24 from
the spike's runs, `45284264968` and `45289238347`. The spike's probes,
patch and workflow were deleted once this proposal was accepted. They're
in commit `a349d93e`, in `notes/proposals/113-spike/` and
`.github/workflows/spike-113.yml`.

## 1. What Differs, and Where

v-snap draws every image in SwiftShader, a GPU in software, so that every
machine runs the same drawing code. Three differences have shown up.

1. **arm64 rounding, within 2 levels,** over thousands of pixels: blurs,
   rotated images, some edges. The tolerance of 2 levels per channel
   covers these, and has since v-snap began.
2. **arm64 edges in 3D scenes.** A handful of pixels, each on the edge of a
   shape, differ by up to 50 levels. Each run on the macOS runner found
   the same ones:

   | Image | Pixels past the tolerance | Largest difference |
   | --- | --- | --- |
   | Chicane, a missile coming up behind | 1 | 6 |
   | Chicane, blowing up a rival | 18 | 50 |
   | Chicane, catching a rival | 7 | 35 |
   | Chicane, finished | 1 | 7 |
   | Chicane, just wrecked | 3 | 43 |
   | Orrery, some days in (and its entry image) | 1 | 24 |
   | Arcade Hall, in reach of a cabinet | 20, in one run along an edge | 33 |

3. **x64 against x64, once.** The Arcade Hall's control panel stood 2.6 mm
   behind the base's front face. An Intel Core Ultra 9 drew its edge
   differently from GitHub's x64 runners, in 9 pixels. Moving the faces
   apart fixed it. The spike couldn't make it happen again. The same
   laptop now draws the same as the runners in every probe, even with
   faces 3 mm apart. It wasn't the depth buffer's precision either. At
   the cabinet's 1 to 2 m from the camera, the depth buffer resolves
   depths a few thousandths of a millimetre apart, far finer than 2.6 mm.
   So the bullet it led to in Limits and Rules is wrong twice over. It
   says to keep faces a few millimetres apart, and it blames processors
   with different features. Stage 3 rewrites it.

### What Didn't Work

Each of these was tried on the failures above. Most were also tried on real
changes from history.

- **Counting pixels** (the stopgap: at most 1 in 10,000, in clumps of at
  most 2). The limits came from the first seven images. The next run
  failed, with a clump of 20 along one shallow edge.
- **Finding the pixel's colour in a neighbour.** It explained a third of
  the pixels. Antialiased edges blend colours, so a moved edge gives
  colours that no neighbour has.
- **Requiring the colour to lie between its neighbours' colours.** On a
  shallow edge, the blend spreads along the edge over several pixels, past
  any 3 by 3 neighbourhood.
- **Matching the reference moved by a fraction of a pixel** (bilinear
  sampling, up to 1.5 px in any direction). Five of the nine failures
  couldn't be matched at all. The differences aren't the picture moving.
  They're single samples landing on the other side of an edge.

## 2. Two Shader Compilers

The spike ran small WebGL probes in v-snap's browser, with v-snap's
switches, on six CI runners and one laptop, twice on each. Each probe
worked out 22 arithmetic operations bit for bit, in both shaders, and drew
scenes built to show where drawing could differ.

### Which Machines Use Which

SwiftShader compiles each shader for the processor it runs on, and it has
two shader compilers. Subzero is built only for x64. On arm64, SwiftShader
uses LLVM instead. Chromium names the shader compiler in the WebGL renderer
string,
such as `SwiftShader Device (Subzero)`.

| Machines | Shader compiler | What they drew |
| --- | --- | --- |
| Intel Core Ultra 9 (the laptop), Intel Xeon 8573C, AMD EPYC 7763 and 9V45, Intel i7-8700B (macOS) | Subzero | the same, in every probe |
| Windows on arm64 (Cobalt 100) | Subzero | the same as x64, since Playwright runs x64 Chromium there, emulated |
| Apple M1 (macOS), Ubuntu on arm64 | LLVM | the same as each other, and different from x64 |

- Every machine drew the same both times.
- macOS and Ubuntu on arm64 drew the eight failing images byte for byte
  the same, in two runs each.
- So each shader compiler draws exactly the same images, whatever its processor or
  operating system.
- `process.arch`, which v-snap uses today, gets Windows on arm64 wrong. It
  says arm64, but the machine draws as x64 does.

### Why the Shader Compilers Differ

SwiftShader has its own multiply-add step. LLVM fuses it into one
instruction, which rounds once. Subzero keeps the multiply and the add
apart, and rounds twice. SwiftShader uses this step for dot products,
matrix products, and the formulas behind `log`, `pow`, `sin` and `cos`.
Those are exactly what the probes found different on arm64. A plain
`a * b + c` in a shader, division, `sqrt`, `inversesqrt` and `exp` matched
everywhere.

Neither Chromium nor SwiftShader has a setting that stops the fusing. Only
a patch to SwiftShader could.

### Why 3D and Not 2D

The difference is in the last bit of a result, and most drawing never
lets a last bit show.

- **Vertices snap.** The rasterizer snaps each vertex to a sixteenth of a
  pixel. A last-bit difference moves a vertex only if it lies right at a
  snapping boundary. A forest of 90,000 vertices, put through a matrix in
  the shader, drew the same with both shader compilers. A 2D view's transforms mostly
  hold exact numbers, so they never come near a boundary.
- **A moved vertex moves a sixteenth of a pixel.** That changes only the
  samples right by the edge, at most one in each pixel along a straight
  edge. The Arcade Hall's 20 pixels lie along one long, shallow edge of
  the nearest cabinet, and the whole edge moved by one sample. That
  cabinet runs out of the frame toward the camera, so the clipper cuts it,
  and the clipper works out new vertices with arithmetic. Clipping is the
  likeliest cause there, but the probes don't test it yet.
- **The depth test can flip.** 2D draws in order, and never compares
  depths. 3D keeps the nearest surface at each sample. Faces 0.03 mm apart
  changed 1,111 pixels, by up to 153 levels, some of them where the image
  is flat. But every GPU draws a gap that small unreliably. With the probe's
  camera, the depth buffer resolves depths only about 1 mm apart at 40 m.
  Faces closer than that fight over each sample (z-fighting), and flicker
  as the camera moves. Faces 0.3 mm and 3 mm apart drew the same
  with both shader compilers. But 0.3 mm is also too close for the depth buffer at
  40 m. So the two shader compilers agreed by luck, and 0.3 mm isn't a safe gap.
- **Lighting rounds differently.** Powers and logarithms differ in their
  last bits, so a lit surface can change by a level. That's why many 3D
  images pass on arm64 only *within* the tolerance.

## 3. The Model: One Sample Across an Edge

With antialiasing, a pixel's colour is the average of several samples (4
here, which is why the failing values step by about 16 levels of blue). A
vertex that moves a sixteenth of a pixel moves its edges by less than the
gap between samples. At most, that puts one sample on the other side of
the edge. That sample changes the pixel by its share of the colour
difference across the edge.

That change is never larger than the pixel's largest step to one of its 8
neighbours, in one image or the other:

- **On an edge between two surfaces,** the pixels on either side differ by
  the whole contrast, and one sample's share is a fraction of it.
- **On a sliver thinner than a pixel,** the pixel holds at least one of the
  sliver's samples in whichever image shows it, so its step to the
  background is at least one sample's share.
- **Without antialiasing,** a pixel changes wholly from one surface to the
  other, and a neighbour shows the surface it changed from.

So the rule is: **a pixel matches across shader compilers if, in each channel, it
differs by at most the tolerance plus its largest step to a neighbour, in
either image.** A pixel that changes where both images are flat has no step
to excuse it, and fails.

The limit is the model's, not tuned to our images. The images agree with
it. With v-snap patched to judge by the rule, every failing image passed,
on macOS and Ubuntu on arm64, in two runs each. The most any image needed
was 0.94 of its allowance, in the Arcade Hall. Not one changed a flat
pixel. These are the same images the rule was first tried on, so they show
that its verdict holds steady. They don't show how it does on new scenes.

### What It Doesn't Catch

The rule can't tell a sample crossing an edge from a whole edge moving one
pixel. Both change edge pixels by up to the step and leave flat pixels
alone. Of the 228 real changes in history:

| | Changes |
| --- | --- |
| Changed a flat pixel, so fail under the rule | 155 |
| Need more than the allowance, so fail | 64 |
| Pass under the rule | 9 |

Of the 9 that pass:
- **Two were changes too small to see:** the control panel's lip (one pixel)
  and v-snap's own cross-OS fix.
- **The other seven came from changes to text and layout:** Fruit
  Machine's disclaimer, a review fix to a puzzle's solved screen, and the
  new pixel font in Farm Fenced and Fuel Run. They changed only edge
  pixels, each by no more than its step, as an edge moved by up to a
  pixel would.

A one-pixel layout bug is exactly what a visual test is for. So this rule
can't be the only check.

## 4. Two Jobs, Two Comparisons

v-snap does two jobs:

1. **Catch real changes.** This needs an exact comparison. Only a machine
   whose shader compiler drew the reference can make one.
2. **Let a reference pass everywhere.** This needs leeway, but only between
   shader compilers.

So v-snap records the shader compiler that drew each reference, and
compares:

- **With the same shader compiler:** identical, or within the tolerance of 2 levels, as
  every comparison is today.
- **Across shader compilers:** the one-sample rule.

A real change always meets an exact comparison on the machines of its
reference's shader compiler. With a CI runner for each shader compiler,
CI catches it. The repo
already has both: Ubuntu and Windows for Subzero, and macOS for LLVM. The
rule across shader compilers still catches most real changes (219 of 228). It only
has to never fail a reference that's right.

### Knowing the Shader Compiler

v-snap reads the WebGL renderer string once, as its environment check
runs, and reads the shader compiler's name from it: `subzero` or `llvm`. A
string that names neither counts as a shader compiler of its own, so it
meets the rule across shader compilers, and the run's summary names the
shader compiler it found. This
replaces `DRAWS_EXACTLY`, which reads `process.arch`.

Each reference records its shader compiler in its PNG, in a text chunk beside its
pixel hash. A reference without one counts as `subzero`, since every
reference so far was written on x64.

### What `-u` Does

- **With the same shader compiler,** `-u` writes any change, as it does on x64 today.
- **Across shader compilers,** `-u` keeps a reference that passes the one-sample rule.
  It writes one that fails, and the new reference records the new shader
  compiler.

A reference is rewritten only by a real change, so it never flips back and
forth between machines.

## 5. When the Rule Isn't Enough

Some drawing can fall outside the model:

- two samples crossing at once, on a pixel that several edges meet
- shader maths that rounds by more than 2 levels in flat areas, such as
  fog or procedural noise
- something the spike didn't find, such as clipping, if that's what moved
  the Arcade Hall's edge
- faces closer together than the depth buffer resolves

**v-snap never requires a change to a scene.** A scene is designed for
its players, not for its tests. Whatever the one-sample rule doesn't pass,
a reference for each shader compiler covers, exactly.

### A Reference for Each Shader Compiler

> **Set aside.** Every case outside the rule that was found has a better
> fix. Faces almost touching flicker on every GPU, so the scene should
> change. Noise built on `sin` differs between GPUs too, and an integer
> hash is exact everywhere. Two samples crossing at once, and drawing that
> doesn't repeat, never showed up. A second reference would also bring
> back the work of writing references on a machine of each kind. So only
> `shaderCompiler` was built, for skipping. The design below stays, in
> case a real test needs it.

Each shader compiler draws exactly the same images every time. So a test
whose image falls outside the rule can keep a second reference for the
other shader compiler, and
compare exactly with it. The test declares this in its file, where it's
reviewed:

```ts
canvasTest('blowing up a rival', { ...SIZE, eachShaderCompiler: true }, pose);
```

For such a test, a second file sits beside the reference, named for its
shader compiler, such as `game-view.blowing-up-a-rival.llvm.png`.

- **Comparing.** A machine compares exactly with the reference from its
  own shader compiler, whichever file that is. If its shader compiler has
  no reference yet, it compares with the other by the one-sample rule, and the run's summary
  lists the missing reference.
- **Writing.** `-u` writes only the reference for the machine's own
  shader compiler, and never touches the other's.
- **Keeping both current.** A real change to the scene makes the other
  shader compiler's reference fail on that shader compiler's runner. That's right, since that
  reference no longer shows the scene. In CI, v-snap saves the actual
  image under the name the reference would have. So whoever made the
  change can download it from the run and commit it, even without a
  machine that uses that shader compiler.

This keeps every comparison exact for such a test. The cost is the second
round trip on each change, so it's for the few tests that need it, not
for every 3D image.

### Skipping on a Shader Compiler

As a last resort, a test can skip on one shader compiler, with Vitest's
`skipIf` and a `shaderCompiler` value that v-snap exports.

### Bugs a Test Catches

A few things fail across shader compilers because they're bugs in the scene, which
players would see too. Limits and Rules names only these, and says for
each why it's a bug, not just a test failure:

- **Faces closer together than the depth buffer resolves.** They flicker on
  every GPU as the camera moves (z-fighting). How close is too close grows
  with the square of the distance from the camera, and shrinks as the
  near plane moves out. So the advice is a rule of 3D drawing, not a
  number of millimetres.
- **Randomness that isn't seeded.** The image changes from run to run, on
  every machine.

Anything else that falls outside the rule is a reason to keep a reference
for each shader compiler, never a rule for scenes. Choosing a test's pose is
different. It's the test author's choice, not the scene's, so Limits and
Rules can offer tips on poses, such as keeping a surface from being seen
edge-on.

### Not Proposed: Leeway

Per-test leeway (more levels, or a count of pixels allowed to fail) would
cover drawing that differs from run to run on one machine. The spike saw
none: every machine drew the same both times. Leeway also tends to decay,
since people raise it until a test passes, and leave it. So it waits until
a scene needs it. If one does, every failure should report the leeway that
would pass it, and each run should report leeway that a test stopped
needing, as Mozilla's reftests and the Web Platform Tests do.

## 6. What a Failure Shows

The diff colours each pixel by why it passed or failed:

- **Red:** past everything allowed. A real change.
- **Orange:** excused as a sample crossing an edge.
- **Dark yellow:** within the tolerance.

The error message counts each. It names the shader compiler that drew the
reference and the one that drew the image, so a difference across shader
compilers is plain to see.

## 7. Alternatives

- **Pixel counts and clumps** (the stopgap). Fitted to the data, and broke
  on the next run.
- **A reference for each shader compiler, for every image that differs.** Exact
  everywhere, with no rule at all. But someone on an x64 machine couldn't
  write the LLVM references, and every change to a 3D scene would need a
  round trip through CI or a Mac. This proposal keeps it for the tests
  that need it.
- **Per-test leeway alone,** as Mozilla and the Web Platform Tests do. It
  works, but every 3D test would need leeway, and a reference written on
  a Mac would fail on x64 until it had some.
- **Edge masks,** as in Skia Gold's Sobel matching. They ignore any change
  on a strong edge, including real ones, and the strength that counts as
  an edge is a threshold to tune.
- **A perceptual score,** such as SSIM. One number for the whole image,
  with a threshold that's tuned, and that nobody can explain when it
  fails.
- **Drawing everything in one container.** v-snap rejected this (How It
  Works, "Why Not Docker").
- **Patching SwiftShader so that LLVM doesn't fuse.** It's the only way to
  make the two shader compilers draw the same, and it's outside what v-snap can ship.

## 8. Stages

0. **Spike.** Done. Section 2 has its findings. Its files were deleted
   once this proposal was accepted (commit `a349d93e` has them).
1. **Shader compilers and the rule.** Read the shader compiler from the
   renderer string, and record it in references. Compare across shader
   compilers with the one-sample
   rule, and change `-u` as section 4 says. Remove the stopgap and
   `DRAWS_EXACTLY`. The diff's colours and the message's counts. Tests for
   each part, using the failing images as fixtures. A changeset (minor).
2. **A reference for each shader compiler.** `eachShaderCompiler`, its
   files, how `-u` writes
   them, the actual image saved under the reference's name in CI, the
   summary's list of missing references, and the `shaderCompiler` export.
3. **Docs.** How It Works (two shader compilers, two comparisons). Limits and Rules:
   replace "Keep the faces of a 3D scene apart" with the bugs a test
   catches, as section 5 words them, add when to keep a reference for
   each shader compiler, and add tips on poses. Writing Tests
   (`eachShaderCompiler`). Advice to run CI on a machine for each shader
   compiler.

## 9. Open Questions

- **Ubuntu on arm64 instead of macOS in CI?** It draws the same as macOS,
  and it usually starts faster. The macOS runner also checks that macOS
  composites HTML the same way, so it may still earn its place.
- **Should the tolerance with the same shader compiler stay at 2 levels?** Within x64 it's
  never been needed, but it costs little.
- **When a run with one shader compiler meets a reference from another, should the
  summary say that the run checked it only by the rule?** It would remind
  a team that hasn't got a runner for each shader compiler. It would also be noise for
  a team that has.
- **Is clipping the cause of the Arcade Hall's edge?** One more probe, a
  shape running out of the frame toward the camera, would say. If it is,
  that's a reason for such a test to keep a reference for each shader compiler, not
  a rule for scenes. It could also be a tip on poses.
